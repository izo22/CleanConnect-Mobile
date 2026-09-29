import assert from "node:assert/strict";
import { test } from "node:test";
import { DetecteurFinDeGeste, echantillonner, fenetreEtape, SessionApprenti, type Evaluateur } from "../src/coach.ts";
import type { Lecon, Retour, Verdict } from "../src/types.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
/** Image factice numérotée (le 3e octet sert aussi de « luminosité » pour la détection de mouvement). */
const image = (n: number) => Buffer.from([0xff, 0xd8, n, 0xe0, 0, 0]);
const images = (debut: number, nombre: number) => Array.from({ length: nombre }, (_, i) => image(debut + i));

function lecon(options: { surveiller?: boolean; verificationAuto?: boolean } = {}): Lecon {
  const etape = (numero: number, titre: string) => ({
    id: `etape-${numero}`,
    numero,
    titre,
    consigne: `Consigne ${numero}`,
    pointsDeControle: [],
    erreursFrequentes: [],
    criteresDeReussite: [],
    debut: 0,
    fin: 10,
    clip: `etape-${numero}.mp4`,
    clipLunettes: `etape-${numero}-lunettes.mp4`,
    images: [`ref-${numero}.jpg`],
    surveiller: options.surveiller,
  });
  return {
    id: "abcdefabcdef",
    titre: "Baguette",
    metier: "boulangerie",
    source: "video",
    creeLe: "2026-09-28T10:00:00.000Z",
    statut: "prete",
    erreur: null,
    etapes: [etape(1, "Pesée"), etape(2, "Façonnage")],
    verificationAuto: options.verificationAuto,
  };
}

/** Évaluateur factice qui renvoie les verdicts donnés, dans l'ordre. */
function evaluateurFactice(verdicts: Verdict[]) {
  const appels: Parameters<Evaluateur>[0][] = [];
  const evaluateur: Evaluateur = async (options) => {
    appels.push(options);
    const verdict = verdicts.shift();
    if (!verdict) throw new Error("plus de verdict");
    return verdict;
  };
  return { evaluateur, appels };
}

/** Vignettes factices : une image = une vignette uniforme de la luminosité de son 3e octet. */
const vignettesFactices = async (lot: Buffer[]) => lot.map((i) => Buffer.alloc(576, i[2]));

function nouvelleSession(verdicts: Verdict[], horloge = { t: 0 }, options: Parameters<typeof lecon>[0] = { surveiller: true }) {
  const { evaluateur, appels } = evaluateurFactice(verdicts);
  const session = new SessionApprenti(lecon(options), {
    evaluateur,
    chargerImage: async () => JPEG,
    vignettes: vignettesFactices,
    maintenant: () => horloge.t,
  });
  const publies: Retour[] = [];
  session.abonner((r) => publies.push(r));
  return { session, appels, horloge, publies };
}

/** Session en analyse à la demande (le cas par défaut). */
const sessionDemande = (verdicts: Verdict[], options: Parameters<typeof lecon>[0] = {}) =>
  nouvelleSession(verdicts, { t: 0 }, options);

test("annonce la première étape au démarrage", () => {
  const { session } = sessionDemande([]);
  assert.equal(session.etat.etape.index, 0);
  assert.equal(session.etat.dire, "Étape 1 : Pesée. Consigne 1 Quand tu as fini un geste, dis « vérifie ».");
  assert.equal(session.etat.etape.clipUrl, "/media/lecons/abcdefabcdef/clips/etape-1.mp4");
});

// --- Étape surveillée : analyse continue ------------------------------------------------

test("une correction est dite une fois, puis pas répétée avant 15 s", async () => {
  const correction: Verdict = { verdict: "correction", message: "Ajoute 10 g d'eau.", pointsValides: [] };
  const { session, horloge } = nouvelleSession([correction, correction, correction]);

  assert.equal((await session.recevoirVideo([JPEG])).dire, "Ajoute 10 g d'eau.");
  horloge.t = 5_000;
  const repetee = await session.recevoirVideo([JPEG]);
  assert.equal(repetee.dire, null);
  assert.equal(repetee.afficher, "Ajoute 10 g d'eau.");
  horloge.t = 21_000;
  assert.equal((await session.recevoirVideo([JPEG])).dire, "Ajoute 10 g d'eau.");
});

test("une étape réussie passe à la suivante et l'annonce", async () => {
  const { session, appels } = nouvelleSession([
    { verdict: "correction", message: "Pèse la farine.", pointsValides: [] },
    { verdict: "etape_reussie", message: "Bravo !", pointsValides: [] },
    { verdict: "en_cours", message: "", pointsValides: [] },
  ]);
  await session.recevoirVideo([JPEG]);
  const retour = await session.recevoirVideo([JPEG]);
  assert.equal(retour.etape.index, 1);
  assert.equal(retour.dire, "Bravo ! Étape 2 : Façonnage. Consigne 2 Je te surveille pendant cette étape.");

  await session.recevoirVideo([JPEG]);
  // Nouvelle étape : l'IA repart sans les conseils ni les images de l'étape précédente.
  assert.deepEqual(appels[2].derniersConseils, []);
  assert.equal(appels[2].imagesApprenti.length, 1);
  assert.equal(appels[2].etape.titre, "Façonnage");
});

test("la dernière étape réussie termine la leçon", async () => {
  const reussie: Verdict = { verdict: "etape_reussie", message: "Parfait.", pointsValides: [] };
  const { session } = nouvelleSession([reussie, reussie]);
  await session.recevoirVideo([JPEG]);
  const fin = await session.recevoirVideo([JPEG]);
  assert.equal(fin.termine, true);
  assert.equal(fin.dire, "Parfait. Tu as terminé « Baguette ».");
});

test("ignore une séquence pendant qu'une analyse est déjà en cours", async () => {
  let liberer: (v: Verdict) => void = () => {};
  const session = new SessionApprenti(lecon(), {
    evaluateur: () => new Promise<Verdict>((r) => (liberer = r)),
    chargerImage: async () => JPEG,
  });
  session.lecon.etapes.forEach((e) => (e.surveiller = true));
  const premiere = session.recevoirVideo([JPEG]);
  await new Promise((r) => setImmediate(r));
  const seconde = await session.recevoirVideo([JPEG]);
  assert.equal(seconde.ignore, true);
  liberer({ verdict: "en_cours", message: "", pointsValides: [] });
  assert.equal((await premiere).ignore, false);
});

test("un verdict arrivé après un changement d'étape est ignoré", async () => {
  let liberer: (v: Verdict) => void = () => {};
  const session = new SessionApprenti(lecon(), {
    evaluateur: () => new Promise<Verdict>((r) => (liberer = r)),
    chargerImage: async () => JPEG,
  });
  session.lecon.etapes.forEach((e) => (e.surveiller = true));
  const analyse = session.recevoirVideo([JPEG]);
  await new Promise((r) => setImmediate(r));
  await session.commande("suivant");
  liberer({ verdict: "etape_reussie", message: "Bravo", pointsValides: [] });
  const retour = await analyse;
  assert.equal(retour.etape.index, 1);
  assert.equal(retour.termine, false);
});

test("« je ne vois pas bien » n'est pas répété plus d'une fois toutes les 20 s", async () => {
  const pasVisible: Verdict = { verdict: "pas_visible", message: "Baisse la tête.", pointsValides: [] };
  const { session, horloge } = nouvelleSession([pasVisible, pasVisible, pasVisible]);
  horloge.t = 30_000;
  assert.equal((await session.recevoirVideo([JPEG])).dire, "Baisse la tête.");
  horloge.t = 40_000;
  assert.equal((await session.recevoirVideo([JPEG])).dire, null);
  horloge.t = 51_000;
  assert.equal((await session.recevoirVideo([JPEG])).dire, "Baisse la tête.");
});

test("une panne de l'IA n'interrompt pas la session", async () => {
  const { session } = nouvelleSession([]);
  const retour = await session.recevoirVideo([JPEG]);
  assert.equal(retour.dire, null);
  assert.match(retour.afficher, /IA indisponible/);
});

test("les commandes naviguent entre les étapes (sans vidéo, « suivant » passe sans vérifier)", async () => {
  const { session, appels } = sessionDemande([]);
  assert.equal((await session.commande("precedent")).etape.index, 0);
  assert.equal((await session.commande("suivant")).etape.index, 1);
  assert.equal((await session.commande("suivant")).etape.index, 1);
  assert.equal((await session.commande("repeter")).dire, "Étape 2 : Façonnage. Consigne 2");
  assert.equal((await session.commande("recommencer")).etape.index, 0);
  assert.equal(appels.length, 0);
});

// --- Analyse à la demande -------------------------------------------------------------------

test("à la demande : la vidéo est gardée en mémoire sans appeler l'IA", async () => {
  const { session, appels } = sessionDemande([]);
  for (let i = 0; i < 5; i++) {
    const retour = await session.recevoirVideo(images(i * 8, 8));
    assert.equal(retour.ignore, true);
    assert.equal(retour.dire, null);
  }
  assert.equal(appels.length, 0);
  assert.equal(session.etat.etape.analyse, "demande");
  assert.equal(session.etat.etape.envoiVideoContinu, false);
});

test("« vérifie » : 8 images réparties sur la durée de l'étape, et une réponse à l'oreille", async () => {
  const { session, appels, publies } = sessionDemande([
    { verdict: "correction", message: "Pèse 500 g de farine.", pointsValides: [] },
  ]);
  // 40 images à 2 par seconde = 20 s ; l'étape dure 10 s chez le maître → l'IA regarde les 15 dernières secondes.
  await session.recevoirVideo(images(0, 40));
  const retour = await session.commande("verifier");

  assert.equal(appels.length, 1);
  assert.equal(appels[0].demande, true);
  assert.equal(appels[0].dureeS, 14.5);
  const vues = appels[0].imagesApprenti.map((i) => i.data[2]);
  assert.equal(vues.length, 8);
  assert.equal(vues[0], 10);
  assert.equal(vues[7], 39);
  assert.equal(retour.dire, "Pèse 500 g de farine.");
  assert.equal(retour.verdict, "correction");
  // Pendant l'analyse, la tablette et les lunettes Mentra entendent « Je regarde. »
  assert.equal(publies[0].dire, "Je regarde.");
});

test("« vérifie » sans erreur visible : l'apprenti a quand même une réponse", async () => {
  const { session } = sessionDemande([
    { verdict: "en_cours", message: "", pointsValides: ["Balance tarée"] },
    { verdict: "en_cours", message: "Bonne pesée, verse maintenant l'eau.", pointsValides: [] },
  ]);
  await session.recevoirVideo(images(0, 8));
  const premier = await session.commande("verifier");
  assert.match(premier.dire ?? "", /Je ne vois rien de faux/);
  assert.match(premier.afficher, /✓ Balance tarée/);
  assert.equal((await session.commande("verifier")).dire, "Bonne pesée, verse maintenant l'eau.");
});

test("« vérifie » sans vidéo de l'étape : pas d'appel à l'IA", async () => {
  const { session, appels } = sessionDemande([]);
  const retour = await session.commande("verifier");
  assert.match(retour.dire ?? "", /pas encore vu ton geste/);
  assert.equal(appels.length, 0);
});

test("« vérifie » réussi : bravo et étape suivante, la vidéo de l'étape précédente est oubliée", async () => {
  const { session, appels } = sessionDemande([{ verdict: "etape_reussie", message: "Bravo !", pointsValides: [] }]);
  await session.recevoirVideo(images(0, 8));
  const retour = await session.commande("verifier");
  assert.equal(retour.etape.index, 1);
  assert.equal(retour.dire, "Bravo ! Étape 2 : Façonnage. Consigne 2");
  assert.match((await session.commande("verifier")).dire ?? "", /pas encore vu ton geste/);
  assert.equal(appels.length, 1);
});

test("« suivant » : l'IA vérifie d'abord ; une correction retient, un second « suivant » passe", async () => {
  const { session, appels } = sessionDemande([
    { verdict: "correction", message: "Tare la balance.", pointsValides: [] },
  ]);
  await session.recevoirVideo(images(0, 8));
  const retenu = await session.commande("suivant");
  assert.equal(retenu.etape.index, 0);
  assert.equal(retenu.dire, "Avant de passer : Tare la balance. Redis « suivant » pour passer quand même.");
  const passe = await session.commande("suivant");
  assert.equal(passe.etape.index, 1);
  assert.equal(appels.length, 1);
});

test("« suivant » : rien de faux, on passe ; étape réussie, bravo", async () => {
  const { session, appels } = sessionDemande([
    { verdict: "en_cours", message: "", pointsValides: [] },
    { verdict: "etape_reussie", message: "Parfait.", pointsValides: [] },
  ]);
  await session.recevoirVideo(images(0, 8));
  assert.equal((await session.commande("suivant")).dire, "Étape 2 : Façonnage. Consigne 2");
  await session.recevoirVideo(images(0, 8));
  const fin = await session.commande("suivant");
  assert.equal(fin.termine, true);
  assert.equal(fin.dire, "Parfait. Tu as terminé « Baguette ».");
  assert.equal(appels.length, 2);
});

test("la vidéo peut accompagner la commande (lunettes Meta)", async () => {
  const { session, appels } = sessionDemande([{ verdict: "correction", message: "Plus doucement.", pointsValides: [] }]);
  const retour = await session.recevoirVideo(images(0, 12), "verifier");
  assert.equal(retour.dire, "Plus doucement.");
  assert.equal(appels[0].imagesApprenti.length, 8);
});

test("vérification automatique : l'IA regarde quand l'apprenti s'arrête de bouger", async () => {
  const { session, appels } = sessionDemande(
    [{ verdict: "correction", message: "Écarte les mains.", pointsValides: [] }],
    { verificationAuto: true },
  );
  assert.equal(session.etat.etape.envoiVideoContinu, true);
  // 4 s de gestes (images alternées claires / sombres), puis 2 s d'immobilité.
  const bouge = Array.from({ length: 8 }, (_, i) => image(i % 2 ? 200 : 20));
  assert.equal((await session.recevoirVideo(bouge)).ignore, true);
  assert.equal(appels.length, 0);
  const immobile = await session.recevoirVideo([image(100), image(100), image(100), image(100)]);
  assert.equal(appels.length, 1);
  assert.equal(immobile.dire, "Écarte les mains.");
  // Toujours immobile : pas de nouvelle vérification (il faut un nouveau geste).
  assert.equal((await session.recevoirVideo([image(100), image(100), image(100), image(100)])).ignore, true);
  assert.equal(appels.length, 1);
});

test("vérification automatique : rien de faux, l'IA reste silencieuse", async () => {
  const { session, appels } = sessionDemande([{ verdict: "en_cours", message: "Continue.", pointsValides: [] }], {
    verificationAuto: true,
  });
  await session.recevoirVideo(Array.from({ length: 8 }, (_, i) => image(i % 2 ? 200 : 20)));
  const retour = await session.recevoirVideo([image(100), image(100), image(100), image(100)]);
  assert.equal(appels.length, 1);
  assert.equal(retour.dire, null);
});

test("détecteur de fin de geste : il faut bouger au moins 3 s puis rester immobile 1,5 s", () => {
  const detecteur = new DetecteurFinDeGeste(2);
  const v = (n: number) => Buffer.alloc(576, n);
  const resultats = [20, 200, 20, 200, 20, 200, 20, 100, 100, 100, 100].map((n) => detecteur.ajouter(v(n)));
  assert.deepEqual(resultats.map((r, i) => (r ? i : -1)).filter((i) => i >= 0), [10]);
  // Immobile sans avoir bougé avant : rien.
  const calme = new DetecteurFinDeGeste(2);
  assert.ok([1, 2, 3, 4, 5, 6].every(() => !calme.ajouter(v(50))));
});

test("« explique » lit le texte écrit de l'étape", async () => {
  const { session } = sessionDemande([]);
  session.lecon.etapes[0].explication = "Pose le bol sur la balance, tare, puis verse la farine en pluie.";
  session.lecon.etapes[0].criteresDeReussite = ["La balance affiche 500 g.", "Rien n'est renversé"];
  const retour = await session.commande("expliquer");
  assert.equal(
    retour.dire,
    "Pesée. Pose le bol sur la balance, tare, puis verse la farine en pluie. C'est réussi quand : La balance affiche 500 g ; Rien n'est renversé.",
  );
  assert.equal(retour.etape.explication, "Pose le bol sur la balance, tare, puis verse la farine en pluie.");
});

test("le retour porte le texte écrit de l'étape et le mode d'analyse", () => {
  const { session } = sessionDemande([]);
  const { etape } = session.etat;
  assert.equal(etape.explication, "Consigne 1"); // leçon ancienne sans explication : la consigne
  assert.equal(etape.fenetreS, 15);
  assert.equal(etape.analyse, "demande");
  const surveillee = nouvelleSession([]).session.etat.etape;
  assert.equal(surveillee.analyse, "continu");
  assert.equal(surveillee.envoiVideoContinu, true);
  assert.match(nouvelleSession([]).session.etat.dire ?? "", /Je te surveille pendant cette étape/);
});

test("fenêtre regardée et échantillonnage", () => {
  const etape = lecon().etapes[0];
  assert.equal(fenetreEtape({ ...etape, debut: 0, fin: 2 }), 4);
  assert.equal(fenetreEtape({ ...etape, debut: 10, fin: 18 }), 12);
  assert.equal(fenetreEtape({ ...etape, debut: 0, fin: 60 }), 20);
  assert.equal(fenetreEtape({ ...etape, debut: null, fin: null }), 8);
  assert.deepEqual(echantillonner([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(echantillonner(Array.from({ length: 15 }, (_, i) => i)), [0, 2, 4, 6, 8, 10, 12, 14]);
});

test("refuse une leçon qui n'est pas prête", () => {
  assert.throws(() => new SessionApprenti({ ...lecon(), statut: "en_preparation" }), /pas encore prête/);
});
