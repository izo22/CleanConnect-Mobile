// Réglages de chaque utilisateur Mentra (leçon choisie, mode), gardés dans un fichier JSON.

import {readFile, rename, writeFile} from "node:fs/promises"
import {REGLAGES_PAR_DEFAUT, type Reglages} from "./controleur"

const FICHIER = process.env.FICHIER_REGLAGES ?? "reglages.json"
let cache: Record<string, Reglages> | null = null

async function tous(): Promise<Record<string, Reglages>> {
  if (!cache) {
    try {
      cache = JSON.parse(await readFile(FICHIER, "utf8")) as Record<string, Reglages>
    } catch {
      cache = {}
    }
  }
  return cache
}

export async function lireReglages(utilisateur: string): Promise<Reglages> {
  return {...REGLAGES_PAR_DEFAUT, ...(await tous())[utilisateur]}
}

export async function ecrireReglages(utilisateur: string, reglages: Reglages): Promise<void> {
  const liste = await tous()
  liste[utilisateur] = reglages
  await writeFile(`${FICHIER}.tmp`, JSON.stringify(liste, null, 2))
  await rename(`${FICHIER}.tmp`, FICHIER)
}

/** Nettoie un objet reçu de la page de réglages. */
export function valider(brut: unknown): Reglages {
  const r = (brut ?? {}) as Record<string, unknown>
  const texte = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "")
  return {
    mode: r.mode === "maitre" ? "maitre" : "apprenti",
    leconId: texte(r.leconId),
    titreDemo: texte(r.titreDemo),
    metierDemo: texte(r.metierDemo),
  }
}
