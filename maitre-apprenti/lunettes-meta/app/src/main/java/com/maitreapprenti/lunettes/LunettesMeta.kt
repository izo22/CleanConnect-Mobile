package com.maitreapprenti.lunettes

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.VideoQuality
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.selectors.AutoDeviceSelector
import com.meta.wearable.dat.core.session.DeviceSession
import com.meta.wearable.dat.core.session.DeviceSessionState
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.display.Display
import com.meta.wearable.dat.display.addDisplay
import com.meta.wearable.dat.display.types.DisplayState
import com.meta.wearable.dat.display.types.VideoCodec
import com.meta.wearable.dat.display.types.VideoPlayerState
import com.meta.wearable.dat.display.types.VideoSource
import com.meta.wearable.dat.display.views.ButtonStyle
import com.meta.wearable.dat.display.views.FlexBoxBackground
import com.meta.wearable.dat.display.views.IconName
import com.meta.wearable.dat.display.views.TextColor
import com.meta.wearable.dat.display.views.TextStyle
import com.meta.wearable.dat.display.views.VideoPlayer
import com.meta.wearable.dat.speech.Speech
import com.meta.wearable.dat.speech.addSpeech
import java.io.IOException
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** Boutons affichés sur l'écran des lunettes (les appuis reviennent au téléphone). */
enum class BoutonLunettes {
  VERIFIER,
  VOIR_GESTE,
  SUIVANT,
  REPETER,
}

/**
 * Branche le contrôleur sur les lunettes Meta via le Wearables Device Access Toolkit :
 * caméra (vidéo HEVC en continu, découpée en morceaux), écran des Ray-Ban Display
 * (étape, correction, clip du maître),
 * reconnaissance vocale des lunettes (commandes) et synthèse vocale du téléphone
 * (le son sort dans les haut-parleurs des lunettes, connectées en Bluetooth).
 */
class LunettesMeta(
    context: Context,
    private val scope: CoroutineScope,
    /** Demande une autorisation aux lunettes via l'appli Meta AI (voir MainActivity). */
    private val demanderAutorisation: suspend (Permission) -> PermissionStatus,
    private val surConnexion: (String) -> Unit,
    private val surPhrase: (String) -> Unit,
    private val surBouton: (BoutonLunettes) -> Unit,
) : Lunettes {
  private var session: DeviceSession? = null
  private var camera: Camera? = null
  private var ecranLunettes: Display? = null
  private var speech: Speech? = null
  private val taches = mutableListOf<Job>()
  private var dernierEcran: Ecran? = null
  private var lecteur: VideoPlayer? = null
  private var tacheVideo: Job? = null
  private val decoupeur = DecoupeurHevc(IMAGES_PAR_SECONDE)
  @Volatile private var derniereImageMs = 0L

  private var voixPrete = false
  private val voix: TextToSpeech =
      TextToSpeech(context.applicationContext) { statut ->
        voixPrete = statut == TextToSpeech.SUCCESS
        if (voixPrete) voix.language = Locale.FRENCH
      }

  val connectees: Boolean
    get() = session?.state?.value == DeviceSessionState.STARTED

  // --- Connexion -------------------------------------------------------------------

  fun connecter() {
    if (session != null) return
    Wearables.createSession(AutoDeviceSelector())
        .onSuccess { nouvelle ->
          session = nouvelle
          // On s'abonne avant start() pour ne manquer aucune transition.
          taches +=
              scope.launch {
                nouvelle.state.collect { etat ->
                  surConnexion(libelle(etat))
                  if (etat == DeviceSessionState.STARTED) brancherCapacites(nouvelle)
                  if (etat == DeviceSessionState.STOPPED) nettoyer()
                }
              }
          taches += scope.launch { nouvelle.errors.collect { surConnexion("Erreur : ${it.description}") } }
          nouvelle.start()
        }
        .onFailure { erreur, _ -> surConnexion("Connexion impossible : ${erreur.description}") }
  }

  fun deconnecter() {
    session?.stop()
  }

  fun liberer() {
    deconnecter()
    voix.shutdown()
  }

  private fun libelle(etat: DeviceSessionState) =
      when (etat) {
        DeviceSessionState.STARTED -> "Lunettes connectées"
        DeviceSessionState.STOPPED -> "Lunettes déconnectées"
        else -> "Connexion aux lunettes…"
      }

  private fun nettoyer() {
    taches.forEach { it.cancel() }
    taches.clear()
    tacheVideo?.cancel()
    lecteur?.close()
    lecteur = null
    camera = null
    ecranLunettes = null
    speech = null
    session = null
  }

  private suspend fun autorise(permission: Permission): Boolean {
    val statut = Wearables.checkPermissionStatus(permission).getOrNull()
    return statut == PermissionStatus.Granted || demanderAutorisation(permission) == PermissionStatus.Granted
  }

  private fun brancherCapacites(session: DeviceSession) {
    scope.launch {
      // Caméra : vidéo compressée (HEVC), transmise telle quelle au cerveau, sans décodage ici.
      if (camera == null && autorise(Permission.CAMERA)) {
        session
            .addCamera(
                StreamConfiguration(
                    videoQuality = VideoQuality.MEDIUM,
                    frameRate = IMAGES_PAR_SECONDE,
                    compressVideo = true,
                ))
            .onSuccess { ajoutee ->
              camera = ajoutee
              // Abonnement avant start() pour ne pas manquer la configuration du codec.
              taches +=
                  scope.launch(Dispatchers.Default) {
                    ajoutee.stream.videoStream.collect { image ->
                      if (!image.isCompressed) return@collect
                      val tampon = image.buffer.duplicate().apply { rewind() }
                      val octets = ByteArray(tampon.remaining()).also { tampon.get(it) }
                      decoupeur.ajouter(octets, image.presentationTimeUs, image.isCodecConfig)
                      derniereImageMs = System.currentTimeMillis()
                    }
                  }
              ajoutee.stream.start().onFailure { erreur, _ ->
                surConnexion("Caméra : ${erreur.description}")
              }
            }
            .onFailure { erreur, _ -> surConnexion("Caméra : ${erreur.description}") }
      }

      // Écran : seulement sur les Ray-Ban Display.
      if (ecranLunettes == null && session.deviceInfo.value.isDisplayCapable()) {
        session
            .addDisplay()
            .onSuccess { ajoute ->
              taches +=
                  scope.launch {
                    ajoute.state.collect { etat ->
                      if (etat == DisplayState.STARTED) {
                        ecranLunettes = ajoute
                        dernierEcran?.let { afficher(it) }
                      }
                    }
                  }
            }
            .onFailure { erreur, _ -> Log.w(TAG, "Écran indisponible : ${erreur.description}") }
      }

      // Reconnaissance vocale sur les lunettes (expérimentale chez Meta : facultative).
      if (speech == null && autorise(Permission.MICROPHONE)) {
        session
            .addSpeech()
            .onSuccess { ajoutee ->
              speech = ajoutee
              taches +=
                  scope.launch {
                    ajoutee.transcriptions.collect { resultat ->
                      if (resultat != null && resultat.isFinal && resultat.text.isNotBlank()) {
                        surPhrase(resultat.text)
                      }
                    }
                  }
              ajoutee.start().onFailure { erreur, _ -> Log.w(TAG, "Voix : ${erreur.description}") }
            }
            .onFailure { erreur, _ -> Log.w(TAG, "Voix indisponible : ${erreur.description}") }
      }
    }
  }

  // --- Lunettes (pour le contrôleur) -------------------------------------------------

  override suspend fun prochainMorceau(continu: Boolean): MorceauVideo {
    if (camera == null) throw IOException("Caméra des lunettes non connectée")
    val debut = System.currentTimeMillis()
    while (true) {
      val morceau = if (continu) decoupeur.morceauContinu() else decoupeur.morceauRecent()
      if (morceau != null) return morceau
      // Plus d'images depuis 15 s : le flux est coupé (lunettes éteintes, Bluetooth…).
      if (System.currentTimeMillis() - maxOf(derniereImageMs, debut) > 15_000) {
        throw IOException("Plus de vidéo des lunettes")
      }
      delay(200)
    }
  }

  override fun dernierMorceau(): MorceauVideo? = decoupeur.vider()

  override fun dernieresSecondes(secondes: Int): MorceauVideo? = decoupeur.dernieresSecondes(secondes * 1_000_000L)

  override fun nouvelleVideo() = decoupeur.reinitialiser()

  override fun dire(texte: String) {
    if (voixPrete) voix.speak(texte, TextToSpeech.QUEUE_FLUSH, null, "conseil")
  }

  override fun afficher(ecran: Ecran) {
    dernierEcran = ecran
    val cible = ecranLunettes ?: return
    if (lecteur != null) return // Un clip est en cours : on réaffichera la carte à la fin.
    scope.launch {
      cible
          .sendContent {
            flexBox(gap = 12, padding = 24, background = FlexBoxBackground.CARD) {
              text(ecran.titre, style = TextStyle.META, color = TextColor.SECONDARY)
              text(ecran.texte, style = TextStyle.BODY)
              button(
                  label = "Vérifier mon geste",
                  style = ButtonStyle.PRIMARY,
                  iconName = IconName.EYE,
                  onClick = { surBouton(BoutonLunettes.VERIFIER) },
              )
              if (ecran.clipUrl != null) {
                button(
                    label = "Voir le geste",
                    style = ButtonStyle.SECONDARY,
                    iconName = IconName.TRIANGLE_RIGHT_CIRCLE,
                    onClick = { surBouton(BoutonLunettes.VOIR_GESTE) },
                )
              }
              button(
                  label = "Répéter",
                  style = ButtonStyle.SECONDARY,
                  iconName = IconName.SPEAKER_WITH_TWO_ARCS,
                  onClick = { surBouton(BoutonLunettes.REPETER) },
              )
              button(
                  label = "Étape suivante",
                  style = ButtonStyle.SECONDARY,
                  iconName = IconName.ARROW_RIGHT,
                  onClick = { surBouton(BoutonLunettes.SUIVANT) },
              )
            }
          }
          .onFailure { erreur, _ -> Log.w(TAG, "Affichage : ${erreur.description}") }
    }
  }

  override fun montrerGeste(url: String): Boolean {
    val cible = ecranLunettes ?: return false
    tacheVideo?.cancel()
    lecteur?.close()
    val nouveau = VideoPlayer(source = VideoSource.Url(url), codec = VideoCodec.MP4)
    lecteur = nouveau
    tacheVideo =
        scope.launch {
          launch {
            nouveau.error.collect { erreur ->
              if (erreur != null) {
                Log.w(TAG, "Clip : ${erreur.description}")
                finVideo(nouveau)
              }
            }
          }
          launch { nouveau.state.first { it == VideoPlayerState.ENDED }.also { finVideo(nouveau) } }
          cible
              .sendContent { video(player = nouveau) }
              .onSuccess { nouveau.play() }
              .onFailure { erreur, _ ->
                Log.w(TAG, "Clip : ${erreur.description}")
                finVideo(nouveau)
              }
        }
    return true
  }

  /** Fin (ou échec) du clip : on revient à la carte de l'étape. */
  private fun finVideo(joue: VideoPlayer) {
    if (lecteur !== joue) return
    lecteur = null
    joue.close()
    tacheVideo?.cancel()
    dernierEcran?.let { afficher(it) }
  }

  private companion object {
    const val TAG = "MaitreApprenti"
    /** Cadence de la vidéo des lunettes (valeurs possibles : 2, 7, 15, 24 ou 30). */
    const val IMAGES_PAR_SECONDE = 15
  }
}
