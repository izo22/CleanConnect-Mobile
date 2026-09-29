package com.maitreapprenti.lunettes

import java.io.File
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test

class DecoupeurHevcTest {
  /** Fausse image HEVC : code de début + en-tête NAL (type 19 = image clé IDR, type 1 = image normale). */
  private fun image(cle: Boolean, marque: Int) =
      byteArrayOf(0, 0, 0, 1, if (cle) (19 shl 1).toByte() else (1 shl 1).toByte(), 1, marque.toByte())

  private val configuration = byteArrayOf(0, 0, 0, 1, (32 shl 1).toByte(), 1, 99)

  /** Ajoute `secondes` de vidéo à 15 images/s, avec une image clé par seconde. */
  private fun DecoupeurHevc.filmer(depuisS: Int, secondes: Int) {
    for (i in depuisS * 15 until (depuisS + secondes) * 15) {
      ajouter(image(cle = i % 15 == 0, marque = i), i * 1_000_000L / 15, estConfiguration = false)
    }
  }

  @Test
  fun `detecte les images cles et convertit le format longueur + unite`() {
    assertTrue(DecoupeurHevc.contientImageCle(image(true, 0)))
    assertFalse(DecoupeurHevc.contientImageCle(image(false, 0)))
    val hvcc = byteArrayOf(0, 0, 0, 3, (19 shl 1).toByte(), 1, 7)
    assertArrayEquals(image(true, 7), DecoupeurHevc.versAnnexeB(hvcc))
  }

  @Test
  fun `apprenti - les 4 dernieres secondes, en commencant par une image cle`() {
    val d = DecoupeurHevc(15)
    d.ajouter(configuration, 0, estConfiguration = true)
    d.filmer(0, 3)
    assertNull("pas encore 4 s", d.morceauRecent())
    d.filmer(3, 7) // 10 s au total
    val morceau = d.morceauRecent()!!
    // Configuration + de la seconde 5 (image clé) à la fin : 5 s × 15 images.
    assertEquals(configuration.size + 5 * 15 * 7, morceau.donnees.size)
    assertArrayEquals(configuration, morceau.donnees.copyOfRange(0, configuration.size))
    assertTrue(DecoupeurHevc.contientImageCle(morceau.donnees.copyOfRange(configuration.size, configuration.size + 7)))
    assertEquals(15, morceau.imagesParSeconde)
  }

  @Test
  fun `a la demande - les dernieres secondes sans vider le tampon`() {
    val d = DecoupeurHevc(15)
    assertNull(d.dernieresSecondes(6_000_000))
    d.ajouter(configuration, 0, estConfiguration = true)
    d.filmer(0, 10)
    // 6 s demandées : à partir de l'image clé de la seconde 3 (la dernière image est à 9,93 s).
    val morceau = d.dernieresSecondes(6_000_000)!!
    assertEquals(configuration.size + 7 * 15 * 7, morceau.donnees.size)
    assertEquals(morceau.donnees.size, d.dernieresSecondes(6_000_000)!!.donnees.size)
    // Plus que ce qui est filmé : tout le tampon.
    assertEquals(configuration.size + 10 * 15 * 7, d.dernieresSecondes(30_000_000)!!.donnees.size)
  }

  @Test
  fun `maitre - morceaux continus sans trou ni doublon`() {
    val d = DecoupeurHevc(15)
    d.filmer(0, 5)
    val premier = d.morceauContinu()!! // secondes 0 à 4 (jusqu'à l'image clé de la seconde 4, exclue)
    assertEquals(4 * 15 * 7, premier.donnees.size)
    assertNull(d.morceauContinu())
    d.filmer(5, 4)
    val second = d.morceauContinu()!! // secondes 4 à 8
    val reste = d.vider()!! // seconde 8
    assertEquals(9 * 15 * 7, premier.donnees.size + second.donnees.size + reste.donnees.size)
    assertNull(d.vider())
  }

  @Test
  fun `attend la premiere image cle et borne le tampon`() {
    val d = DecoupeurHevc(15, dureeMaxTamponUs = 6_000_000)
    d.ajouter(image(false, 1), 0, estConfiguration = false)
    assertEquals(0, d.duree())
    d.filmer(1, 30)
    assertTrue(d.duree() <= 7_000_000)
    d.reinitialiser()
    assertNull(d.vider())
  }

  /**
   * Avec une vraie vidéo HEVC (ffmpeg) découpée en images comme le font les lunettes :
   * chaque morceau produit doit se décoder. Nécessite la variable FFMPEG (sinon test ignoré).
   */
  @Test
  fun `les morceaux d une vraie video HEVC se decodent`() {
    val ffmpeg = System.getenv("FFMPEG")
    assumeTrue("FFMPEG non défini", ffmpeg != null && File(ffmpeg).canExecute())
    val source = File.createTempFile("source", ".hevc")
    try {
      executer(
          ffmpeg!!, "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=10:size=504x896:rate=15",
          "-c:v", "libx265", "-x265-params", "log-level=error:keyint=15", "-f", "hevc", source.path)
      val (config, images) = decouperEnImages(source.readBytes())
      val d = DecoupeurHevc(15)
      d.ajouter(config, 0, estConfiguration = true)
      images.forEachIndexed { i, img -> d.ajouter(img, i * 1_000_000L / 15, estConfiguration = false) }

      val recent = d.morceauRecent()!!
      val decodees = imagesDecodees(ffmpeg, recent.donnees)
      assertTrue("images décodées : $decodees", decodees in 60..75)
    } finally {
      source.delete()
    }
  }

  // --- Outils du test : découpe d'un flux HEVC brut en images, décodage par ffmpeg ----------

  private fun executer(vararg commande: String): String {
    val p = ProcessBuilder(*commande).redirectErrorStream(true).start()
    val sortie = p.inputStream.bufferedReader().readText()
    check(p.waitFor() == 0) { sortie }
    return sortie
  }

  private fun imagesDecodees(ffmpeg: String, hevc: ByteArray): Int {
    val f = File.createTempFile("morceau", ".hevc")
    try {
      f.writeBytes(hevc)
      val sortie = executer(ffmpeg, "-hide_banner", "-f", "hevc", "-framerate", "15", "-i", f.path, "-f", "null", "-")
      return Regex("frame=\\s*(\\d+)").findAll(sortie).last().groupValues[1].toInt()
    } finally {
      f.delete()
    }
  }

  /** Sépare configuration (VPS/SPS/PPS) et images (une par « première tranche »). */
  private fun decouperEnImages(flux: ByteArray): Pair<ByteArray, List<ByteArray>> {
    val debuts = mutableListOf<Int>()
    var i = 0
    while (i + 3 < flux.size) {
      if (flux[i] == 0.toByte() && flux[i + 1] == 0.toByte() && flux[i + 2] == 0.toByte() && flux[i + 3] == 1.toByte()) {
        debuts += i
        i += 4
      } else if (flux[i] == 0.toByte() && flux[i + 1] == 0.toByte() && flux[i + 2] == 1.toByte()) {
        debuts += i
        i += 3
      } else {
        i++
      }
    }
    val unites = debuts.mapIndexed { n, d -> flux.copyOfRange(d, if (n + 1 < debuts.size) debuts[n + 1] else flux.size) }
    fun type(u: ByteArray): Int {
      val p = if (u[2] == 1.toByte()) 3 else 4
      return (u[p].toInt() shr 1) and 0x3F
    }
    fun premiereTranche(u: ByteArray): Boolean {
      val p = if (u[2] == 1.toByte()) 3 else 4
      return (u[p + 2].toInt() and 0x80) != 0
    }
    var config = ByteArray(0)
    val images = mutableListOf<ByteArray>()
    var courante = ByteArray(0)
    for (u in unites) {
      val t = type(u)
      when {
        t in 32..34 -> if (images.isEmpty() && courante.isEmpty()) config += u else courante += u
        t < 32 && premiereTranche(u) -> {
          if (courante.isNotEmpty() && courante.any { it != 0.toByte() }) images += courante
          courante = u
        }
        else -> courante += u
      }
    }
    if (courante.isNotEmpty()) images += courante
    return config to images
  }
}
