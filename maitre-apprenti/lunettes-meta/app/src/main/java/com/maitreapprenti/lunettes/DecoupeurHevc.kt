package com.maitreapprenti.lunettes

import java.io.ByteArrayOutputStream

/** Un morceau de vidéo à envoyer au cerveau. */
class MorceauVideo(val donnees: ByteArray, val imagesParSeconde: Int, val type: String = "video/hevc")

/**
 * Assemble les images HEVC compressées reçues des lunettes en morceaux de vidéo lisibles.
 *
 * Un morceau commence toujours par une image clé (sinon rien n'est décodable) et par la
 * configuration du codec (paramètres VPS/SPS/PPS, envoyés une seule fois au début du flux).
 * Deux usages :
 * - [morceauRecent] (apprenti) : les dernières secondes seulement, le reste est jeté ;
 * - [morceauContinu] (maître) : toute la vidéo, découpée sans trou entre deux images clés.
 */
class DecoupeurHevc(
    private val imagesParSeconde: Int,
    private val dureeMorceauUs: Long = 4_000_000,
    private val dureeMaxTamponUs: Long = 20_000_000,
) {
  private class Image(val donnees: ByteArray, val ptsUs: Long, val cle: Boolean)

  private var configuration: ByteArray? = null
  private val images = ArrayDeque<Image>()

  @Synchronized
  fun ajouter(donnees: ByteArray, ptsUs: Long, estConfiguration: Boolean) {
    val annexeB = versAnnexeB(donnees)
    if (estConfiguration) {
      configuration = annexeB
      return
    }
    val cle = contientImageCle(annexeB)
    // Sans image clé au début, le morceau serait illisible : on attend la première.
    if (images.isEmpty() && !cle) return
    images.addLast(Image(annexeB, ptsUs, cle))
    // Tampon borné (au cas où personne ne vient chercher les morceaux) : on garde à partir
    // de l'image clé la plus ancienne qui reste dans la fenêtre.
    val limite = ptsUs - dureeMaxTamponUs
    while (images.size > 1 && images.first().ptsUs < limite) {
      val suivanteCle = images.indexOfFirst { it !== images.first() && it.cle }
      if (suivanteCle <= 0 || images[suivanteCle].ptsUs > limite) break
      repeat(suivanteCle) { images.removeFirst() }
    }
  }

  /** Durée couverte par le tampon, en microsecondes. */
  @Synchronized fun duree(): Long = if (images.isEmpty()) 0 else images.last().ptsUs - images.first().ptsUs

  /**
   * Apprenti : renvoie les ~4 dernières secondes (à partir de la dernière image clé qui les
   * couvre), ou null s'il n'y a pas encore assez de vidéo. Le tampon repart de la dernière image clé.
   */
  @Synchronized
  fun morceauRecent(): MorceauVideo? {
    if (duree() < dureeMorceauUs) return null
    val fin = images.last().ptsUs
    val debut =
        images.indices.lastOrNull { images[it].cle && fin - images[it].ptsUs >= dureeMorceauUs }
            ?: images.indices.first { images[it].cle }
    val morceau = assembler(images.subList(debut, images.size))
    garderDepuisDerniereCle()
    return morceau
  }

  /**
   * Maître : renvoie la vidéo depuis la dernière coupe jusqu'à la dernière image clé (exclue),
   * si cela fait au moins la durée d'un morceau. La suite reste dans le tampon : aucun trou.
   */
  @Synchronized
  fun morceauContinu(): MorceauVideo? {
    val derniereCle = images.indices.lastOrNull { it > 0 && images[it].cle } ?: return null
    if (images[derniereCle].ptsUs - images.first().ptsUs < dureeMorceauUs) return null
    val morceau = assembler(images.subList(0, derniereCle))
    repeat(derniereCle) { images.removeFirst() }
    return morceau
  }

  /**
   * Analyse à la demande : les [dureeUs] dernières microsecondes (à partir de l'image clé qui les
   * couvre, ou du début du tampon), sans rien retirer du tampon. Null si le tampon est vide.
   */
  @Synchronized
  fun dernieresSecondes(dureeUs: Long): MorceauVideo? {
    if (images.isEmpty()) return null
    val fin = images.last().ptsUs
    val debut = images.indices.lastOrNull { images[it].cle && fin - images[it].ptsUs >= dureeUs } ?: 0
    return assembler(images.subList(debut, images.size))
  }

  /** Repart de zéro (nouvelle leçon ou démonstration) ; la configuration du codec est gardée. */
  @Synchronized fun reinitialiser() = images.clear()

  /** Tout ce qui reste (fin de la démonstration), ou null si le tampon est vide. */
  @Synchronized
  fun vider(): MorceauVideo? {
    if (images.isEmpty()) return null
    val morceau = assembler(images)
    images.clear()
    return morceau
  }

  private fun garderDepuisDerniereCle() {
    val derniereCle = images.indices.last { images[it].cle }
    repeat(derniereCle) { images.removeFirst() }
  }

  private fun assembler(selection: List<Image>): MorceauVideo {
    val sortie = ByteArrayOutputStream()
    configuration?.let { sortie.write(it) }
    selection.forEach { sortie.write(it.donnees) }
    return MorceauVideo(sortie.toByteArray(), imagesParSeconde)
  }

  companion object {
    private val CODE_DEBUT = byteArrayOf(0, 0, 0, 1)

    /** Positions (après le code de début) de chaque unité NAL d'un flux Annexe B. */
    private fun unitesNal(donnees: ByteArray): List<Int> {
      val positions = mutableListOf<Int>()
      var i = 0
      while (i + 2 < donnees.size) {
        if (donnees[i] == 0.toByte() && donnees[i + 1] == 0.toByte() && donnees[i + 2] == 1.toByte()) {
          positions += i + 3
          i += 3
        } else {
          i++
        }
      }
      return positions
    }

    /** Vrai si l'image contient une image clé HEVC (types NAL 16 à 21 : IDR, CRA, BLA). */
    fun contientImageCle(annexeB: ByteArray): Boolean =
        unitesNal(annexeB).any { p -> p < annexeB.size && ((annexeB[p].toInt() shr 1) and 0x3F) in 16..21 }

    /**
     * Le format attendu par ffmpeg est l'Annexe B (unités séparées par 00 00 01). Si les
     * lunettes livrent le format « longueur + unité » (HVCC), on le convertit.
     */
    fun versAnnexeB(donnees: ByteArray): ByteArray {
      if (donnees.size >= 3 && donnees[0] == 0.toByte() && donnees[1] == 0.toByte() &&
          (donnees[2] == 1.toByte() || (donnees.size >= 4 && donnees[2] == 0.toByte() && donnees[3] == 1.toByte()))) {
        return donnees
      }
      val sortie = ByteArrayOutputStream()
      var i = 0
      while (i + 4 <= donnees.size) {
        val longueur =
            ((donnees[i].toInt() and 0xFF) shl 24) or ((donnees[i + 1].toInt() and 0xFF) shl 16) or
                ((donnees[i + 2].toInt() and 0xFF) shl 8) or (donnees[i + 3].toInt() and 0xFF)
        if (longueur <= 0 || i + 4 + longueur > donnees.size) return donnees // format inconnu : tel quel
        sortie.write(CODE_DEBUT)
        sortie.write(donnees, i + 4, longueur)
        i += 4 + longueur
      }
      return if (i == donnees.size) sortie.toByteArray() else donnees
    }
  }
}
