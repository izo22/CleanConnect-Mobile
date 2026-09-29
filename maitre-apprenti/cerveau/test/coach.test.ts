import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionApprenti, type Evaluateur } from "../src/coach.ts";
import type { Lecon, Verdict } from "../src/types.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

function lecon(): Lecon {
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

function nouvelleSession(verdicts: Verdict[], horloge = { t: 0 }) {
  const { evaluateur, appels } = evaluateurFactice(verdicts);
  const session = new SessionApprenti(lecon(), {
    evaluateur,
    chargerImage: async () => JPEG,
    maintenant: () => horloge.t,
  });
  return { session, appels, horloge };
}

test("annonce la première étape au démarrage", () => {
  const { session } = nouvelleSession([]);
  assert.equal(session.etat.etape.index, 0);
  assert.equal(session.etat.dire, "Étape 1 : Pesée. Consigne 1");
  assert.equal(session.etat.etape.clipUrl, "/media/lecons/abcdefabcdef/clips/etape-1.mp4");
});

test("une correction est dite une fois, puis pas répétée avant 15 s", async () => {
  const correction: Verdict = { verdict: "correction", message: "Ajoute 10 g d'eau.", pointsValides: [] };
  const { session, horloge } = nouvelleSession([correction, correction, correction]);

  assert.equal((await session.analyserSequence([JPEG])).dire, "Ajoute 10 g d'eau.");
  horloge.t = 5_000;
  const repetee = await session.analyserSequence([JPEG]);
  assert.equal(repetee.dire, null);
  assert.equal(repetee.afficher, "Ajoute 10 g d'eau.");
  horloge.t = 21_000;
  assert.equal((await session.analyserSequence([JPEG])).dire, "Ajoute 10 g d'eau.");
});

test("une étape réussie passe à la suivante et l'annonce", async () => {
  const { session, appels } = nouvelleSession([
    { verdict: "correction", message: "Pèse la farine.", pointsValides: [] },
    { verdict: "etape_reussie", message: "Bravo !", pointsValides: [] },
    { verdict: "en_cours", message: "", pointsValides: [] },
  ]);
  await session.analyserSequence([JPEG]);
  const retour = await session.analyserSequence([JPEG]);
  assert.equal(retour.etape.index, 1);
  assert.equal(retour.dire, "Bravo ! Étape 2 : Façonnage. Consigne 2");

  await session.analyserSequence([JPEG]);
  // Nouvelle étape : l'IA repart sans les conseils ni les images de l'étape précédente.
  assert.deepEqual(appels[2].derniersConseils, []);
  assert.equal(appels[2].imagesApprenti.length, 1);
  assert.equal(appels[2].etape.titre, "Façonnage");
});

test("la dernière étape réussie termine la leçon", async () => {
  const reussie: Verdict = { verdict: "etape_reussie", message: "Parfait.", pointsValides: [] };
  const { session } = nouvelleSession([reussie, reussie]);
  await session.analyserSequence([JPEG]);
  const fin = await session.analyserSequence([JPEG]);
  assert.equal(fin.termine, true);
  assert.equal(fin.dire, "Parfait. Tu as terminé « Baguette ».");
});

test("ignore une séquence pendant qu'une analyse est déjà en cours", async () => {
  let liberer: (v: Verdict) => void = () => {};
  const session = new SessionApprenti(lecon(), {
    evaluateur: () => new Promise<Verdict>((r) => (liberer = r)),
    chargerImage: async () => JPEG,
  });
  const premiere = session.analyserSequence([JPEG]);
  await new Promise((r) => setImmediate(r));
  const seconde = await session.analyserSequence([JPEG]);
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
  const analyse = session.analyserSequence([JPEG]);
  await new Promise((r) => setImmediate(r));
  session.commande("suivant");
  liberer({ verdict: "etape_reussie", message: "Bravo", pointsValides: [] });
  const retour = await analyse;
  assert.equal(retour.etape.index, 1);
  assert.equal(retour.termine, false);
});

test("« je ne vois pas bien » n'est pas répété plus d'une fois toutes les 20 s", async () => {
  const pasVisible: Verdict = { verdict: "pas_visible", message: "Baisse la tête.", pointsValides: [] };
  const { session, horloge } = nouvelleSession([pasVisible, pasVisible, pasVisible]);
  horloge.t = 30_000;
  assert.equal((await session.analyserSequence([JPEG])).dire, "Baisse la tête.");
  horloge.t = 40_000;
  assert.equal((await session.analyserSequence([JPEG])).dire, null);
  horloge.t = 51_000;
  assert.equal((await session.analyserSequence([JPEG])).dire, "Baisse la tête.");
});

test("une panne de l'IA n'interrompt pas la session", async () => {
  const { session } = nouvelleSession([]);
  const retour = await session.analyserSequence([JPEG]);
  assert.equal(retour.dire, null);
  assert.match(retour.afficher, /IA indisponible/);
});

test("les commandes naviguent entre les étapes", () => {
  const { session } = nouvelleSession([]);
  assert.equal(session.commande("precedent").etape.index, 0);
  assert.equal(session.commande("suivant").etape.index, 1);
  assert.equal(session.commande("suivant").etape.index, 1);
  assert.equal(session.commande("repeter").dire, "Étape 2 : Façonnage. Consigne 2");
  assert.equal(session.commande("recommencer").etape.index, 0);
});

test("refuse une leçon qui n'est pas prête", () => {
  assert.throws(() => new SessionApprenti({ ...lecon(), statut: "en_preparation" }), /pas encore prête/);
});
