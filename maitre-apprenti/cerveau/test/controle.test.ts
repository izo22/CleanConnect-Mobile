// Contrôle de l'installation du téléphone (page apprenti et page maître), sur des images synthétiques.

import assert from "node:assert/strict";
import { test } from "node:test";

interface Image { gris: Uint8Array; largeur: number; hauteur: number }
interface Resultat { ok: boolean; points: { nom: string; ok: boolean; message: string }[] }
const chemin: string = "../public/controle.js";
const controle = (await import(chemin)) as {
  evaluerInstallation: (images: Image[]) => Resultat;
  niveauxDeGris: (rgba: Uint8ClampedArray) => Uint8Array;
};

const L = 160;
const H = 90;
/** Image 160×90 dont chaque pixel vaut f(x, y). */
const image = (f: (x: number, y: number) => number): Image => {
  const gris = new Uint8Array(L * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < L; x++) gris[y * L + x] = f(x, y);
  return { gris, largeur: L, hauteur: H };
};
/** Plan de travail net : un damier contrasté (bords francs). */
const damier = (decalage = 0) => image((x, y) => ((Math.floor((x + decalage) / 8) + Math.floor(y / 8)) % 2 ? 190 : 70));
const probleme = (r: Resultat, nom: string) => r.points.find((p) => p.nom === nom)!;

test("installation correcte : tout est bon", () => {
  const r = controle.evaluerInstallation([damier(), damier(), damier(), damier()]);
  assert.equal(r.ok, true, JSON.stringify(r.points));
});

test("trop sombre, contre-jour, flou, téléphone qui bouge : un conseil concret pour chacun", () => {
  const sombre = image((x, y) => ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 30 : 10));
  assert.match(probleme(controle.evaluerInstallation([sombre, sombre]), "Lumière").message, /Trop sombre/);

  const fenetre = image((x, y) => (x > 100 ? 255 : (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? 150 : 60));
  assert.match(probleme(controle.evaluerInstallation([fenetre, fenetre]), "Lumière").message, /contre-jour/);

  const noire = image(() => 0);
  const r0 = controle.evaluerInstallation([noire, noire]);
  assert.match(probleme(r0, "Lumière").message, /objectif est-il masqué/);
  assert.equal(probleme(r0, "Netteté").ok, true); // un seul conseil utile, pas deux

  const flou = image((x) => 60 + x / 2); // dégradé doux, sans aucun bord
  assert.match(probleme(controle.evaluerInstallation([flou, flou]), "Netteté").message, /floue/);

  // Toute l'image se décale d'une prise à l'autre : c'est le téléphone qui bouge, pas les mains.
  const r = controle.evaluerInstallation([damier(0), damier(8), damier(0), damier(8)]);
  assert.match(probleme(r, "Stabilité").message, /bouge/);
  assert.equal(r.ok, false);
});

test("conversion en niveaux de gris", () => {
  assert.deepEqual([...controle.niveauxDeGris(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))], [255, 0]);
});
