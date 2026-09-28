// Stockage des leçons sur disque : un dossier par leçon avec lecon.json, images/ et clips/.

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lecon } from "./types.ts";

export const DOSSIER_DONNEES = path.resolve(process.env.DOSSIER_DONNEES ?? "donnees");
const DOSSIER_LECONS = path.join(DOSSIER_DONNEES, "lecons");

export function nouvelId(): string {
  return randomBytes(6).toString("hex");
}

/** Accepte seulement les identifiants produits par nouvelId (évite de sortir du dossier). */
export function idValide(id: string): boolean {
  return /^[a-f0-9]{12}$/.test(id);
}

export function dossierLecon(id: string): string {
  return path.join(DOSSIER_LECONS, id);
}

export async function preparerDossierLecon(id: string): Promise<string> {
  const dossier = dossierLecon(id);
  await mkdir(path.join(dossier, "images"), { recursive: true });
  await mkdir(path.join(dossier, "clips"), { recursive: true });
  return dossier;
}

export async function sauverLecon(lecon: Lecon): Promise<void> {
  const dossier = await preparerDossierLecon(lecon.id);
  const fichier = path.join(dossier, "lecon.json");
  // Écriture atomique : on ne laisse jamais un lecon.json à moitié écrit.
  await writeFile(`${fichier}.tmp`, JSON.stringify(lecon, null, 2));
  await rename(`${fichier}.tmp`, fichier);
}

export async function lireLecon(id: string): Promise<Lecon | null> {
  if (!idValide(id)) return null;
  try {
    const brut = await readFile(path.join(dossierLecon(id), "lecon.json"), "utf8");
    return JSON.parse(brut) as Lecon;
  } catch {
    return null;
  }
}

export async function listerLecons(): Promise<Lecon[]> {
  let ids: string[];
  try {
    ids = await readdir(DOSSIER_LECONS);
  } catch {
    return [];
  }
  const lecons = await Promise.all(ids.filter(idValide).map(lireLecon));
  return lecons
    .filter((l): l is Lecon => l !== null)
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
}

export async function supprimerLecon(id: string): Promise<void> {
  if (!idValide(id)) return;
  await rm(dossierLecon(id), { recursive: true, force: true });
}

/** Chemin d'un média de la leçon, ou null si le nom est suspect. */
export function cheminMedia(id: string, type: "images" | "clips", fichier: string): string | null {
  if (!idValide(id) || !/^[\w.-]+$/.test(fichier) || fichier.startsWith(".")) return null;
  return path.join(dossierLecon(id), type, fichier);
}

export function urlMedia(id: string, type: "images" | "clips", fichier: string): string {
  return `/media/lecons/${id}/${type}/${fichier}`;
}
