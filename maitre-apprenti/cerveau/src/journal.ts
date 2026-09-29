// Journal des séances : chaque intervention de l'IA est gardée avec les images qu'elle a vues,
// pour que le maître puisse la juger et pour mesurer le pilote.
//
// donnees/seances/<id>/seance.json          la séance (apprenti, étapes, fin)
// donnees/seances/<id>/interventions/*.json  une intervention par fichier
// donnees/seances/<id>/images/*.jpg          les images de l'apprenti analysées

import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DOSSIER_DONNEES, idValide } from "./store.ts";
import type { Annotation, Consommation, Evenement, Intervention, Lecon, Seance, TypeEvenement } from "./types.ts";

const DOSSIER_SEANCES = path.join(DOSSIER_DONNEES, "seances");

/** Prix de l'API Claude en dollars par million de jetons (à mettre à jour si les tarifs changent). */
const PRIX: Record<string, { entree: number; sortie: number; cacheLecture: number; cacheEcriture: number }> = {
  "claude-opus-5-5": { entree: 4, sortie: 20, cacheLecture: 0.2, cacheEcriture: 5 },
  "claude-sonnet-5-5": { entree: 2, sortie: 10, cacheLecture: 0.2, cacheEcriture: 2.5 },
};

export function coutUsd(usage: Consommation | null | undefined, modele = process.env.MODELE_IA ?? "claude-opus-5-5"): number {
  if (!usage) return 0;
  const prix = PRIX[modele] ?? PRIX["claude-opus-5-5"];
  return (
    (usage.entree * prix.entree +
      usage.sortie * prix.sortie +
      usage.cacheLecture * prix.cacheLecture +
      usage.cacheEcriture * prix.cacheEcriture) /
    1_000_000
  );
}

async function ecrireJson(fichier: string, donnees: unknown): Promise<void> {
  await writeFile(`${fichier}.tmp`, JSON.stringify(donnees, null, 2));
  await rename(`${fichier}.tmp`, fichier);
}

const dossierSeance = (id: string) => path.join(DOSSIER_SEANCES, id);

/** Ce que la session d'un apprenti envoie au journal (voir coach.ts). */
export interface JournalSeance {
  evenement(type: TypeEvenement, etapeId: string): void;
  intervention(donnees: Omit<Intervention, "id" | "seanceId" | "leconId" | "images" | "annotation" | "coutUsd">, images: Buffer[]): void;
}

/** Journal sur disque d'une séance. Les écritures se font dans l'ordre, sans ralentir la séance. */
export function journalDisque(seance: Seance): JournalSeance {
  const dossier = dossierSeance(seance.id);
  let file: Promise<unknown> = mkdir(path.join(dossier, "interventions"), { recursive: true })
    .then(() => mkdir(path.join(dossier, "images"), { recursive: true }))
    .then(() => ecrireJson(path.join(dossier, "seance.json"), seance));
  let compteur = 0;
  const enchainer = (tache: () => Promise<unknown>) => {
    file = file.then(tache).catch((e: unknown) => console.warn(`Journal ${seance.id} :`, e));
  };

  return {
    evenement(type, etapeId) {
      const evenement: Evenement = { t: new Date().toISOString(), type, etapeId };
      seance.evenements.push(evenement);
      seance.derniereActivite = evenement.t;
      if (type === "termine") seance.termine = true;
      enchainer(() => ecrireJson(path.join(dossier, "seance.json"), seance));
    },
    intervention(donnees, images) {
      const id = String(++compteur).padStart(5, "0");
      const fichiers = images.map((_, k) => `${id}-${k + 1}.jpg`);
      const intervention: Intervention = {
        ...donnees,
        id,
        seanceId: seance.id,
        leconId: seance.leconId,
        images: fichiers,
        coutUsd: coutUsd(donnees.usage),
        annotation: null,
      };
      seance.derniereActivite = donnees.t;
      enchainer(async () => {
        await Promise.all(images.map((image, k) => writeFile(path.join(dossier, "images", fichiers[k]), image)));
        await ecrireJson(path.join(dossier, "interventions", `${id}.json`), intervention);
        await ecrireJson(path.join(dossier, "seance.json"), seance);
      });
    },
  };
}

export function nouvelleSeance(id: string, lecon: Lecon, apprenti: string, premiereEtape: string): Seance {
  const maintenant = new Date().toISOString();
  return {
    id,
    leconId: lecon.id,
    apprenti: apprenti.trim().slice(0, 80) || "Anonyme",
    debut: maintenant,
    derniereActivite: maintenant,
    termine: false,
    evenements: [{ t: maintenant, type: "etape", etapeId: premiereEtape }],
  };
}

// ---------------------------------------------------------------------------
// Lecture et annotation
// ---------------------------------------------------------------------------

export async function lireSeance(id: string): Promise<{ seance: Seance; interventions: Intervention[] } | null> {
  if (!idValide(id)) return null;
  try {
    const seance = JSON.parse(await readFile(path.join(dossierSeance(id), "seance.json"), "utf8")) as Seance;
    const dossier = path.join(dossierSeance(id), "interventions");
    const fichiers = (await readdir(dossier).catch(() => [] as string[])).filter((f) => f.endsWith(".json")).sort();
    const interventions = await Promise.all(
      fichiers.map(async (f) => JSON.parse(await readFile(path.join(dossier, f), "utf8")) as Intervention),
    );
    return { seance, interventions };
  } catch {
    return null;
  }
}

export async function seancesDeLecon(leconId: string): Promise<{ seance: Seance; interventions: Intervention[] }[]> {
  const ids = await readdir(DOSSIER_SEANCES).catch(() => [] as string[]);
  const toutes = await Promise.all(ids.filter(idValide).map(lireSeance));
  return toutes
    .filter((s): s is NonNullable<typeof s> => s !== null && s.seance.leconId === leconId)
    .sort((a, b) => b.seance.debut.localeCompare(a.seance.debut));
}

/** Chemin d'une image de séance, ou null si le nom est suspect. */
export function cheminImageSeance(id: string, fichier: string): string | null {
  if (!idValide(id) || !/^\d{5}-\d{1,2}\.jpg$/.test(fichier)) return null;
  return path.join(dossierSeance(id), "images", fichier);
}

export async function annoter(seanceId: string, interventionId: string, annotation: Annotation): Promise<Intervention | null> {
  if (!idValide(seanceId) || !/^\d{5}$/.test(interventionId)) return null;
  const fichier = path.join(dossierSeance(seanceId), "interventions", `${interventionId}.json`);
  try {
    const intervention = JSON.parse(await readFile(fichier, "utf8")) as Intervention;
    intervention.annotation = annotation;
    await ecrireJson(fichier, intervention);
    return intervention;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Métriques du pilote
// ---------------------------------------------------------------------------

const mediane = (valeurs: number[]): number | null => {
  if (valeurs.length === 0) return null;
  const tries = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tries.length / 2);
  return tries.length % 2 ? tries[milieu] : (tries[milieu - 1] + tries[milieu]) / 2;
};
const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d);
const secondes = (debut: string, fin: string) => (Date.parse(fin) - Date.parse(debut)) / 1000;

export interface Metriques {
  seances: number;
  seancesTerminees: number;
  /** Part des séances terminées (apprenti allé jusqu'au bout). */
  tauxTermine: number | null;
  analyses: number;
  correctionsDites: number;
  correctionsJugees: number;
  /** Corrections jugées justes / corrections jugées. */
  precision: number | null;
  /** Corrections jugées fausses / corrections jugées. */
  tauxFausses: number | null;
  /** Corrections jugées inutiles / corrections jugées. */
  tauxInutiles: number | null;
  /** Silences où le maître estime que l'IA aurait dû corriger. */
  erreursManquees: number;
  /** Corrections justes / (corrections justes + erreurs manquées). */
  detection: number | null;
  validationsJustes: number;
  validationsFausses: number;
  latenceMedianeMs: number | null;
  coutTotalUsd: number;
  coutParSeanceUsd: number | null;
  /** Durée médiane d'une séance terminée, en secondes. */
  dureeMedianeSeanceS: number | null;
  etapes: {
    etapeId: string;
    numero: number;
    titre: string;
    /** Durée médiane pour réussir l'étape seul (validée par l'IA), en secondes. */
    dureeMedianeS: number | null;
    reussitesAuto: number;
    passagesManuels: number;
    corrections: number;
    fausses: number;
  }[];
}

export function calculerMetriques(
  lecon: Lecon,
  seances: { seance: Seance; interventions: Intervention[] }[],
): Metriques {
  const interventions = seances.flatMap((s) => s.interventions);
  const corrections = interventions.filter((i) => i.verdict === "correction" && i.dit);
  const jugees = corrections.filter((i) => i.annotation && ["juste", "fausse", "inutile"].includes(i.annotation.avis));
  const avis = (liste: Intervention[], a: string) => liste.filter((i) => i.annotation?.avis === a).length;
  const justes = avis(jugees, "juste");
  const manquees = avis(interventions.filter((i) => i.verdict === "en_cours"), "manquee");
  const validations = interventions.filter((i) => i.verdict === "etape_reussie");

  // Durées par étape, à partir des événements de chaque séance.
  const durees = new Map<string, number[]>();
  const auto = new Map<string, number>();
  const manuels = new Map<string, number>();
  const dureesSeances: number[] = [];
  for (const { seance } of seances) {
    let debutEtape: Evenement | null = null;
    for (const ev of seance.evenements) {
      if (ev.type === "etape") debutEtape = ev;
      if ((ev.type === "etape_reussie" || ev.type === "etape_passee") && debutEtape?.etapeId === ev.etapeId) {
        const table = ev.type === "etape_reussie" ? auto : manuels;
        table.set(ev.etapeId, (table.get(ev.etapeId) ?? 0) + 1);
        if (ev.type === "etape_reussie") {
          durees.set(ev.etapeId, [...(durees.get(ev.etapeId) ?? []), secondes(debutEtape.t, ev.t)]);
        }
        debutEtape = null;
      }
      if (ev.type === "termine") dureesSeances.push(secondes(seance.debut, ev.t));
    }
  }

  const coutTotal = interventions.reduce((somme, i) => somme + i.coutUsd, 0);
  const terminees = seances.filter((s) => s.seance.termine).length;
  return {
    seances: seances.length,
    seancesTerminees: terminees,
    tauxTermine: ratio(terminees, seances.length),
    analyses: interventions.length,
    correctionsDites: corrections.length,
    correctionsJugees: jugees.length,
    precision: ratio(justes, jugees.length),
    tauxFausses: ratio(avis(jugees, "fausse"), jugees.length),
    tauxInutiles: ratio(avis(jugees, "inutile"), jugees.length),
    erreursManquees: manquees,
    detection: ratio(justes, justes + manquees),
    validationsJustes: avis(validations, "juste"),
    validationsFausses: avis(validations, "fausse"),
    latenceMedianeMs: mediane(interventions.map((i) => i.latenceMs)),
    coutTotalUsd: coutTotal,
    coutParSeanceUsd: ratio(coutTotal, seances.length),
    dureeMedianeSeanceS: mediane(dureesSeances),
    etapes: lecon.etapes.map((etape) => {
      const deLEtape = corrections.filter((i) => i.etapeId === etape.id);
      return {
        etapeId: etape.id,
        numero: etape.numero,
        titre: etape.titre,
        dureeMedianeS: mediane(durees.get(etape.id) ?? []),
        reussitesAuto: auto.get(etape.id) ?? 0,
        passagesManuels: manuels.get(etape.id) ?? 0,
        corrections: deLEtape.length,
        fausses: avis(deLEtape, "fausse"),
      };
    }),
  };
}
