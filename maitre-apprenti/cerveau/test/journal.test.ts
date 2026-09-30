import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type { Avis, Intervention, Lecon, Seance, Verdict } from "../src/types.ts";

const dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-journal-"));
process.env.DOSSIER_DONNEES = dossier;
const { SessionApprenti } = await import("../src/coach.ts");
const { annoter, calculerMetriques, coutUsd, journalDisque, lireSeance, nouvelleSeance, seancesDeLecon } = await import("../src/journal.ts");

after(() => rm(dossier, { recursive: true, force: true }));

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

function lecon(): Lecon {
  const etape = (numero: number) => ({
    id: `etape-${numero}`, numero, titre: `Étape ${numero}`, consigne: `Consigne ${numero}`,
    pointsDeControle: [], erreursFrequentes: [], criteresDeReussite: [],
    debut: 0, fin: 5, clip: null, clipLunettes: null, images: [], surveiller: true,
  });
  return {
    id: "aaaaaaaaaaaa", titre: "Baguette", metier: "boulangerie", source: "video",
    creeLe: "2026-09-29T08:00:00.000Z", statut: "prete", erreur: null,
    etapes: [etape(1), etape(2)],
    regles: [
      { id: "r1", etapeId: "etape-1", texte: "La lame inclinée à 30° est normale.", creeLe: "", source: null },
      { id: "r2", etapeId: null, texte: "Ne commente pas la couleur du plan de travail.", creeLe: "", source: null },
      { id: "r3", etapeId: "etape-2", texte: "Règle de l'étape 2.", creeLe: "", source: null },
    ],
  };
}

/** Le journal s'écrit en arrière-plan : on attend qu'il ait fini (jusqu'à 5 s si la machine est chargée). */
async function attendreEcritures(seanceId?: string, interventions?: number) {
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (!seanceId) return;
    const lue = await lireSeance(seanceId);
    if (lue && lue.interventions.length >= (interventions ?? 0) && lue.seance.termine) return;
  }
}

test("coût d'un appel à l'IA", () => {
  const cout = coutUsd({ entree: 1_000_000, sortie: 100_000, cacheLecture: 1_000_000, cacheEcriture: 0 }, "claude-opus-5-5");
  assert.equal(cout, 4 + 2 + 0.2);
  assert.equal(coutUsd(null), 0);
});

test("une séance journalise chaque analyse avec ses images, les règles du maître sont transmises à l'IA", async () => {
  const verdicts: Verdict[] = [
    { verdict: "correction", message: "Roule plus long.", pointsValides: [], usage: { entree: 1000, sortie: 100, cacheLecture: 5000, cacheEcriture: 0 } },
    { verdict: "en_cours", message: "", pointsValides: [] },
    { verdict: "etape_reussie", message: "Bravo", pointsValides: [] },
    { verdict: "etape_reussie", message: "Parfait", pointsValides: [] },
  ];
  const reglesVues: string[][] = [];
  const session = new SessionApprenti(lecon(), {
    apprenti: "Léa",
    evaluateur: async (options) => {
      reglesVues.push(options.regles);
      return verdicts.shift()!;
    },
    chargerImage: async () => JPEG,
    preparerImages: async (i) => i,
    journal: (s) => journalDisque(nouvelleSeance(s.id, s.lecon, s.apprenti, "etape-1")),
  });
  for (let i = 0; i < 4; i++) await session.recevoirVideo([JPEG, JPEG, JPEG]);
  await attendreEcritures(session.id, 4);

  // Étape 1 : règle de l'étape + règle de toute la leçon ; étape 2 : sa règle + celle de la leçon.
  assert.deepEqual(reglesVues[0], ["La lame inclinée à 30° est normale.", "Ne commente pas la couleur du plan de travail."]);
  assert.deepEqual(reglesVues[3], ["Ne commente pas la couleur du plan de travail.", "Règle de l'étape 2."]);

  const lue = await lireSeance(session.id);
  assert.ok(lue);
  assert.equal(lue.seance.apprenti, "Léa");
  assert.equal(lue.seance.termine, true);
  assert.deepEqual(lue.seance.evenements.map((e) => e.type), ["etape", "etape_reussie", "etape", "etape_reussie", "termine"]);
  assert.equal(lue.interventions.length, 4);
  const [correction, silence] = lue.interventions;
  assert.equal(correction.verdict, "correction");
  assert.equal(correction.dit, true);
  assert.equal(correction.images.length, 3);
  assert.ok(correction.coutUsd > 0);
  assert.equal(silence.dit, false);

  const annotee = await annoter(session.id, correction.id, { avis: "fausse", commentaire: "C'est normal", regleId: null, le: "" });
  assert.equal(annotee?.annotation?.avis, "fausse");
  assert.equal((await seancesDeLecon("aaaaaaaaaaaa")).length, 1);
});

test("métriques du pilote : précision, fausses, ratées, durées, coût, séances terminées", () => {
  const l = lecon();
  const t = (s: number) => new Date(Date.parse("2026-09-29T09:00:00.000Z") + s * 1000).toISOString();
  const intervention = (verdict: Intervention["verdict"], avis: Avis | null, dit = true, latenceMs = 3000): Intervention => ({
    id: "00001", seanceId: "s", leconId: l.id, etapeId: "etape-1", etapeNumero: 1, t: t(0),
    verdict, message: "m", dit, pointsValides: [], images: [], latenceMs, usage: null, coutUsd: 0.01,
    annotation: avis ? { avis, commentaire: "", regleId: null, le: "" } : null,
  });
  const seance = (id: string, termine: boolean, evenements: Seance["evenements"]): Seance => ({
    id, leconId: l.id, apprenti: id, debut: t(0), derniereActivite: t(0), termine, evenements,
  });
  const m = calculerMetriques(l, [
    {
      seance: seance("a", true, [
        { t: t(0), type: "etape", etapeId: "etape-1" },
        { t: t(60), type: "etape_reussie", etapeId: "etape-1" },
        { t: t(60), type: "etape", etapeId: "etape-2" },
        { t: t(100), type: "etape_reussie", etapeId: "etape-2" },
        { t: t(100), type: "termine", etapeId: "etape-2" },
      ]),
      interventions: [
        intervention("correction", "juste"),
        intervention("correction", "juste"),
        intervention("correction", "fausse"),
        intervention("correction", "inutile"),
        intervention("correction", null),
        intervention("en_cours", "manquee", false),
        intervention("en_cours", "ok", false),
        intervention("etape_reussie", "juste", true, 5000),
      ],
    },
    {
      seance: seance("b", false, [
        { t: t(0), type: "etape", etapeId: "etape-1" },
        { t: t(120), type: "etape_reussie", etapeId: "etape-1" },
        { t: t(120), type: "etape", etapeId: "etape-2" },
        { t: t(130), type: "etape_passee", etapeId: "etape-2" },
      ]),
      interventions: [intervention("correction", "juste", true, 1000)],
    },
  ]);
  assert.equal(m.seances, 2);
  assert.equal(m.tauxTermine, 0.5);
  assert.equal(m.correctionsDites, 6);
  assert.equal(m.correctionsJugees, 5);
  assert.equal(m.precision, 3 / 5);
  assert.equal(m.tauxFausses, 1 / 5);
  assert.equal(m.tauxInutiles, 1 / 5);
  assert.equal(m.erreursManquees, 1);
  assert.equal(m.detection, 3 / 4);
  assert.equal(m.validationsJustes, 1);
  assert.equal(m.latenceMedianeMs, 3000);
  assert.equal(Math.round(m.coutTotalUsd * 100), 9);
  assert.equal(m.dureeMedianeSeanceS, 100);
  assert.equal(m.etapes[0].dureeMedianeS, 90); // 60 s et 120 s
  assert.equal(m.etapes[0].reussitesAuto, 2);
  assert.equal(m.etapes[1].passagesManuels, 1);
  assert.equal(m.etapes[1].reussitesAuto, 1);
});
