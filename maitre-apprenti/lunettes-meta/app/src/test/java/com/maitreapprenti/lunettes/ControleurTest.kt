package com.maitreapprenti.lunettes

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ControleurTest {
  private fun retour(index: Int, dire: String? = null, afficher: String = "Consigne ${index + 1}", termine: Boolean = false) =
      Retour(
          sessionId = "s1",
          termine = termine,
          index = index,
          total = 3,
          titre = "Titre ${index + 1}",
          consigne = "Consigne ${index + 1}",
          clipLunettesUrl = "/media/lecons/L1/clips/etape-${index + 1}-lunettes.mp4",
          verdict = null,
          afficher = afficher,
          dire = dire,
          ignore = false,
      )

  /** Faux cerveau : note les appels et renvoie des réponses programmées. */
  private class FauxCerveau : ApiCerveau {
    val appels = mutableListOf<String>()
    var reponseImage: () -> Retour = { error("pas de réponse") }
    var sessionExiste = true

    override suspend fun lecons() = emptyList<ResumeLecon>()

    override suspend fun creerSession(leconId: String): Retour {
      appels += "creerSession $leconId"
      return Retour("s1", false, 0, 3, "Pesée", "Pèse.", null, null, "Pèse.", "Étape 1", false)
    }

    override suspend fun etatSession(sessionId: String): Retour {
      appels += "etatSession $sessionId"
      if (!sessionExiste) throw ErreurCerveau("Session introuvable")
      return Retour("s1", false, 1, 3, "Façonnage", "Roule.", null, null, "Roule.", null, false)
    }

    override suspend fun envoyerImage(sessionId: String, jpeg: ByteArray): Retour {
      appels += "image ${jpeg.size}"
      return reponseImage()
    }

    override suspend fun commande(sessionId: String, commande: String): Retour {
      appels += "commande $commande"
      return Retour(
          "s1", false, 1, 3, "Façonnage", "Roule.", "/media/lecons/L1/clips/etape-2-lunettes.mp4", null,
          "Roule.", "Étape 2", false)
    }

    override suspend fun creerCapture(titre: String, metier: String): String {
      appels += "creerCapture $titre/$metier"
      return "c1"
    }

    override suspend fun envoyerImageCapture(captureId: String, jpeg: ByteArray) {
      appels += "imageCapture"
    }

    override suspend fun parole(captureId: String, texte: String) {
      appels += "parole $texte"
    }

    override suspend fun marquerEtape(captureId: String) {
      appels += "etape"
    }

    override suspend fun terminerCapture(captureId: String) {
      appels += "terminer"
    }

    override fun urlComplete(chemin: String) = "https://cerveau.test$chemin"
  }

  private class FaussesLunettes : Lunettes {
    val dit = mutableListOf<String>()
    val ecrans = mutableListOf<Ecran>()
    val gestes = mutableListOf<String>()

    override suspend fun prendrePhoto() = ByteArray(42)

    override fun dire(texte: String) {
      dit += texte
    }

    override fun afficher(ecran: Ecran) {
      ecrans += ecran
    }

    override fun montrerGeste(url: String): Boolean {
      gestes += url
      return true
    }
  }

  private val reglages = Reglages(urlCerveau = "https://cerveau.test", leconId = "L1")

  private fun TestScope.controleur(
      cerveau: FauxCerveau,
      lunettes: FaussesLunettes,
      r: Reglages = reglages,
  ) = Controleur(backgroundScope, lunettes, r, {}, { cerveau }, intervalleMs = 4_000)

  @Test
  fun `apprenti - photo toutes les 4 secondes, corrections dites et affichees`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { retour(0, dire = "Ajoute de l'eau", afficher = "Ajoute de l'eau") } }
    val lunettes = FaussesLunettes()
    val c = controleur(cerveau, lunettes)

    c.demarrer()
    runCurrent()
    advanceTimeBy(4_001)
    runCurrent()

    assertEquals(listOf("creerSession L1", "image 42", "image 42"), cerveau.appels)
    assertEquals(listOf("Étape 1", "Ajoute de l'eau", "Ajoute de l'eau"), lunettes.dit)
    assertEquals("Étape 1/3 : Titre 1", lunettes.ecrans.last().titre)
    assertEquals("https://cerveau.test/media/lecons/L1/clips/etape-1-lunettes.mp4", lunettes.ecrans.last().clipUrl)
    assertTrue(c.actif)
    c.arreter()
  }

  @Test
  fun `apprenti - reprend la meme session apres une pause`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { retour(1) } }
    val lunettes = FaussesLunettes()
    val c = controleur(cerveau, lunettes)

    c.demarrer()
    c.arreter()
    c.demarrer()
    c.arreter()

    assertEquals(1, cerveau.appels.count { it.startsWith("creerSession") })
    assertEquals("On reprend. Façonnage.", lunettes.dit.last())
  }

  @Test
  fun `apprenti - session expiree, on en ouvre une nouvelle`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { retour(0) } }
    val c = controleur(cerveau, FaussesLunettes())
    c.demarrer()
    c.arreter()
    cerveau.sessionExiste = false
    c.demarrer()
    c.arreter()
    assertEquals(2, cerveau.appels.count { it.startsWith("creerSession") })
  }

  @Test
  fun `apprenti - s arrete a la fin de la lecon`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { retour(2, dire = "Bravo", termine = true) } }
    val c = controleur(cerveau, FaussesLunettes())
    c.demarrer()
    runCurrent()
    assertFalse(c.actif)
    assertEquals("Leçon terminée", c.etat.etape)
  }

  @Test
  fun `apprenti - une panne du cerveau est dite une seule fois`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { throw ErreurCerveau("Erreur 502 du cerveau") } }
    val lunettes = FaussesLunettes()
    val c = controleur(cerveau, lunettes)
    c.demarrer()
    runCurrent()
    advanceTimeBy(8_001)
    runCurrent()
    assertEquals(3, cerveau.appels.count { it.startsWith("image") })
    assertEquals(1, lunettes.dit.count { it.contains("cerveau") })
    assertEquals("Erreur 502 du cerveau", c.etat.erreur)
    assertTrue(c.actif)
    c.arreter()
  }

  @Test
  fun `apprenti - commandes vocales`() = runTest {
    val cerveau = FauxCerveau().apply { reponseImage = { retour(0) } }
    val lunettes = FaussesLunettes()
    val c = controleur(cerveau, lunettes)
    c.demarrer()
    c.entendu("Suivant !")
    c.entendu("je prends le suivant dans la corbeille")
    c.entendu("montre le geste")
    assertEquals(1, cerveau.appels.count { it == "commande suivant" })
    // Le geste montré est celui de l'étape en cours (la 2, après « suivant »).
    assertEquals(listOf("https://cerveau.test/media/lecons/L1/clips/etape-2-lunettes.mp4"), lunettes.gestes)
    c.entendu("pause")
    assertFalse(c.actif)
  }

  @Test
  fun `maitre - photos, paroles, etapes et fin`() = runTest {
    val cerveau = FauxCerveau()
    val lunettes = FaussesLunettes()
    val c = controleur(cerveau, lunettes, reglages.copy(mode = Mode.MAITRE, titreDemo = "Croissant", metierDemo = "Boulangerie"))

    c.demarrer()
    runCurrent()
    c.entendu("Je rabats la pâte vers moi")
    c.entendu("Étape suivante")
    c.entendu("C'est terminé")

    assertEquals(
        listOf("creerCapture Croissant/Boulangerie", "imageCapture", "parole Je rabats la pâte vers moi", "etape", "terminer"),
        cerveau.appels)
    assertFalse(c.actif)
    assertTrue(lunettes.dit.last().contains("en préparation"))
  }

  @Test
  fun `sans adresse du cerveau, ne demarre pas`() = runTest {
    val c = controleur(FauxCerveau(), FaussesLunettes(), Reglages())
    c.demarrer()
    assertFalse(c.actif)
    assertTrue(c.etat.erreur!!.contains("adresse"))
  }

  @Test
  fun `lecture des reponses JSON du cerveau`() {
    val json =
        org.json.JSONObject(
            """{"sessionId":"s1","leconId":"L1","termine":false,
               "etape":{"index":1,"total":4,"titre":"Façonnage","consigne":"Roule.","clipUrl":null,
                        "clipLunettesUrl":null,"imageUrls":[]},
               "verdict":null,"afficher":"Roule.","dire":null,"ignore":false}""")
    val r = Retour.depuisJson(json)
    assertEquals(1, r.index)
    assertNull(r.clipLunettesUrl)
    assertNull(r.dire)
    assertNull(r.verdict)
  }

  @Test
  fun `commandes vocales en francais et en anglais`() {
    assertEquals(CommandeVocale.SUIVANT, commandeApprenti("Étape suivante"))
    assertEquals(CommandeVocale.SUIVANT, commandeApprenti("next"))
    assertEquals(CommandeVocale.PRECEDENT, commandeApprenti("Précédent"))
    assertEquals(CommandeVocale.REPETER, commandeApprenti("tu peux répéter"))
    assertEquals(CommandeVocale.VOIR_GESTE, commandeApprenti("montre moi"))
    assertNull(commandeApprenti("bonjour"))
    assertEquals(CommandeVocale.ETAPE_MAITRE, commandeMaitre("Nouvelle étape"))
    assertEquals(CommandeVocale.TERMINER_MAITRE, commandeMaitre("c'est fini"))
    assertNull(commandeMaitre("je rabats la pâte vers moi en appuyant avec la paume"))
  }
}
