// Alertes instantanées sans IA : règle sur l'écart entre les deux mains (public/mouvement.js).

import assert from "node:assert/strict";
import { test } from "node:test";

type Main = { x: number; y: number };
const chemin: string = "../public/mouvement.js";
const m = (await import(chemin)) as {
  SurveillantMouvement: new (mouvement: string) => { ajouter: (t: number, mains: Main[]) => string | null };
  centrePaume: (reperes: Main[]) => Main;
  ecartMains: (mains: Main[]) => number | null;
};

/** Deux mains à `ecart` l'une de l'autre, centrées sur l'image. */
const mains = (ecart: number): Main[] => [{ x: 0.5 - ecart / 2, y: 0.5 }, { x: 0.5 + ecart / 2, y: 0.5 }];

/** Rejoue une suite d'écarts à 15 mesures par seconde ; renvoie les instants et conseils d'alerte. */
function rejouer(mouvement: string, ecarts: (number | null)[]) {
  const s = new m.SurveillantMouvement(mouvement);
  const alertes: { t: number; conseil: string }[] = [];
  ecarts.forEach((e, k) => {
    const conseil = s.ajouter(k / 15, e === null ? [] : mains(e));
    if (conseil) alertes.push({ t: +(k / 15).toFixed(2), conseil });
  });
  return alertes;
}
function rampe(de: number, a: number, secondes: number): number[] {
  const n = Math.round(secondes * 15);
  return Array.from({ length: n }, (_, k) => de + ((a - de) * k) / (n - 1));
}

test("allonger : les mains s'écartent, pas d'alerte", () => {
  assert.deepEqual(rejouer("s_ecartent", rampe(0.2, 0.9, 4)), []);
});

test("allonger à l'envers : les mains se rapprochent, alerte en un peu plus d'une seconde", () => {
  const alertes = rejouer("s_ecartent", rampe(0.9, 0.2, 4));
  assert.equal(alertes.length, 1);
  assert.ok(alertes[0].t < 1.5, `alerte à ${alertes[0].t} s`);
  assert.equal(alertes[0].conseil, "Pars du centre et écarte les mains vers les bouts.");
});

test("téléphone lent (2 mesures par seconde) : l'alerte arrive quand même, un peu plus tard", () => {
  const s = new m.SurveillantMouvement("s_ecartent");
  const ecarts = rampe(0.9, 0.2, 4).filter((_, k) => k % 7 === 0); // une mesure sur 7 à 15/s ≈ 2/s
  let alerte: number | null = null;
  ecarts.forEach((e, k) => {
    if (alerte === null && s.ajouter((k * 7) / 15, mains(e))) alerte = (k * 7) / 15;
  });
  assert.ok(alerte !== null && alerte <= 3.5, `alerte à ${alerte}`);
});

test("se replacer vite au centre pour recommencer n'est pas une erreur", () => {
  // Écartement, puis retour rapide au centre (0,7 → 0,2 en 0,3 s), puis nouvel écartement.
  const ecarts = [...rampe(0.2, 0.9, 3), ...rampe(0.9, 0.2, 0.3), ...rampe(0.2, 0.9, 3)];
  assert.deepEqual(rejouer("s_ecartent", ecarts), []);
});

test("une main cachée ou un léger tremblement ne déclenchent rien", () => {
  const cachee = rampe(0.9, 0.2, 4).map((e, k) => (k % 3 === 0 ? e : null));
  assert.deepEqual(rejouer("s_ecartent", cachee), []);
  const tremblement = Array.from({ length: 60 }, (_, k) => 0.5 + (k % 2 ? 0.01 : -0.01));
  assert.deepEqual(rejouer("s_ecartent", tremblement), []);
});

test("après une alerte, une pause avant la suivante ; le sens inverse existe aussi", () => {
  assert.equal(rejouer("s_ecartent", rampe(0.9, 0.1, 5)).length, 1);
  assert.equal(rejouer("se_rapprochent", rampe(0.2, 0.9, 4))[0].conseil, "Rapproche les mains vers le centre.");
  assert.throws(() => new m.SurveillantMouvement("danser"), /Mouvement inconnu/);
});

test("centre de la paume et écart entre deux mains", () => {
  const reperes = Array.from({ length: 21 }, () => ({ x: 0.3, y: 0.6 }));
  assert.deepEqual(m.centrePaume(reperes), { x: 0.3, y: 0.6 });
  assert.equal(m.ecartMains([{ x: 0, y: 0 }]), null);
  assert.equal(m.ecartMains([{ x: 0, y: 0 }, { x: 0.3, y: 0.4 }]), 0.5);
});
