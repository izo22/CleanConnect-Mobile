// Démonstration du maître filmée avec un téléphone : la vidéo (avec le son) part au cerveau par
// morceaux de 10 secondes pendant le tournage ; les étapes sont marquées à la voix ou au bouton,
// et ce que dit le maître est transcrit pour la fiche écrite.

import { api } from "./commun.js";
import { commandeMaitre, Ecoute, reconnaissanceDisponible } from "./voix.js";

const $ = (id) => document.getElementById(id);
const DUREE_MORCEAU_MS = 10_000;
const ESSAIS_ENVOI = 3;

let captureId = null;
let enCours = false;
let enregistreur = null;
let debut = 0;
let minuterie = null;
let etapes = 1;
let envoyes = 0;
/** Les morceaux partent un par un, dans l'ordre : aucun ne doit se perdre. */
let fileEnvoi = Promise.resolve();
let echecs = 0;
/** La boucle de tournage : elle se termine après avoir mis le dernier morceau dans la file. */
let tournage = Promise.resolve();

function formatVideo() {
  const candidats = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidats.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
}

/** Filme un morceau (10 s, ou moins si le tournage s'arrête) et renvoie la vidéo. */
function filmerMorceau(flux, format) {
  return new Promise((ok, ko) => {
    const nouveau = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 2_500_000 });
    enregistreur = nouveau;
    const morceaux = [];
    nouveau.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    nouveau.onstop = () => ok(new Blob(morceaux, { type: nouveau.mimeType }));
    nouveau.onerror = (e) => ko(e.error);
    nouveau.start();
    setTimeout(() => nouveau.state !== "inactive" && nouveau.stop(), DUREE_MORCEAU_MS);
  });
}

async function envoyer(morceau) {
  for (let essai = 1; ; essai++) {
    try {
      await api(`/captures/${captureId}/video`, {
        method: "POST",
        headers: { "content-type": morceau.type.split(";")[0] },
        body: morceau,
      });
      envoyes++;
      $("etat-envoi").textContent = `${envoyes} morceau${envoyes > 1 ? "x" : ""} envoyé${envoyes > 1 ? "s" : ""}`;
      return;
    } catch (erreur) {
      if (essai >= ESSAIS_ENVOI) {
        echecs++;
        $("etat-envoi").textContent = `Envoi impossible (${erreur.message}) : ${echecs} morceau(x) perdu(s)`;
        return;
      }
      await new Promise((ok) => setTimeout(ok, 1000 * essai));
    }
  }
}

async function filmer(flux, format) {
  while (enCours) {
    const morceau = await filmerMorceau(flux, format);
    if (morceau.size > 0) fileEnvoi = fileEnvoi.then(() => envoyer(morceau));
  }
}

// --- Voix : repères d'étapes, fin, et paroles du maître ---------------------------------

const ecoute = new Ecoute({
  surPhrase: (phrase) => {
    if (!enCours) return;
    const commande = commandeMaitre(phrase);
    if (commande === "etape") return marquerEtape();
    if (commande === "terminer") return terminer();
    $("derniere-parole").textContent = `« ${phrase} »`;
    api(`/captures/${captureId}/parole`, { method: "POST", body: JSON.stringify({ texte: phrase }) }).catch(() => undefined);
  },
  surEtat: (_etat, message) => ($("etat-ecoute").textContent = message),
});

async function marquerEtape() {
  if (!enCours) return;
  etapes++;
  $("nombre-etapes").textContent = `Étape ${etapes}`;
  try {
    await api(`/captures/${captureId}/etape`, { method: "POST", body: "{}" });
  } catch (erreur) {
    $("etat-envoi").textContent = erreur.message;
  }
}

// --- Tournage ----------------------------------------------------------------------------

async function commencer() {
  $("erreur").textContent = "";
  const format = typeof MediaRecorder === "undefined" ? "" : formatVideo();
  if (!format) {
    $("erreur").textContent = "Ce navigateur ne sait pas enregistrer de vidéo.";
    return;
  }
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
  } catch (erreur) {
    $("erreur").textContent = `Caméra ou micro inaccessible : ${erreur.message}`;
    return;
  }
  try {
    const capture = await api("/captures", {
      method: "POST",
      body: JSON.stringify({ titre: $("titre").value, metier: $("metier").value }),
    });
    captureId = capture.captureId;
  } catch (erreur) {
    flux.getTracks().forEach((piste) => piste.stop());
    $("erreur").textContent = erreur.message;
    return;
  }

  $("preparation").classList.add("cache");
  $("tournage").classList.remove("cache");
  $("camera").srcObject = flux;
  try { await navigator.wakeLock?.request("screen"); } catch {}
  if ($("ecoute").checked && reconnaissanceDisponible()) ecoute.demarrer();
  else $("etat-ecoute").textContent = "Utilise les boutons pour marquer les étapes et terminer.";

  enCours = true;
  debut = Date.now();
  minuterie = setInterval(() => {
    const s = Math.floor((Date.now() - debut) / 1000);
    $("duree").textContent = `● ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
  tournage = filmer(flux, format)
    .catch((erreur) => ($("etat-envoi").textContent = `Enregistrement interrompu : ${erreur.message}`))
    .finally(() => flux.getTracks().forEach((piste) => piste.stop()));
}

let fin = null;
function terminer() {
  if (!enCours) return fin;
  enCours = false;
  ecoute.arreter();
  clearInterval(minuterie);
  $("terminer").disabled = true;
  $("etape").disabled = true;
  $("etat-envoi").textContent = "Envoi de la fin de la vidéo…";
  // Le morceau en cours s'arrête tout de suite ; la boucle de tournage le met dans la file.
  if (enregistreur?.state !== "inactive") enregistreur?.stop();
  fin = (async () => {
    await tournage;
    await fileEnvoi;
    try {
      await api(`/captures/${captureId}/terminer`, { method: "POST", body: "{}" });
      $("tournage").classList.add("cache");
      $("fin").classList.remove("cache");
      if (echecs) $("message-fin").textContent += ` Attention : ${echecs} morceau(x) de vidéo n'ont pas pu être envoyés.`;
    } catch (erreur) {
      $("etat-envoi").textContent = `Fin impossible : ${erreur.message}`;
    }
  })();
  return fin;
}

$("commencer").onclick = commencer;
$("etape").onclick = marquerEtape;
$("terminer").onclick = terminer;
if (!reconnaissanceDisponible()) {
  $("ecoute").checked = false;
  $("ecoute").disabled = true;
}
