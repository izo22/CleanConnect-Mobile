import { api, cleAcces } from "./commun.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");
const INTERVALLE_CAMERA_MS = 3000;

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
  const session = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId }) });
  $("voix").checked = true;
  suivreSession(session.sessionId);
  afficher(session);

  const video = $("camera");
  video.srcObject = camera;
  $("bloc-camera").classList.remove("cache");
  const toile = document.createElement("canvas");

  const envoyer = async () => {
    if (video.videoWidth > 0) {
      const largeur = Math.min(1024, video.videoWidth);
      toile.width = largeur;
      toile.height = Math.round((video.videoHeight * largeur) / video.videoWidth);
      toile.getContext("2d").drawImage(video, 0, 0, toile.width, toile.height);
      const image = await new Promise((ok) => toile.toBlob(ok, "image/jpeg", 0.8));
      try {
        // Le retour arrive aussi par le flux d'événements ; on attend la réponse pour ne pas empiler.
        await api(`/sessions/${sessionId}/image`, {
          method: "POST",
          headers: { "content-type": "image/jpeg" },
          body: image,
        });
        $("etat-camera").textContent = "Une image est envoyée à l'IA toutes les 3 secondes.";
      } catch (erreur) {
        $("etat-camera").textContent = `Envoi impossible : ${erreur.message}`;
      }
    }
    setTimeout(envoyer, INTERVALLE_CAMERA_MS);
  };
  envoyer();
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
