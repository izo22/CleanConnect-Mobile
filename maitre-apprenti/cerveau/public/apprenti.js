import { api, cleAcces, el } from "./commun.js";
import { afficherControle, controlerCamera } from "./controle.js";
import { commandeApprenti, Ecoute, reconnaissanceDisponible } from "./voix.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");

let sessionId = null;
let flux = null;
let clipActuel = null;
let imageRefIndex = 0;
let minuterieImages = null;
let dernierMessageDit = null;
let etapesLecon = [];
/** Mode caméra de la tablette : l'enregistrement en cours, et la commande à envoyer avec lui. */
let enregistreurActuel = null;
let commandeEnAttente = null;
let etapeActuelle = null;
/** Fin de la dernière phrase dite par l'appareil : on n'écoute pas sa propre voix. */
let finDerniereParole = 0;

// --- Affichage d'un retour du cerveau -------------------------------------------

function afficher(retour) {
  $("choix").classList.add("cache");
  $("lecon").classList.remove("cache");
  const { etape } = retour;
  $("etape-num").textContent = retour.termine ? "Terminé" : `Étape ${etape.index + 1} / ${etape.total}`;
  $("barre").style.width = `${(100 * (retour.termine ? etape.total : etape.index)) / etape.total}%`;
  $("consigne").textContent = `${etape.titre} — ${etape.consigne}`;
  $("retour").textContent = retour.afficher;
  $("retour").className = `retour ${retour.verdict ?? ""}`;
  afficherDemo(etape);
  afficherTexte(etape);
  etapeActuelle = etape;
  afficherGuide();
  afficherPlan(retour.termine ? etape.total : etape.index);
  $("verifier").disabled = retour.termine;
  $("mode-analyse").textContent =
    etape.analyse === "continu"
      ? "Étape surveillée : l'IA regarde en continu pendant cette étape."
      : `L'IA regarde les ${etape.fenetreS} dernières secondes quand tu demandes (ou quand tu dis « vérifie » avec les lunettes).`;

  if (retour.dire && $("voix").checked && retour.dire !== dernierMessageDit) {
    dernierMessageDit = retour.dire;
    speechSynthesis.cancel();
    const phrase = new SpeechSynthesisUtterance(retour.dire);
    phrase.lang = "fr-FR";
    phrase.onend = () => (finDerniereParole = Date.now());
    speechSynthesis.speak(phrase);
  }
}

/** Le texte écrit de l'étape : explication, points clés, erreurs à éviter, paroles du maître. */
function afficherTexte(etape) {
  const liste = (titre, elements, classe) =>
    elements?.length
      ? el("div", { classe: `bloc-liste ${classe}` }, el("h3", {}, titre), el("ul", {}, ...elements.map((e) => el("li", {}, e))))
      : null;
  $("texte-etape").replaceChildren(
    el("p", {}, etape.explication),
    el("div", { classe: "listes" },
      liste("Points clés", etape.pointsDeControle, "cles"),
      liste("À éviter", etape.erreursFrequentes, "eviter"),
      liste("C'est réussi quand", etape.criteresDeReussite, "reussi")),
    etape.paroles?.length
      ? el("div", { classe: "paroles" }, el("h3", {}, "Le maître dit"), ...etape.paroles.map((p) => el("blockquote", {}, `« ${p} »`)))
      : null,
  );
}

/** Le plan de la leçon : étapes faites, en cours, à venir. */
function afficherPlan(indexActuel) {
  $("plan").replaceChildren(...etapesLecon.map((e, i) =>
    el("li", { classe: i < indexActuel ? "faite" : i === indexActuel ? "actuelle" : "", ...(i === indexActuel ? { "aria-current": "step" } : {}) }, e.titre)));
}

/** Le clip du maître en boucle, ou ses images de référence en diaporama. */
function afficherDemo(etape) {
  const cle = etape.clipUrl ?? etape.imageUrls.join("|");
  if (cle === clipActuel) return;
  clipActuel = cle;
  clearInterval(minuterieImages);
  if (etape.clipUrl) {
    $("image-ref").classList.add("cache");
    $("clip").classList.remove("cache");
    $("clip").src = etape.clipUrl;
    $("son").classList.remove("cache");
    $("legende").textContent = "Le geste du maître pour cette étape (en boucle)";
  } else {
    $("clip").classList.add("cache");
    $("son").classList.add("cache");
    $("image-ref").classList.remove("cache");
    imageRefIndex = 0;
    const suivante = () => {
      if (etape.imageUrls.length === 0) return;
      $("image-ref").src = etape.imageUrls[imageRefIndex % etape.imageUrls.length];
      imageRefIndex += 1;
    };
    suivante();
    minuterieImages = setInterval(suivante, 2500);
    $("legende").textContent = "Ce que le maître a montré pour cette étape";
  }
}

// --- Session -------------------------------------------------------------------

function suivreSession(id) {
  sessionId = id;
  flux?.close();
  const cle = cleAcces();
  flux = new EventSource(`/api/sessions/${id}/evenements${cle ? `?cle=${encodeURIComponent(cle)}` : ""}`);
  flux.onmessage = (e) => afficher(JSON.parse(e.data));
}

async function commande(nom) {
  if (!sessionId) return;
  // Mode caméra : la vidéo des dernières secondes part avec « vérifie » et « suivant ».
  if (enregistreurActuel && (nom === "verifier" || nom === "suivant")) {
    commandeEnAttente = nom;
    if (enregistreurActuel.state !== "inactive") enregistreurActuel.stop();
    return;
  }
  try {
    afficher(await api(`/sessions/${sessionId}/commande`, { method: "POST", body: JSON.stringify({ commande: nom }) }));
  } catch (erreur) {
    $("retour").textContent = erreur.message;
  }
}

/** Rejoint la session lancée par les lunettes dès qu'elle apparaît. */
async function attendreLunettes() {
  if (sessionId) return;
  try {
    const sessions = await api(`/sessions?lecon=${leconId}`);
    if (sessions.length > 0) {
      suivreSession(sessions[0].sessionId);
      return;
    }
  } catch {}
  setTimeout(attendreLunettes, 3000);
}

// --- Commandes à la voix (téléphone ou tablette sur un support) -------------------

const ecoute = new Ecoute({
  surPhrase: (phrase) => {
    // L'appareil lit les conseils à voix haute : on ignore ce qu'il entend pendant qu'il parle.
    if (speechSynthesis.speaking || Date.now() - finDerniereParole < 800) return;
    const nom = commandeApprenti(phrase);
    if (!nom) return;
    $("etat-ecoute").textContent = `Entendu : « ${phrase} »`;
    if (nom === "montrer") montrerGeste();
    else {
      if (nom === "repeter") dernierMessageDit = null;
      commande(nom);
    }
  },
  surEtat: (etat, message) => {
    $("etat-ecoute").textContent = message;
    if (etat === "refusee" || etat === "indisponible") $("ecoute").checked = false;
  },
});

function activerEcoute(active) {
  $("ecoute").checked = active && ecoute.demarrer();
  if (!active) ecoute.arreter();
}

/** Rejoue le clip du maître depuis le début. */
function montrerGeste() {
  const clip = $("clip");
  if (clip.classList.contains("cache")) return;
  clip.currentTime = 0;
  clip.play().catch(() => undefined);
  clip.scrollIntoView({ behavior: "smooth", block: "center" });
}

// --- Guide de placement : la première image de l'étape du maître, en transparence -----

function afficherGuide() {
  const guide = $("guide");
  const url = etapeActuelle?.imageGuideUrl ?? etapeActuelle?.imageUrls[0];
  const visible = $("guide-actif").checked && Boolean(url) && !$("bloc-camera").classList.contains("cache");
  guide.classList.toggle("cache", !visible);
  if (visible && guide.getAttribute("src") !== url) guide.src = url;
  guide.style.opacity = String(Number($("opacite-guide").value) / 100);
}

// Le cadre prend les proportions de l'image du maître, pour que les deux se superposent.
$("guide").addEventListener("load", (e) => {
  const { naturalWidth: l, naturalHeight: h } = e.target;
  if (l && h) $("cadre-camera").style.aspectRatio = `${l} / ${h}`;
});
$("guide-actif").addEventListener("change", afficherGuide);
$("opacite-guide").addEventListener("input", afficherGuide);

/** Contrôle unique de l'installation (lumière, netteté, stabilité) ; ensuite plus rien. */
async function controlerInstallation() {
  $("controle").textContent = "Contrôle de l'installation (3 secondes, ne touche pas au téléphone)…";
  try {
    afficherControle($("controle"), await controlerCamera($("camera")), el);
  } catch (erreur) {
    $("controle").textContent = `Contrôle impossible : ${erreur.message}`;
  }
}
$("recontroler").onclick = controlerInstallation;

// --- Miroir : la vidéo du maître inversée gauche-droite (maître filmé en face) -------------

function appliquerMiroir(actif) {
  for (const id of ["clip", "image-ref"]) $(id).classList.toggle("miroir", actif);
  $("miroir").setAttribute("aria-pressed", String(actif));
  try { localStorage.setItem("miroir", actif ? "1" : ""); } catch {}
}
$("miroir").onclick = () => appliquerMiroir($("miroir").getAttribute("aria-pressed") !== "true");
try { appliquerMiroir(localStorage.getItem("miroir") === "1"); } catch {}

/** Garde l'écran allumé pendant l'entraînement (sinon le téléphone se met en veille et coupe la caméra). */
async function garderEcranAllume() {
  try {
    let verrou = await navigator.wakeLock?.request("screen");
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && verrou?.released) verrou = await navigator.wakeLock.request("screen");
    });
  } catch {}
}

// --- Mode caméra de la tablette (test sans lunettes) ----------------------------

const DUREE_MORCEAU_MS = 4000;

/** Format vidéo accepté par le navigateur (Safari : MP4, Chrome et Firefox : WebM). */
function formatVideo() {
  const candidats = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidats.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
}

/** Filme 4 secondes (ou moins si l'apprenti demande une vérification) et renvoie la vidéo. */
function filmerMorceau(camera, format) {
  return new Promise((ok, ko) => {
    const enregistreur = new MediaRecorder(camera, { mimeType: format, videoBitsPerSecond: 1_500_000 });
    enregistreurActuel = enregistreur;
    const morceaux = [];
    enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    enregistreur.onstop = () => ok(new Blob(morceaux, { type: enregistreur.mimeType }));
    enregistreur.onerror = (e) => ko(e.error);
    enregistreur.start();
    setTimeout(() => enregistreur.state !== "inactive" && enregistreur.stop(), DUREE_MORCEAU_MS);
  });
}

async function demarrerCamera() {
  let camera;
  try {
    camera = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: false,
    });
  } catch (erreur) {
    alert(`Caméra inaccessible : ${erreur.message}`);
    return;
  }
  const format = formatVideo();
  if (!format) {
    alert("Ce navigateur ne sait pas enregistrer de vidéo.");
    return;
  }
  const apprenti = $("prenom").value.trim();
  try { localStorage.setItem("prenom", apprenti); } catch {}
  const session = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId, apprenti }) });
  $("voix").checked = true;
  suivreSession(session.sessionId);
  afficher(session);

  $("camera").srcObject = camera;
  $("camera").play().catch(() => undefined);
  $("bloc-camera").classList.remove("cache");
  afficherGuide();
  garderEcranAllume();
  controlerInstallation();
  // Mains prises : on active les commandes à la voix (le clic sur le bouton autorise le micro).
  if (reconnaissanceDisponible()) activerEcoute(true);

  // Filme en continu par morceaux de 4 s, gardés quelques secondes par le cerveau. L'IA ne les
  // regarde qu'avec « Vérifier » ou « Suivant » (sauf étape surveillée) : le morceau en cours
  // est alors coupé et part avec la commande. Les réponses arrivent par le flux d'événements.
  let envoiEnCours = null;
  for (;;) {
    const morceau = await filmerMorceau(camera, format);
    const avecCommande = commandeEnAttente;
    commandeEnAttente = null;
    if (envoiEnCours && !avecCommande) continue; // le cerveau n'a pas fini le précédent : on passe
    const precedent = envoiEnCours ?? Promise.resolve();
    const envoi = precedent.catch(() => undefined).then(() =>
      api(`/sessions/${sessionId}/video${avecCommande ? `?commande=${avecCommande}` : ""}`, {
        method: "POST",
        headers: { "content-type": morceau.type.split(";")[0] },
        body: morceau,
      }));
    envoiEnCours = envoi;
    envoi
      .then(() => ($("etat-camera").textContent = "La caméra filme. L'IA regarde quand tu dis « vérifie » ou cliques sur « Vérifier mon geste »."))
      .catch((erreur) => ($("etat-camera").textContent = `Envoi impossible : ${erreur.message}`))
      .finally(() => {
        if (envoiEnCours === envoi) envoiEnCours = null;
      });
  }
}

// --- Démarrage -------------------------------------------------------------------

$("verifier").onclick = () => commande("verifier");
$("precedent").onclick = () => commande("precedent");
$("suivant").onclick = () => commande("suivant");
$("repeter").onclick = () => {
  dernierMessageDit = null;
  commande("repeter");
};
$("recommencer").onclick = () => commande("recommencer");
$("demarrer-camera").onclick = demarrerCamera;
$("ecoute").addEventListener("change", (e) => activerEcoute(e.target.checked));
if (!reconnaissanceDisponible()) {
  $("ecoute").disabled = true;
  $("etat-ecoute").textContent = "Ce navigateur ne reconnaît pas la voix : utilise les boutons (ou Chrome, Safari).";
}
$("son").onclick = () => {
  $("clip").muted = !$("clip").muted;
  $("son").textContent = $("clip").muted ? "🔈 Son du maître" : "🔇 Couper le son";
};

(async () => {
  if (!leconId) {
    $("titre").textContent = "Aucune leçon choisie";
    return;
  }
  try {
    const lecon = await api(`/lecons/${leconId}`);
    etapesLecon = lecon.etapes;
    $("lien-fiche").href = `fiche.html?lecon=${lecon.id}`;
    $("titre").textContent = lecon.titre;
    document.title = `Apprenti — ${lecon.titre}`;
  } catch (erreur) {
    $("titre").textContent = erreur.message;
    return;
  }
  try { $("prenom").value = localStorage.getItem("prenom") ?? ""; } catch {}
  $("choix").classList.remove("cache");
  attendreLunettes();
})();
