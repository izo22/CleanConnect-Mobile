package com.maitreapprenti.lunettes

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Logique des lunettes, sans dépendance au SDK Meta (pour pouvoir la tester sur ordinateur) :
 * - mode apprenti : les lunettes filment en continu et gardent les 20 dernières secondes. Quand
 *   l'apprenti dit « vérifie » (ou « suivant »), ces secondes partent au cerveau, qui fait juger
 *   le geste → correction à l'oreille. Sur une étape surveillée (ou avec la vérification
 *   automatique), la vidéo part en continu, par morceaux d'environ 4 s ;
 * - mode maître : toute la vidéo de la démonstration + la voix du maître partent au cerveau,
 *   qui en fait une leçon.
 */

enum class Mode {
  APPRENTI,
  MAITRE,
}

data class Reglages(
    val urlCerveau: String = "",
    val cle: String = "",
    val mode: Mode = Mode.APPRENTI,
    val leconId: String = "",
    /** Prénom de l'apprenti, pour que le maître suive ses séances. */
    val apprenti: String = "",
    val titreDemo: String = "",
    val metierDemo: String = "",
)

data class Etat(
    val actif: Boolean = false,
    val etape: String = "",
    val message: String = "Prêt",
    val erreur: String? = null,
)

/** Ce qu'on montre sur l'écran des lunettes (s'il y en a un). */
data class Ecran(val titre: String, val texte: String, val clipUrl: String? = null)

/** Ce que le contrôleur attend des lunettes (branché sur le SDK Meta dans LunettesMeta). */
interface Lunettes {
  /**
   * Attend et renvoie le prochain morceau de vidéo filmé par les lunettes :
   * les dernières secondes (apprenti), ou la suite exacte de la vidéo (maître, [continu] = true).
   */
  suspend fun prochainMorceau(continu: Boolean): MorceauVideo

  /** Ce qui reste de vidéo non envoyée (fin de la démonstration du maître). */
  fun dernierMorceau(): MorceauVideo?

  /** Les dernières secondes filmées, sans les retirer (analyse à la demande). */
  fun dernieresSecondes(secondes: Int): MorceauVideo?

  /** Oublie la vidéo filmée jusqu'ici (début d'une leçon ou d'une démonstration). */
  fun nouvelleVideo()

  fun dire(texte: String)

  fun afficher(ecran: Ecran)

  /** Joue le petit clip du maître sur l'écran des lunettes. Renvoie false si impossible. */
  fun montrerGeste(url: String): Boolean
}

class Controleur(
    private val scope: CoroutineScope,
    private val lunettes: Lunettes,
    private var reglages: Reglages,
    private val notifier: (Etat) -> Unit,
    private val fabriqueApi: (Reglages) -> ApiCerveau = { CerveauHttp(it.urlCerveau, it.cle) },
) {
  var etat = Etat()
    private set

  private var api: ApiCerveau = fabriqueApi(reglages)
  private var boucle: Job? = null
  private var sessionId: String? = null
  private var sessionLeconId = ""
  private var captureId: String? = null
  private var morceauxEnvoyes = 0
  private var derniereErreurDite = ""
  private var dernierRetour: Retour? = null
  /** Mode d'analyse de l'étape en cours, tel que le cerveau l'a indiqué. */
  private var envoiContinu = true
  private var fenetreS = 8

  val actif: Boolean
    get() = etat.actif

  fun changerReglages(nouveaux: Reglages) {
    if (etat.actif) arreter()
    reglages = nouveaux
    api = fabriqueApi(nouveaux)
    maj(etat.copy(message = "Réglages enregistrés", erreur = null))
  }

  private fun maj(nouvel: Etat) {
    etat = nouvel
    notifier(nouvel)
  }

  private fun signalerErreur(erreur: Throwable) {
    val message = erreur.message ?: erreur.toString()
    maj(etat.copy(erreur = message))
    lunettes.afficher(Ecran("Problème", message))
    // On ne répète pas la même erreur à l'oreille à chaque morceau de vidéo.
    if (message != derniereErreurDite) {
      derniereErreurDite = message
      lunettes.dire("Je n'arrive pas à joindre le cerveau.")
    }
  }

  // --- Démarrage / arrêt -----------------------------------------------------------

  suspend fun demarrer() {
    if (etat.actif) return
    if (reglages.urlCerveau.isBlank()) {
      maj(etat.copy(erreur = "Indique l'adresse du cerveau dans les réglages"))
      return
    }
    morceauxEnvoyes = 0
    derniereErreurDite = ""
    lunettes.nouvelleVideo()
    maj(Etat(actif = true, message = "Démarrage…"))
    try {
      if (reglages.mode == Mode.APPRENTI) demarrerApprenti() else demarrerMaitre()
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      signalerErreur(e)
      arreter()
      return
    }
    boucle =
        scope.launch {
          // Pas de minuterie : chaque tour attend le morceau de vidéo suivant (environ 4 s).
          while (isActive) {
            try {
              if (reglages.mode == Mode.APPRENTI) tourApprenti() else tourMaitre()
              if (etat.erreur != null) maj(etat.copy(erreur = null))
            } catch (e: CancellationException) {
              throw e
            } catch (e: Exception) {
              signalerErreur(e)
              delay(2_000)
            }
          }
        }
  }

  fun arreter() {
    boucle?.cancel()
    boucle = null
    maj(etat.copy(actif = false, message = "En pause"))
  }

  // --- Mode apprenti ---------------------------------------------------------------

  private suspend fun demarrerApprenti() {
    if (reglages.leconId.isBlank()) throw IllegalStateException("Choisis une leçon dans les réglages")
    // Après une pause, on reprend là où l'apprenti en était (si la session existe encore).
    val precedente = sessionId
    if (precedente != null && sessionLeconId == reglages.leconId) {
      val retour = runCatching { api.etatSession(precedente) }.getOrNull()
      if (retour != null && !retour.termine) {
        appliquer(retour.copy(dire = "On reprend. ${retour.titre}."))
        return
      }
    }
    val retour = api.creerSession(reglages.leconId, reglages.apprenti)
    sessionId = retour.sessionId
    sessionLeconId = reglages.leconId
    appliquer(retour)
  }

  private suspend fun tourApprenti() {
    val id = sessionId ?: return
    // Analyse à la demande : la vidéo reste sur le téléphone jusqu'à « vérifie » ou « suivant ».
    if (!envoiContinu) {
      delay(500)
      return
    }
    val retour = api.envoyerVideo(id, lunettes.prochainMorceau(continu = false))
    appliquer(retour)
    if (retour.termine) arreter()
  }

  private fun appliquer(retour: Retour) {
    envoiContinu = retour.envoiVideoContinu
    fenetreS = retour.fenetreS
    if (retour.ignore) return
    dernierRetour = retour
    val etape = if (retour.termine) "Leçon terminée" else "Étape ${retour.index + 1}/${retour.total} : ${retour.titre}"
    val clip = retour.clipLunettesUrl?.let { api.urlComplete(it) }
    lunettes.afficher(Ecran(etape, retour.afficher, clip))
    retour.dire?.let { lunettes.dire(it) }
    maj(etat.copy(etape = etape, message = retour.afficher))
  }

  suspend fun commande(commande: String) {
    val id = sessionId ?: return
    if (reglages.mode != Mode.APPRENTI) return
    try {
      // « Vérifie » et « suivant » emportent la vidéo du geste : les dernières secondes gardées
      // sur le téléphone, ou seulement la fin pas encore envoyée si la vidéo part en continu.
      val avecVideo = etat.actif && (commande == "verifier" || commande == "suivant")
      if (commande == "verifier") lunettes.dire("Je regarde.")
      val morceau =
          when {
            !avecVideo -> null
            envoiContinu -> lunettes.dernierMorceau()
            else -> lunettes.dernieresSecondes(fenetreS)
          }
      val retour = if (morceau != null) api.envoyerVideo(id, morceau, commande) else api.commande(id, commande)
      appliquer(retour)
      if (retour.termine) arreter()
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      signalerErreur(e)
    }
  }

  /** Rejoue sur l'écran des lunettes le geste du maître pour l'étape en cours. */
  fun montrerGeste() {
    val clip = dernierRetour?.clipLunettesUrl
    if (clip == null || !lunettes.montrerGeste(api.urlComplete(clip))) {
      lunettes.dire("Je n'ai pas de vidéo du maître à te montrer pour cette étape.")
    }
  }

  // --- Mode maître -----------------------------------------------------------------

  private suspend fun demarrerMaitre() {
    captureId = api.creerCapture(reglages.titreDemo, reglages.metierDemo)
    val consigne =
        "Je filme. Explique tes gestes à voix haute. Dis « étape suivante » à chaque nouvelle étape, et « terminé » à la fin."
    lunettes.afficher(Ecran("Démonstration", consigne))
    lunettes.dire(consigne)
    maj(etat.copy(etape = "Démonstration en cours", message = consigne))
  }

  private suspend fun tourMaitre() {
    val id = captureId ?: return
    api.envoyerVideoCapture(id, lunettes.prochainMorceau(continu = true))
    morceauxEnvoyes++
    maj(etat.copy(etape = "Démonstration : ${morceauxEnvoyes * 4} s de vidéo envoyées"))
  }

  suspend fun marquerEtape() {
    val id = captureId ?: return
    if (!etat.actif) return
    try {
      api.marquerEtape(id)
      lunettes.dire("Étape suivante, c'est noté.")
      maj(etat.copy(message = "Nouvelle étape marquée"))
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      signalerErreur(e)
    }
  }

  suspend fun terminerDemonstration() {
    val id = captureId ?: return
    captureId = null
    arreter()
    try {
      // Les dernières secondes filmées, pour ne rien perdre de la fin du geste.
      lunettes.dernierMorceau()?.let { api.envoyerVideoCapture(id, it) }
      api.terminerCapture(id)
      val fin = "Merci ! La leçon est en préparation, elle sera prête dans quelques minutes."
      lunettes.afficher(Ecran("Démonstration terminée", fin))
      lunettes.dire(fin)
      maj(etat.copy(etape = "Démonstration terminée", message = fin))
    } catch (e: CancellationException) {
      throw e
    } catch (e: Exception) {
      signalerErreur(e)
    }
  }

  // --- Voix ------------------------------------------------------------------------

  /** Phrase entendue par les lunettes (transcription finale). */
  suspend fun entendu(phrase: String) {
    if (reglages.mode == Mode.MAITRE) {
      when (commandeMaitre(phrase)) {
        CommandeVocale.ETAPE_MAITRE -> marquerEtape()
        CommandeVocale.TERMINER_MAITRE -> terminerDemonstration()
        else -> {
          val id = captureId
          if (id != null && etat.actif && phrase.isNotBlank()) {
            try {
              api.parole(id, phrase.trim())
            } catch (e: CancellationException) {
              throw e
            } catch (e: Exception) {
              signalerErreur(e)
            }
          }
        }
      }
      return
    }
    if (!etat.actif) return
    when (commandeApprenti(phrase)) {
      CommandeVocale.SUIVANT -> commande("suivant")
      CommandeVocale.PRECEDENT -> commande("precedent")
      CommandeVocale.REPETER -> commande("repeter")
      CommandeVocale.RECOMMENCER -> commande("recommencer")
      CommandeVocale.VOIR_GESTE -> montrerGeste()
      CommandeVocale.VERIFIER -> commande("verifier")
      CommandeVocale.EXPLIQUER -> commande("expliquer")
      CommandeVocale.PAUSE -> {
        arreter()
        lunettes.dire("Pause. Reprends depuis le téléphone.")
      }
      else -> Unit
    }
  }
}
