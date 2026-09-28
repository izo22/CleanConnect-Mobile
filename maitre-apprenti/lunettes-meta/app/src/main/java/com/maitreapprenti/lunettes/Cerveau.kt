package com.maitreapprenti.lunettes

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/** Réponse du cerveau après une image ou une commande (voir cerveau/src/types.ts, type Retour). */
data class Retour(
    val sessionId: String,
    val termine: Boolean,
    val index: Int,
    val total: Int,
    val titre: String,
    val consigne: String,
    /** Adresse relative du petit clip du maître pour l'écran des lunettes, s'il existe. */
    val clipLunettesUrl: String?,
    val verdict: String?,
    val afficher: String,
    val dire: String?,
    val ignore: Boolean,
) {
  companion object {
    fun depuisJson(json: JSONObject): Retour {
      val etape = json.getJSONObject("etape")
      return Retour(
          sessionId = json.getString("sessionId"),
          termine = json.getBoolean("termine"),
          index = etape.getInt("index"),
          total = etape.getInt("total"),
          titre = etape.getString("titre"),
          consigne = etape.getString("consigne"),
          clipLunettesUrl = etape.optChaine("clipLunettesUrl"),
          verdict = json.optChaine("verdict"),
          afficher = json.getString("afficher"),
          dire = json.optChaine("dire"),
          ignore = json.optBoolean("ignore", false),
      )
    }
  }
}

data class ResumeLecon(val id: String, val titre: String, val metier: String, val prete: Boolean)

/** Lit une chaîne qui peut valoir null en JSON (optString renverrait "null"). */
private fun JSONObject.optChaine(nom: String): String? =
    if (isNull(nom)) null else optString(nom).ifEmpty { null }

/** Ce dont le contrôleur a besoin du cerveau. Interface pour pouvoir le remplacer dans les tests. */
interface ApiCerveau {
  suspend fun lecons(): List<ResumeLecon>

  suspend fun creerSession(leconId: String): Retour

  suspend fun etatSession(sessionId: String): Retour

  suspend fun envoyerImage(sessionId: String, jpeg: ByteArray): Retour

  suspend fun commande(sessionId: String, commande: String): Retour

  suspend fun creerCapture(titre: String, metier: String): String

  suspend fun envoyerImageCapture(captureId: String, jpeg: ByteArray)

  suspend fun parole(captureId: String, texte: String)

  suspend fun marquerEtape(captureId: String)

  suspend fun terminerCapture(captureId: String)

  /** Adresse complète d'un média renvoyé par le cerveau (les clips ont des adresses relatives). */
  fun urlComplete(chemin: String): String
}

class ErreurCerveau(message: String) : IOException(message)

/** Client HTTP du cerveau, sans dépendance externe (HttpURLConnection + org.json d'Android). */
class CerveauHttp(urlCerveau: String, private val cle: String) : ApiCerveau {
  private val base = urlCerveau.trim().trimEnd('/')

  private suspend fun appel(
      methode: String,
      chemin: String,
      corps: ByteArray? = null,
      typeCorps: String = "application/json",
  ): String =
      withContext(Dispatchers.IO) {
        val connexion = URI("$base/api$chemin").toURL().openConnection() as HttpURLConnection
        try {
          connexion.requestMethod = methode
          connexion.connectTimeout = 10_000
          // L'analyse d'une image par l'IA prend quelques secondes.
          connexion.readTimeout = 60_000
          connexion.setRequestProperty("x-cle", cle)
          if (corps != null) {
            connexion.doOutput = true
            connexion.setRequestProperty("content-type", typeCorps)
            connexion.outputStream.use { it.write(corps) }
          }
          val code = connexion.responseCode
          val flux = if (code in 200..299) connexion.inputStream else connexion.errorStream
          val texte = flux?.bufferedReader()?.use { it.readText() } ?: ""
          if (code !in 200..299) {
            val message = runCatching { JSONObject(texte).optString("erreur") }.getOrNull()
            throw ErreurCerveau(message?.ifEmpty { null } ?: "Erreur $code du cerveau")
          }
          texte
        } finally {
          connexion.disconnect()
        }
      }

  private suspend fun post(chemin: String, json: JSONObject = JSONObject()): String =
      appel("POST", chemin, json.toString().toByteArray())

  override suspend fun lecons(): List<ResumeLecon> {
    val liste = JSONArray(appel("GET", "/lecons"))
    return (0 until liste.length()).map { i ->
      val l = liste.getJSONObject(i)
      ResumeLecon(l.getString("id"), l.getString("titre"), l.getString("metier"), l.getString("statut") == "prete")
    }
  }

  override suspend fun creerSession(leconId: String) =
      Retour.depuisJson(JSONObject(post("/sessions", JSONObject().put("leconId", leconId))))

  override suspend fun etatSession(sessionId: String) =
      Retour.depuisJson(JSONObject(appel("GET", "/sessions/$sessionId")))

  override suspend fun envoyerImage(sessionId: String, jpeg: ByteArray) =
      Retour.depuisJson(JSONObject(appel("POST", "/sessions/$sessionId/image", jpeg, "image/jpeg")))

  override suspend fun commande(sessionId: String, commande: String) =
      Retour.depuisJson(
          JSONObject(post("/sessions/$sessionId/commande", JSONObject().put("commande", commande))))

  override suspend fun creerCapture(titre: String, metier: String): String =
      JSONObject(post("/captures", JSONObject().put("titre", titre).put("metier", metier)))
          .getString("captureId")

  override suspend fun envoyerImageCapture(captureId: String, jpeg: ByteArray) {
    appel("POST", "/captures/$captureId/image", jpeg, "image/jpeg")
  }

  override suspend fun parole(captureId: String, texte: String) {
    post("/captures/$captureId/parole", JSONObject().put("texte", texte))
  }

  override suspend fun marquerEtape(captureId: String) {
    post("/captures/$captureId/etape")
  }

  override suspend fun terminerCapture(captureId: String) {
    post("/captures/$captureId/terminer")
  }

  override fun urlComplete(chemin: String) = if (chemin.startsWith("http")) chemin else "$base$chemin"
}
