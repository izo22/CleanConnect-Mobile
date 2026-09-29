import { api, cleAcces } from "./commun.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");

let sessionId = null;
let flux = null;
let clipActuel = null;
let imageRefIndex = 0;
let minuterieImages = null;
let dernierMessageDit = null;

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

  if (retour.dire && $("voix").checked && retour.dire !== dernierMessageDit) {
    dernierMessageDit = retour.dire;
    speechSynthesis.cancel();
    const phrase = new SpeechSynthesisUtterance(retour.dire);
    phrase.lang = "fr-FR";
    speechSynthesis.speak(phrase);
  }
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
  afficher(await api(`/sessions/${sessionId}/commande`, { method: "POST", body: JSON.stringify({ commande: nom }) }));
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

// --- Mode caméra de la tablette (test sans lunettes) ----------------------------

const DUREE_MORCEAU_MS = 4000;

/** Format vidéo accepté par le navigateur (Safari : MP4, Chrome et Firefox : WebM). */
function formatVideo() {
  const candidats = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidats.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
}

/** Filme 4 secondes et renvoie la vidéo. */
function filmerMorceau(camera, format) {
  return new Promise((ok, ko) => {
    const enregistreur = new MediaRecorder(camera, { mimeType: format, videoBitsPerSecond: 1_500_000 });
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
  const session = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId }) });
  $("voix").checked = true;
  suivreSession(session.sessionId);
  afficher(session);

  $("camera").srcObject = camera;
  $("bloc-camera").classList.remove("cache");

  // Filme en continu par morceaux de 4 s ; chaque morceau part à l'IA pendant que le suivant est filmé.
  let envoiEnCours = false;
  for (;;) {
    const morceau = await filmerMorceau(camera, format);
    if (envoiEnCours) continue; // l'IA n'a pas fini le précédent : on passe au morceau suivant
    envoiEnCours = true;
    api(`/sessions/${sessionId}/video`, {
      method: "POST",
      headers: { "content-type": morceau.type.split(";")[0] },
      body: morceau,
    })
      .then(() => ($("etat-camera").textContent = "La vidéo est envoyée à l'IA par morceaux de 4 secondes."))
      .catch((erreur) => ($("etat-camera").textContent = `Envoi impossible : ${erreur.message}`))
      .finally(() => (envoiEnCours = false));
  }
}

// --- Démarrage -------------------------------------------------------------------

$("precedent").onclick = () => commande("precedent");
$("suivant").onclick = () => commande("suivant");
$("repeter").onclick = () => {
  dernierMessageDit = null;
  commande("repeter");
};
$("recommencer").onclick = () => commande("recommencer");
$("demarrer-camera").onclick = demarrerCamera;
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
    $("titre").textContent = lecon.titre;
    document.title = `Apprenti — ${lecon.titre}`;
  } catch (erreur) {
    $("titre").textContent = erreur.message;
    return;
  }
  $("choix").classList.remove("cache");
  attendreLunettes();
})();
