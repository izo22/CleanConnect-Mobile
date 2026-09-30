// Page de l'apprenti, en quatre écrans : ton prénom → installation du téléphone → l'atelier
// (une étape, un gros bouton « Vérifier ») → fin. Tout se pilote aussi à la voix.
// Avec des lunettes connectées, la page suit la séance des lunettes et saute l'installation.

import { api, cleAcces, el } from "./commun.js";
import { afficherControle, controlerCamera } from "./controle.js";
import { commandeApprenti, Ecoute, reconnaissanceDisponible } from "./voix.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");

let lecon = null;
let sessionId = null;
let flux = null;
let camera = null;
let dernierRetour = null;
let clipActuel = null;
let minuterieImages = null;
let minuterieBravo = null;
let dernierMessageDit = null;
/** Fin de la dernière phrase dite par l'appareil : on n'écoute pas sa propre voix. */
let finDerniereParole = 0;
/** Mode caméra : l'enregistrement en cours, et la commande à envoyer avec lui. */
let enregistreurActuel = null;
let commandeEnAttente = null;
let filmage = false;
/** Vitesse de la vidéo du maître : normale, moitié, quart (« très doucement »). */
const VITESSES = [1, 0.5, 0.25];
let vitesse = 1;

// --- Préférences (gardées sur l'appareil) -------------------------------------------------

function preference(nom, defaut) {
  try {
    const valeur = localStorage.getItem(`pref-${nom}`);
    return valeur === null ? defaut : valeur === "1";
  } catch {
    return defaut;
  }
}
function retenir(nom, valeur) {
  try { localStorage.setItem(`pref-${nom}`, valeur ? "1" : "0"); } catch {}
}

// --- Écrans ----------------------------------------------------------------------------------

function montrerEcran(nom) {
  for (const ecran of ["accueil", "installation", "atelier", "fin"]) {
    $(`ecran-${ecran}`).classList.toggle("cache", ecran !== nom);
  }
  window.scrollTo(0, 0);
}

// --- Retours du cerveau : ce qu'on voit et ce qu'on entend ------------------------------------

/** Couleur de l'écran et message, selon ce que l'IA vient de dire. */
function etatVisuel(retour) {
  if (retour.regarde) return ["regarde", "👀 Je regarde ton geste…"];
  switch (retour.verdict) {
    case "correction":
      return ["correction", `⚠ ${retour.afficher}`];
    case "pas_visible":
      return ["correction", `👀 ${retour.afficher}`];
    case "etape_reussie":
      return ["bravo", "👏 Bravo !"];
    case "en_cours":
      // Réponse à « vérifie » : rien de faux. En surveillance continue, un silence ne s'affiche pas.
      return retour.dire ? ["ok", `✓ ${retour.afficher}`] : ["neutre", aide(retour.etape)];
  }
  // Annonce d'étape (commande, début) : on rappelle quoi faire. Autre message : on l'affiche.
  return retour.afficher.startsWith("Étape ") ? ["neutre", aide(retour.etape)] : ["neutre", retour.afficher];
}

function aide(etape) {
  return etape.analyse === "continu"
    ? "Je te surveille pendant cette étape."
    : "Fais le geste, puis appuie sur « Vérifier » ou dis « vérifie ».";
}

function montrerEtat(etat, message) {
  document.body.dataset.etat = etat;
  $("retour").textContent = message;
}

function appliquer(retour) {
  if (retour.ignore) return;
  dernierRetour = retour;
  const { etape } = retour;
  $("etape-num").textContent = `Étape ${etape.index + 1} sur ${etape.total}`;
  $("points").replaceChildren(...Array.from({ length: etape.total }, (_, i) =>
    el("span", { classe: i < etape.index || retour.termine ? "fait" : i === etape.index ? "actuel" : "" })));
  $("titre-etape").textContent = etape.titre;
  $("consigne-etape").textContent = etape.consigne;
  afficherDemo(etape);
  remplirCommentFaire(etape, retour.termine ? etape.total : etape.index);

  clearTimeout(minuterieBravo);
  const [etat, message] = etatVisuel(retour);
  montrerEtat(etat, message);
  // Le bravo reste 4 secondes, puis on rappelle quoi faire pour la nouvelle étape.
  if (etat === "bravo") {
    minuterieBravo = setTimeout(() => {
      if (retour.termine) terminer(retour);
      else montrerEtat("neutre", aide(etape));
    }, retour.termine ? 2500 : 4000);
  } else if (retour.termine) {
    terminer(retour);
  }

  if (retour.dire && $("voix").checked && retour.dire !== dernierMessageDit) {
    dernierMessageDit = retour.dire;
    speechSynthesis.cancel();
    const phrase = new SpeechSynthesisUtterance(retour.dire);
    phrase.lang = "fr-FR";
    phrase.onend = () => (finDerniereParole = Date.now());
    speechSynthesis.speak(phrase);
  }
}

function terminer() {
  $("texte-fin").textContent = `Tu as fait toutes les étapes de « ${lecon?.titre ?? "la leçon"} ».`;
  montrerEcran("fin");
}

/** Le clip du maître en boucle, ou ses images en diaporama s'il n'y a pas de clip. */
function afficherDemo(etape) {
  const cle = etape.clipUrl ?? etape.imageUrls.join("|");
  if (cle === clipActuel) return;
  clipActuel = cle;
  clearInterval(minuterieImages);
  const clip = $("clip");
  const image = $("image-ref");
  if (etape.clipUrl) {
    image.classList.add("cache");
    clip.classList.remove("cache");
    $("son").classList.remove("cache");
    $("vitesse").classList.remove("cache");
    clip.src = etape.clipUrl;
    appliquerVitesse();
  } else {
    clip.classList.add("cache");
    $("son").classList.add("cache");
    $("vitesse").classList.add("cache");
    image.classList.remove("cache");
    let i = 0;
    const suivante = () => {
      if (etape.imageUrls.length) image.src = etape.imageUrls[i++ % etape.imageUrls.length];
    };
    suivante();
    minuterieImages = setInterval(suivante, 2500);
  }
}

/** Applique la vitesse choisie à la vidéo du maître (elle reste pour les étapes suivantes). */
function appliquerVitesse() {
  const clip = $("clip");
  clip.defaultPlaybackRate = vitesse;
  clip.playbackRate = vitesse;
  const libelle = vitesse === 1 ? "1×" : vitesse === 0.5 ? "½×" : "¼×";
  const texte = vitesse === 1 ? "normale" : vitesse === 0.5 ? "deux fois plus lente" : "quatre fois plus lente";
  $("vitesse").textContent = libelle;
  $("vitesse").setAttribute("aria-label", `Vitesse de la vidéo du maître : ${texte}`);
  $("vitesse").classList.toggle("ralentie", vitesse !== 1);
}

function changerVitesse(nouvelle) {
  vitesse = nouvelle;
  appliquerVitesse();
  montrerGeste();
}

/** Rejoue le clip du maître depuis le début. */
function montrerGeste() {
  const clip = $("clip");
  if (clip.classList.contains("cache")) return;
  clip.currentTime = 0;
  clip.play().catch(() => undefined);
}

function remplirCommentFaire(etape, indexActuel) {
  const liste = (titre, elements, classe) =>
    elements?.length
      ? el("div", { classe: `bloc-liste ${classe}` }, el("h3", {}, titre), el("ul", {}, ...elements.map((e) => el("li", {}, e))))
      : null;
  $("titre-comment").textContent = etape.titre;
  $("texte-etape").replaceChildren(
    el("p", { classe: "explication" }, etape.explication),
    el("div", { classe: "listes" },
      liste("Points clés", etape.pointsDeControle, "cles"),
      liste("À éviter", etape.erreursFrequentes, "eviter"),
      liste("C'est réussi quand", etape.criteresDeReussite, "reussi")),
    etape.paroles?.length
      ? el("div", { classe: "paroles" }, el("h3", {}, "Le maître dit"), ...etape.paroles.map((p) => el("blockquote", {}, `« ${p} »`)))
      : null,
  );
  const images = etape.imageUrls.map((url, i) => {
    const legende = etape.legendes?.[i]?.trim();
    return el("li", {}, el("img", { src: url, alt: legende || `Image ${i + 1} du geste`, loading: "lazy" }),
      legende ? el("span", { classe: "legende-geste" }, legende) : null);
  });
  $("images-etape").replaceChildren(...images);
  $("bloc-images-etape").classList.toggle("cache", images.length === 0);
  $("plan").replaceChildren(...(lecon?.etapes ?? []).map((e, i) =>
    el("li", { classe: i < indexActuel ? "faite" : i === indexActuel ? "actuelle" : "", ...(i === indexActuel ? { "aria-current": "step" } : {}) }, e.titre)));
}

// --- Séance --------------------------------------------------------------------------------

let evenements = null;
function suivreSession(id) {
  sessionId = id;
  evenements?.close();
  const cle = cleAcces();
  evenements = new EventSource(`/api/sessions/${id}/evenements${cle ? `?cle=${encodeURIComponent(cle)}` : ""}`);
  evenements.onmessage = (e) => appliquer(JSON.parse(e.data));
}

async function commande(nom) {
  if (!sessionId) return;
  // Mode caméra : la vidéo des dernières secondes part avec « vérifie » et « suivant ».
  if (filmage && enregistreurActuel && (nom === "verifier" || nom === "suivant")) {
    commandeEnAttente = nom;
    if (nom === "verifier") montrerEtat("regarde", "👀 Je regarde ton geste…");
    if (enregistreurActuel.state !== "inactive") enregistreurActuel.stop();
    return;
  }
  try {
    appliquer(await api(`/sessions/${sessionId}/commande`, { method: "POST", body: JSON.stringify({ commande: nom }) }));
  } catch (erreur) {
    montrerEtat("correction", `Problème de connexion : ${erreur.message}`);
  }
}

/** Avec des lunettes : dès que la séance des lunettes apparaît, on la suit (sans caméra ici). */
async function attendreLunettes() {
  // On arrête d'attendre dès que l'apprenti a choisi la caméra de cet appareil.
  if (sessionId || $("ecran-accueil").classList.contains("cache")) return;
  try {
    const sessions = await api(`/sessions?lecon=${leconId}`);
    if (sessions.length > 0 && !sessionId) {
      $("voix").checked = false; // les lunettes parlent déjà
      suivreSession(sessions[0].sessionId);
      entrerAtelier();
      return;
    }
  } catch {}
  setTimeout(attendreLunettes, 3000);
}

// --- Caméra de l'appareil -------------------------------------------------------------------

const DUREE_MORCEAU_MS = 4000;

function formatVideo() {
  const candidats = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidats.find((f) => MediaRecorder.isTypeSupported(f)) ?? "";
}

/** Filme 4 secondes (ou moins si l'apprenti demande une vérification) et renvoie la vidéo. */
function filmerMorceau(format) {
  return new Promise((ok, ko) => {
    const enregistreur = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 1_500_000 });
    enregistreurActuel = enregistreur;
    const morceaux = [];
    enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
    enregistreur.onstop = () => ok(new Blob(morceaux, { type: enregistreur.mimeType }));
    enregistreur.onerror = (e) => ko(e.error);
    enregistreur.start();
    setTimeout(() => enregistreur.state !== "inactive" && enregistreur.stop(), DUREE_MORCEAU_MS);
  });
}

/**
 * Filme en continu par morceaux de 4 s, gardés quelques secondes par le cerveau. L'IA ne les
 * regarde qu'avec « Vérifier » ou « Suivant » : le morceau en cours est alors coupé et part avec
 * la commande. Les réponses arrivent par le flux d'événements.
 */
async function filmer(format) {
  filmage = true;
  let envoiEnCours = null;
  while (filmage) {
    const morceau = await filmerMorceau(format);
    const avecCommande = commandeEnAttente;
    commandeEnAttente = null;
    if (envoiEnCours && !avecCommande) continue;
    const precedent = envoiEnCours ?? Promise.resolve();
    const envoi = precedent.catch(() => undefined).then(() =>
      api(`/sessions/${sessionId}/video${avecCommande ? `?commande=${avecCommande}` : ""}`, {
        method: "POST",
        headers: { "content-type": morceau.type.split(";")[0] },
        body: morceau,
      }));
    envoiEnCours = envoi;
    envoi
      .catch((erreur) => montrerEtat("correction", `La vidéo ne part pas : ${erreur.message}`))
      .finally(() => {
        if (envoiEnCours === envoi) envoiEnCours = null;
      });
  }
}

async function ouvrirCamera() {
  if (flux) return true;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 } },
      audio: false,
    });
  } catch (erreur) {
    $("erreur-accueil").textContent = `La caméra ne s'ouvre pas : ${erreur.message}. Autorise-la dans le navigateur.`;
    return false;
  }
  camera = $("camera");
  camera.srcObject = flux;
  camera.play().catch(() => undefined);
  $("mini-camera").srcObject = flux;
  $("mini-camera").play().catch(() => undefined);
  garderEcranAllume();
  return true;
}

async function garderEcranAllume() {
  try {
    let verrou = await navigator.wakeLock?.request("screen");
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && verrou?.released) verrou = await navigator.wakeLock.request("screen");
    });
  } catch {}
}

// --- Écran d'installation ---------------------------------------------------------------------

async function installation() {
  montrerEcran("installation");
  const premiere = lecon.etapes[0];
  const image = premiere?.imageGuide ?? premiere?.images[0];
  if (image) {
    const guide = $("guide");
    guide.onload = () => {
      if (guide.naturalWidth && guide.naturalHeight) $("cadre-camera").style.aspectRatio = `${guide.naturalWidth} / ${guide.naturalHeight}`;
    };
    guide.src = `/media/lecons/${lecon.id}/images/${image}`;
    guide.classList.remove("cache");
  }
  await verifierInstallation();
}

async function verifierInstallation() {
  $("controle").replaceChildren(el("p", {}, "Je vérifie la lumière et la netteté… ne touche pas au téléphone."));
  try {
    const resultat = await controlerCamera($("camera"));
    afficherControle($("controle"), resultat, el);
    $("cest-parti").textContent = resultat.ok ? "C'est parti !" : "Commencer quand même";
  } catch (erreur) {
    $("controle").textContent = `Vérification impossible : ${erreur.message}`;
  }
}

// --- Atelier ----------------------------------------------------------------------------------

function entrerAtelier() {
  montrerEcran("atelier");
  $("mini-camera").classList.toggle("cache", !flux);
  if (dernierRetour) appliquer(dernierRetour);
  if ($("ecoute").checked) activerEcoute(true);
  else majAideVoix();
}

async function cestParti() {
  $("cest-parti").disabled = true;
  try {
    if (!sessionId) {
      const apprenti = $("prenom").value.trim();
      const session = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId, apprenti }) });
      suivreSession(session.sessionId);
      appliquer(session);
    }
    if (!filmage) {
      const format = formatVideo();
      if (format) filmer(format).catch((e) => montrerEtat("correction", `La caméra s'est arrêtée : ${e.message}`));
    }
    entrerAtelier();
  } catch (erreur) {
    $("controle").textContent = `Impossible de commencer : ${erreur.message}`;
  } finally {
    $("cest-parti").disabled = false;
  }
}

// --- Voix : commandes et lecture -------------------------------------------------------------

const ecoute = new Ecoute({
  surPhrase: (phrase) => {
    // L'appareil lit les conseils à voix haute : on ignore ce qu'il entend pendant qu'il parle.
    if (speechSynthesis.speaking || Date.now() - finDerniereParole < 800) return;
    const nom = commandeApprenti(phrase);
    if (!nom || $("ecran-atelier").classList.contains("cache")) return;
    $("aide-voix").textContent = `🎤 J'ai entendu « ${phrase} »`;
    setTimeout(majAideVoix, 3000);
    if (nom === "montrer") return montrerGeste();
    if (nom === "ralentir") return changerVitesse(VITESSES[Math.min(VITESSES.indexOf(vitesse) + 1, VITESSES.length - 1)]);
    if (nom === "vitesse-normale") return changerVitesse(1);
    if (nom === "repeter") dernierMessageDit = null;
    commande(nom);
  },
  surEtat: (etat) => {
    if (etat === "refusee" || etat === "indisponible") {
      $("ecoute").checked = false;
      retenir("ecoute", false);
    }
    majAideVoix();
  },
});

function activerEcoute(active) {
  $("ecoute").checked = active && ecoute.demarrer();
  if (!active) ecoute.arreter();
  majAideVoix();
}

function majAideVoix() {
  $("aide-voix").textContent = $("ecoute").checked
    ? "🎤 Tu peux dire « vérifie », « suivant », « explique » ou « ralenti »."
    : reconnaissanceDisponible()
      ? "🎤 Commandes à la voix coupées (⚙ pour les remettre)."
      : "";
}

// --- Réglages --------------------------------------------------------------------------------

function appliquerMiroir(actif) {
  for (const id of ["clip", "image-ref"]) $(id).classList.toggle("miroir", actif);
}

$("voix").checked = preference("voix", true);
$("voix").addEventListener("change", (e) => retenir("voix", e.target.checked));
$("ecoute").checked = preference("ecoute", true) && reconnaissanceDisponible();
$("ecoute").disabled = !reconnaissanceDisponible();
$("ecoute").addEventListener("change", (e) => {
  retenir("ecoute", e.target.checked);
  activerEcoute(e.target.checked);
});
$("miroir").checked = preference("miroir", false);
appliquerMiroir($("miroir").checked);
$("miroir").addEventListener("change", (e) => {
  retenir("miroir", e.target.checked);
  appliquerMiroir(e.target.checked);
});
$("ouvrir-reglages").onclick = () => $("fenetre-reglages").showModal();
$("replacer").onclick = async () => {
  $("fenetre-reglages").close();
  if (await ouvrirCamera()) installation();
};
$("recommencer").onclick = () => {
  $("fenetre-reglages").close();
  commande("recommencer");
};

// --- Boutons ----------------------------------------------------------------------------------

$("continuer").onclick = async () => {
  $("erreur-accueil").textContent = "";
  try { localStorage.setItem("prenom", $("prenom").value.trim()); } catch {}
  if (typeof MediaRecorder === "undefined" || !formatVideo()) {
    $("erreur-accueil").textContent = "Ce navigateur ne sait pas filmer. Essaie avec Chrome ou Safari.";
    return;
  }
  if (await ouvrirCamera()) installation();
};
$("prenom").addEventListener("keydown", (e) => e.key === "Enter" && $("continuer").click());
$("recontroler").onclick = verifierInstallation;
$("cest-parti").onclick = cestParti;
$("verifier").onclick = () => commande("verifier");
$("precedent").onclick = () => commande("precedent");
$("suivant").onclick = () => commande("suivant");
$("comment-faire").onclick = () => $("fenetre-comment").showModal();
$("recommencer-fin").onclick = () => {
  commande("recommencer");
  entrerAtelier();
};
$("vitesse").onclick = () => changerVitesse(VITESSES[(VITESSES.indexOf(vitesse) + 1) % VITESSES.length]);
$("son").onclick = () => {
  const clip = $("clip");
  clip.muted = !clip.muted;
  $("son").textContent = clip.muted ? "🔈" : "🔇";
  $("son").setAttribute("aria-label", clip.muted ? "Mettre le son du maître" : "Couper le son du maître");
};

// --- Démarrage --------------------------------------------------------------------------------

(async () => {
  if (!leconId) {
    location.href = "/#apprenti";
    return;
  }
  try {
    lecon = await api(`/lecons/${leconId}`);
  } catch (erreur) {
    $("titre-lecon").textContent = erreur.message;
    montrerEcran("accueil");
    return;
  }
  document.title = lecon.titre;
  $("titre-lecon").textContent = lecon.titre;
  $("resume-lecon").textContent = `${lecon.metier} · ${lecon.etapes.length} étapes`;
  $("lien-fiche").href = `fiche.html?lecon=${lecon.id}`;
  if (lecon.statut !== "prete") {
    $("erreur-accueil").textContent = "Cette leçon n'est pas encore prête. Reviens dans quelques minutes.";
    $("continuer").disabled = true;
  }
  try { $("prenom").value = localStorage.getItem("prenom") ?? ""; } catch {}
  montrerEcran("accueil");
  attendreLunettes();
})();
