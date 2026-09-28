package com.maitreapprenti.lunettes

import java.text.Normalizer

/** Commandes vocales reconnues. La reconnaissance des lunettes peut être en français ou en anglais. */
enum class CommandeVocale {
  SUIVANT,
  PRECEDENT,
  REPETER,
  RECOMMENCER,
  PAUSE,
  VOIR_GESTE,
  ETAPE_MAITRE,
  TERMINER_MAITRE,
}

private fun normaliser(texte: String): String =
    Normalizer.normalize(texte.lowercase(), Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "")
        .replace(Regex("[^a-z' ]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

private fun contient(texte: String, vararg mots: String) =
    mots.any { Regex("\\b$it\\b").containsMatchIn(texte) }

/** Commande courte de l'apprenti ; les phrases longues (plus de 4 mots) sont ignorées. */
fun commandeApprenti(phrase: String): CommandeVocale? {
  val t = normaliser(phrase)
  if (t.isEmpty() || t.split(" ").size > 4) return null
  return when {
    contient(t, "suivant", "suivante", "next") -> CommandeVocale.SUIVANT
    contient(t, "precedent", "precedente", "retour", "back", "previous") -> CommandeVocale.PRECEDENT
    contient(t, "repete", "repeter", "redis", "repeat") -> CommandeVocale.REPETER
    contient(t, "recommence", "recommencer", "restart") -> CommandeVocale.RECOMMENCER
    contient(t, "montre", "geste", "video", "show") -> CommandeVocale.VOIR_GESTE
    contient(t, "pause", "stop", "arrete") -> CommandeVocale.PAUSE
    else -> null
  }
}

/** Commandes du maître pendant sa démonstration ; le reste de ce qu'il dit est son explication. */
fun commandeMaitre(phrase: String): CommandeVocale? {
  val t = normaliser(phrase)
  if (t.isEmpty() || t.split(" ").size > 5) return null
  return when {
    contient(t, "etape suivante", "nouvelle etape", "suivant", "next step") -> CommandeVocale.ETAPE_MAITRE
    contient(t, "termine", "terminee", "fini", "finie", "finished", "done") -> CommandeVocale.TERMINER_MAITRE
    else -> null
  }
}
