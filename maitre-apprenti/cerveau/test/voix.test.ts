// Commandes vocales des pages web (téléphone ou tablette sur un support).

import assert from "node:assert/strict";
import { test } from "node:test";

const chemin: string = "../public/voix.js";
const voix = (await import(chemin)) as {
  commandeApprenti: (texte: string) => string | null;
  commandeMaitre: (texte: string) => string | null;
  reconnaissanceDisponible: () => boolean;
};

test("commandes de l'apprenti, courtes seulement", () => {
  assert.equal(voix.commandeApprenti("Vérifie"), "verifier");
  assert.equal(voix.commandeApprenti("c'est bon comme ça ?"), "verifier");
  assert.equal(voix.commandeApprenti("Explique-moi"), "expliquer");
  assert.equal(voix.commandeApprenti("Suivant !"), "suivant");
  assert.equal(voix.commandeApprenti("précédent"), "precedent");
  assert.equal(voix.commandeApprenti("tu peux répéter"), "repeter");
  assert.equal(voix.commandeApprenti("on recommence"), "recommencer");
  assert.equal(voix.commandeApprenti("montre le geste"), "montrer");
  assert.equal(voix.commandeApprenti("je prends le suivant dans la corbeille"), null);
  assert.equal(voix.commandeApprenti(""), null);
});

test("commandes du maître : le reste est son explication", () => {
  assert.equal(voix.commandeMaitre("Étape suivante"), "etape");
  assert.equal(voix.commandeMaitre("c'est terminé"), "terminer");
  assert.equal(voix.commandeMaitre("je rabats la pâte vers moi en appuyant"), null);
  // Hors navigateur, pas de reconnaissance vocale : les pages proposent alors les boutons.
  assert.equal(voix.reconnaissanceDisponible(), false);
});
