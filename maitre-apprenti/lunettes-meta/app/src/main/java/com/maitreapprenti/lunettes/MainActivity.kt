package com.maitreapprenti.lunettes

import android.Manifest.permission.BLUETOOTH
import android.Manifest.permission.BLUETOOTH_CONNECT
import android.Manifest.permission.INTERNET
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions
import androidx.lifecycle.lifecycleScope
import com.meta.wearable.dat.core.Wearables
import com.meta.wearable.dat.core.types.Permission
import com.meta.wearable.dat.core.types.PermissionStatus
import com.meta.wearable.dat.core.types.RegistrationState
import kotlin.coroutines.resume
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Écran du téléphone : réglages (adresse du cerveau, leçon ou démonstration), connexion aux
 * lunettes, démarrage. Pendant la leçon, tout se passe dans les lunettes ; cet écran suit l'état.
 */
class MainActivity : ComponentActivity() {
  private lateinit var controleur: Controleur
  private lateinit var lunettes: LunettesMeta
  private var lecons: List<ResumeLecon> = emptyList()

  // --- Autorisations ---------------------------------------------------------------

  private val autorisationsAndroid =
      registerForActivityResult(RequestMultiplePermissions()) { resultats ->
        if (resultats.values.all { it }) {
          // Obligatoire avant tout appel au SDK des lunettes.
          Wearables.initialize(this).onFailure { erreur, _ -> toast("SDK Meta : ${erreur.description}") }
          suivreEnregistrement()
        } else {
          toast("Les autorisations Bluetooth sont nécessaires pour les lunettes")
        }
      }

  private var suiteAutorisation: CancellableContinuation<PermissionStatus>? = null
  private val verrouAutorisation = Mutex()
  // Les autorisations des lunettes (caméra, micro) se donnent dans l'appli Meta AI.
  private val autorisationLunettes =
      registerForActivityResult(Wearables.RequestPermissionContract()) { resultat ->
        suiteAutorisation?.resume(resultat.getOrDefault(PermissionStatus.Denied))
        suiteAutorisation = null
      }

  private suspend fun demanderAutorisation(permission: Permission): PermissionStatus =
      verrouAutorisation.withLock {
        suspendCancellableCoroutine { suite ->
          suiteAutorisation = suite
          suite.invokeOnCancellation { suiteAutorisation = null }
          autorisationLunettes.launch(permission)
        }
      }

  // --- Vues ------------------------------------------------------------------------

  private lateinit var champUrl: EditText
  private lateinit var champCle: EditText
  private lateinit var choixMode: RadioGroup
  private lateinit var blocApprenti: LinearLayout
  private lateinit var listeLecons: Spinner
  private lateinit var champApprenti: EditText
  private lateinit var blocMaitre: LinearLayout
  private lateinit var champTitre: EditText
  private lateinit var champMetier: EditText
  private lateinit var texteConnexion: TextView
  private lateinit var boutonConnexion: Button
  private lateinit var boutonDemarrer: Button
  private lateinit var texteEtape: TextView
  private lateinit var texteMessage: TextView
  private lateinit var texteErreur: TextView
  private lateinit var commandesApprenti: LinearLayout

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val reglages = lireReglages()

    lunettes =
        LunettesMeta(
            context = this,
            scope = lifecycleScope,
            demanderAutorisation = ::demanderAutorisation,
            surConnexion = { texte -> runOnUiThread { texteConnexion.text = texte } },
            surPhrase = { phrase -> lifecycleScope.launch { controleur.entendu(phrase) } },
            surBouton = { bouton ->
              lifecycleScope.launch {
                when (bouton) {
                  BoutonLunettes.VOIR_GESTE -> controleur.montrerGeste()
                  BoutonLunettes.SUIVANT ->
                      if (controleur.actif && reglagesActuels().mode == Mode.MAITRE) controleur.marquerEtape()
                      else controleur.commande("suivant")
                  BoutonLunettes.REPETER -> controleur.commande("repeter")
                }
              }
            },
        )
    controleur = Controleur(lifecycleScope, lunettes, reglages, { etat -> runOnUiThread { afficherEtat(etat) } })

    construireVues(reglages)
    afficherEtat(controleur.etat)
    if (reglages.urlCerveau.isNotBlank()) chargerLecons(reglages.leconId)
  }

  override fun onStart() {
    super.onStart()
    autorisationsAndroid.launch(arrayOf(BLUETOOTH, BLUETOOTH_CONNECT, INTERNET))
  }

  override fun onDestroy() {
    super.onDestroy()
    controleur.arreter()
    lunettes.liberer()
  }

  private fun suivreEnregistrement() {
    lifecycleScope.launch {
      Wearables.registrationState.collect { etat ->
        boutonConnexion.text =
            if (etat == RegistrationState.REGISTERED) "Connecter les lunettes" else "Associer l'appli aux lunettes"
      }
    }
  }

  private fun connecterLunettes() {
    if (Wearables.registrationState.value != RegistrationState.REGISTERED) {
      // Ouvre l'appli Meta AI pour autoriser cette appli à utiliser les lunettes.
      Wearables.startRegistration(this)
      return
    }
    lunettes.connecter()
  }

  // --- Réglages --------------------------------------------------------------------

  private fun lireReglages(): Reglages {
    val p = getSharedPreferences("reglages", MODE_PRIVATE)
    return Reglages(
        urlCerveau = p.getString("urlCerveau", "") ?: "",
        cle = p.getString("cle", "") ?: "",
        mode = if (p.getString("mode", "") == "maitre") Mode.MAITRE else Mode.APPRENTI,
        leconId = p.getString("leconId", "") ?: "",
        apprenti = p.getString("apprenti", "") ?: "",
        titreDemo = p.getString("titreDemo", "") ?: "",
        metierDemo = p.getString("metierDemo", "") ?: "",
    )
  }

  private fun reglagesActuels() =
      Reglages(
          urlCerveau = champUrl.text.toString().trim(),
          cle = champCle.text.toString(),
          mode = if (choixMode.checkedRadioButtonId == ID_MAITRE) Mode.MAITRE else Mode.APPRENTI,
          leconId = lecons.getOrNull(listeLecons.selectedItemPosition)?.id ?: "",
          apprenti = champApprenti.text.toString().trim(),
          titreDemo = champTitre.text.toString().trim(),
          metierDemo = champMetier.text.toString().trim(),
      )

  private fun enregistrerReglages() {
    val r = reglagesActuels()
    getSharedPreferences("reglages", MODE_PRIVATE)
        .edit()
        .putString("urlCerveau", r.urlCerveau)
        .putString("cle", r.cle)
        .putString("mode", if (r.mode == Mode.MAITRE) "maitre" else "apprenti")
        .putString("leconId", r.leconId)
        .putString("apprenti", r.apprenti)
        .putString("titreDemo", r.titreDemo)
        .putString("metierDemo", r.metierDemo)
        .apply()
    controleur.changerReglages(r)
  }

  private fun chargerLecons(aSelectionner: String) {
    val r = reglagesActuels()
    if (r.urlCerveau.isBlank()) return toast("Indique d'abord l'adresse du cerveau")
    lifecycleScope.launch {
      try {
        lecons = CerveauHttp(r.urlCerveau, r.cle).lecons().filter { it.prete }
        listeLecons.adapter =
            ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                lecons.map { "${it.titre} (${it.metier})" })
        val index = lecons.indexOfFirst { it.id == aSelectionner }
        if (index >= 0) listeLecons.setSelection(index)
        if (lecons.isEmpty()) toast("Aucune leçon prête sur le cerveau")
      } catch (e: Exception) {
        toast("Cerveau injoignable : ${e.message}")
      }
    }
  }

  // --- Affichage -------------------------------------------------------------------

  private fun afficherEtat(etat: Etat) {
    boutonDemarrer.text = if (etat.actif) "Pause" else "Démarrer"
    texteEtape.text = etat.etape
    texteMessage.text = etat.message
    texteErreur.text = etat.erreur ?: ""
    texteErreur.visibility = if (etat.erreur == null) View.GONE else View.VISIBLE
    commandesApprenti.visibility =
        if (etat.actif && choixMode.checkedRadioButtonId == ID_APPRENTI) View.VISIBLE else View.GONE
  }

  private fun toast(texte: String) = Toast.makeText(this, texte, Toast.LENGTH_LONG).show()

  private fun construireVues(reglages: Reglages) {
    val marge = (16 * resources.displayMetrics.density).toInt()
    val racine = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(marge, marge * 2, marge, marge)
    }
    fun titre(texte: String) =
        TextView(this).apply {
          text = texte
          textSize = 18f
          setPadding(0, marge, 0, marge / 4)
        }
    fun champ(indice: String, valeur: String, motDePasse: Boolean = false) =
        EditText(this).apply {
          hint = indice
          setText(valeur)
          inputType =
              if (motDePasse) InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
              else InputType.TYPE_CLASS_TEXT
        }
    fun bouton(texte: String, action: () -> Unit) = Button(this).apply {
      text = texte
      setOnClickListener { action() }
    }
    fun ligne(vararg vues: View) = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      vues.forEach { addView(it, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)) }
    }

    racine.addView(TextView(this).apply {
      text = "Maître & Apprenti"
      textSize = 26f
    })

    racine.addView(titre("Cerveau"))
    champUrl = champ("https://mon-serveur.fr", reglages.urlCerveau).apply {
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
    }
    champCle = champ("Clé d'accès (si demandée)", reglages.cle, motDePasse = true)
    racine.addView(champUrl)
    racine.addView(champCle)

    racine.addView(titre("Mode"))
    choixMode = RadioGroup(this).apply {
      orientation = RadioGroup.HORIZONTAL
      addView(RadioButton(this@MainActivity).apply {
        id = ID_APPRENTI
        text = "Je suis apprenti"
      })
      addView(RadioButton(this@MainActivity).apply {
        id = ID_MAITRE
        text = "Je suis le maître"
      })
      check(if (reglages.mode == Mode.MAITRE) ID_MAITRE else ID_APPRENTI)
    }
    racine.addView(choixMode)

    listeLecons = Spinner(this)
    champApprenti = champ("Ton prénom", reglages.apprenti).apply {
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
    }
    blocApprenti = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      addView(champApprenti)
      addView(listeLecons)
      addView(bouton("Charger les leçons") { chargerLecons(reglagesActuels().leconId) })
    }
    champTitre = champ("Titre de la démonstration (ex. Croissant)", reglages.titreDemo)
    champMetier = champ("Métier (ex. Boulangerie)", reglages.metierDemo)
    blocMaitre = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      addView(champTitre)
      addView(champMetier)
    }
    racine.addView(blocApprenti)
    racine.addView(blocMaitre)
    fun majBlocs() {
      val maitre = choixMode.checkedRadioButtonId == ID_MAITRE
      blocMaitre.visibility = if (maitre) View.VISIBLE else View.GONE
      blocApprenti.visibility = if (maitre) View.GONE else View.VISIBLE
    }
    choixMode.setOnCheckedChangeListener { _, _ -> majBlocs() }
    majBlocs()

    racine.addView(bouton("Enregistrer les réglages") { enregistrerReglages() })

    racine.addView(titre("Lunettes"))
    texteConnexion = TextView(this).apply { text = "Lunettes non connectées" }
    boutonConnexion = bouton("Connecter les lunettes") { connecterLunettes() }
    racine.addView(texteConnexion)
    racine.addView(boutonConnexion)

    racine.addView(titre("Leçon"))
    boutonDemarrer = bouton("Démarrer") {
      if (controleur.actif) {
        controleur.arreter()
      } else if (!lunettes.connectees) {
        toast("Connecte d'abord les lunettes")
      } else {
        enregistrerReglages()
        lifecycleScope.launch { controleur.demarrer() }
      }
    }
    racine.addView(boutonDemarrer)
    texteEtape = TextView(this).apply { textSize = 16f }
    texteMessage = TextView(this).apply { textSize = 18f }
    texteErreur = TextView(this).apply { setTextColor(0xFFA8471C.toInt()) }
    racine.addView(texteEtape)
    racine.addView(texteMessage)
    racine.addView(texteErreur)

    commandesApprenti = ligne(
        bouton("←") { lifecycleScope.launch { controleur.commande("precedent") } },
        bouton("Répéter") { lifecycleScope.launch { controleur.commande("repeter") } },
        bouton("Geste") { controleur.montrerGeste() },
        bouton("→") { lifecycleScope.launch { controleur.commande("suivant") } },
    )
    racine.addView(commandesApprenti)
    racine.addView(bouton("Terminer la démonstration") {
      lifecycleScope.launch { controleur.terminerDemonstration() }
    }.apply {
      // Visible seulement en mode maître.
      choixMode.setOnCheckedChangeListener { _, id ->
        majBlocs()
        visibility = if (id == ID_MAITRE) View.VISIBLE else View.GONE
      }
      visibility = if (reglages.mode == Mode.MAITRE) View.VISIBLE else View.GONE
    })

    setContentView(ScrollView(this).apply { addView(racine) })
  }

  private companion object {
    const val ID_APPRENTI = 1001
    const val ID_MAITRE = 1002
  }
}
