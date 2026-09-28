package com.maitreapprenti.lunettes

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.speech.tts.TextToSpeech
import android.util.Log
import com.meta.wearable.dat.camera.Camera
import com.meta.wearable.dat.camera.addCamera
import com.meta.wearable.dat.camera.types.PhotoData
import com.meta.wearable.dat.camera.types.StreamConfiguration
import com.meta.wearable.dat.camera.types.StreamState
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
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout

/** Boutons affichés sur l'écran des lunettes (les appuis reviennent au téléphone). */
enum class BoutonLunettes {
  VOIR_GESTE,
  SUIVANT,
  REPETER,
}

/**
 * Branche le contrôleur sur les lunettes Meta via le Wearables Device Access Toolkit :
 * caméra (photos), écran des Ray-Ban Display (étape, correction, clip du maître),
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
      // Caméra : flux à faible cadence, on n'en tire que des photos.
      if (camera == null && autorise(Permission.CAMERA)) {
        session
            .addCamera(StreamConfiguration(videoQuality = VideoQuality.MEDIUM, frameRate = 2))
            .onSuccess { ajoutee ->
              camera = ajoutee
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

  override suspend fun prendrePhoto(): ByteArray {
    val flux = camera?.stream ?: throw IOException("Caméra des lunettes non connectée")
    // Au démarrage, on laisse au flux le temps de démarrer.
    withTimeout(10_000) { flux.state.first { it == StreamState.STREAMING } }
    val photo =
        flux.capturePhoto().getOrNull() ?: throw IOException("La photo des lunettes a échoué")
    return withContext(Dispatchers.Default) { enJpeg(photo) }
  }

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
              if (ecran.clipUrl != null) {
                button(
                    label = "Voir le geste",
                    style = ButtonStyle.PRIMARY,
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

  // --- Conversion des photos -------------------------------------------------------------

  private fun enJpeg(photo: PhotoData): ByteArray {
    val image =
        when (photo) {
          is PhotoData.Bitmap -> photo.bitmap
          is PhotoData.HEIC -> decoderHeic(photo)
        }
    // 1024 px de large suffisent à l'IA et allègent l'envoi.
    val reduite =
        if (image.width > 1024) {
          Bitmap.createScaledBitmap(image, 1024, image.height * 1024 / image.width, true)
        } else {
          image
        }
    return ByteArrayOutputStream().use { sortie ->
      reduite.compress(Bitmap.CompressFormat.JPEG, 85, sortie)
      sortie.toByteArray()
    }
  }

  private fun decoderHeic(photo: PhotoData.HEIC): Bitmap {
    val tampon = photo.data.duplicate().apply { rewind() }
    val octets = ByteArray(tampon.remaining()).also { tampon.get(it) }
    val image =
        BitmapFactory.decodeByteArray(octets, 0, octets.size) ?: throw IOException("Photo illisible")
    // Les lunettes enregistrent l'orientation dans les données EXIF, non appliquées au décodage.
    val rotation =
        when (ExifInterface(ByteArrayInputStream(octets)).getAttributeInt(
            ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90f
          ExifInterface.ORIENTATION_ROTATE_180 -> 180f
          ExifInterface.ORIENTATION_ROTATE_270 -> 270f
          else -> 0f
        }
    if (rotation == 0f) return image
    val matrice = Matrix().apply { postRotate(rotation) }
    return Bitmap.createBitmap(image, 0, 0, image.width, image.height, matrice, true)
  }

  private companion object {
    const val TAG = "MaitreApprenti"
  }
}
