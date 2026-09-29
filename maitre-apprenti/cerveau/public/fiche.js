// Fiche écrite d'une leçon : toutes les étapes en texte, à lire, imprimer, ou corriger par le maître.

import { api, cleAcces, el } from "./commun.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");
let lecon = null;
let enModification = false;

const cle = () => (cleAcces() ? `?cle=${encodeURIComponent(cleAcces())}` : "");

/** Une liste à puces titrée, ou rien si elle est vide. */
function liste(titre, elements, classe) {
  if (!elements?.length) return null;
  return el("div", { classe: `bloc-liste ${classe}` },
    el("h3", {}, titre),
    el("ul", {}, ...elements.map((e) => el("li", {}, e))));
}

function etapeEnLecture(etape) {
  // L'image du milieu de l'étape montre en général le geste en cours.
  const image = etape.images[Math.floor(etape.images.length / 2)];
  return el("li", { classe: "fiche-etape" },
    image ? el("img", { src: `/media/lecons/${lecon.id}/images/${image}${cle()}`, alt: `Le maître pendant l'étape ${etape.numero}` }) : null,
    el("div", {},
      el("div", { classe: "rangee" },
        el("h2", { style: "margin: 0" }, `${etape.numero}. ${etape.titre}`),
        etape.surveiller ? el("span", { classe: "badge correction" }, "Étape surveillée") : null),
      el("p", { classe: "consigne-fiche" }, etape.consigne),
      etape.explication ? el("p", {}, etape.explication) : null,
      el("div", { classe: "listes" },
        liste("Points clés", etape.pointsDeControle, "cles"),
        liste("À éviter", etape.erreursFrequentes, "eviter"),
        liste("C'est réussi quand", etape.criteresDeReussite, "reussi")),
      etape.paroles?.length
        ? el("div", { classe: "paroles" }, el("h3", {}, "Le maître dit"), ...etape.paroles.map((p) => el("blockquote", {}, `« ${p} »`)))
        : null,
    ));
}

function champ(etape, nom, libelle, valeur, multiligne) {
  const id = `${etape.id}-${nom}`;
  const saisie = multiligne ? el("textarea", { id, rows: "3" }) : el("input", { id, type: "text" });
  saisie.value = valeur;
  return [el("label", { for: id }, libelle), saisie];
}

function etapeEnModification(etape) {
  const etat = el("span", { classe: "vide", role: "status" });
  const lignes = (texte) => texte.split("\n").map((l) => l.trim()).filter(Boolean);
  const formulaire = el("form", { classe: "carte" },
    el("h2", {}, `Étape ${etape.numero}`),
    ...champ(etape, "titre", "Titre", etape.titre, false),
    ...champ(etape, "consigne", "Consigne (lue à voix haute à chaque étape)", etape.consigne, true),
    ...champ(etape, "explication", "Explication détaillée (lue quand l'apprenti dit « explique »)", etape.explication ?? "", true),
    ...champ(etape, "cles", "Points clés (un par ligne)", etape.pointsDeControle.join("\n"), true),
    ...champ(etape, "eviter", "À éviter (un par ligne)", etape.erreursFrequentes.join("\n"), true),
    ...champ(etape, "reussi", "C'est réussi quand (un par ligne)", etape.criteresDeReussite.join("\n"), true),
    el("div", { classe: "rangee", style: "margin-top: 12px" }, el("button", { type: "submit", classe: "principal" }, "Enregistrer"), etat),
  );
  formulaire.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valeur = (nom) => $(`${etape.id}-${nom}`).value;
    etat.textContent = "Enregistrement…";
    try {
      const modifiee = await api(`/lecons/${lecon.id}/etapes/${etape.id}`, {
        method: "POST",
        body: JSON.stringify({
          titre: valeur("titre"),
          consigne: valeur("consigne"),
          explication: valeur("explication"),
          pointsDeControle: lignes(valeur("cles")),
          erreursFrequentes: lignes(valeur("eviter")),
          criteresDeReussite: lignes(valeur("reussi")),
        }),
      });
      Object.assign(etape, modifiee);
      etat.textContent = "Enregistré. Les apprentis en cours de leçon ont déjà le nouveau texte.";
    } catch (erreur) {
      etat.textContent = erreur.message;
    }
  });
  return el("li", {}, formulaire);
}

function afficher() {
  $("etapes").replaceChildren(...lecon.etapes.map(enModification ? etapeEnModification : etapeEnLecture));
  $("modifier").textContent = enModification ? "Terminer les modifications" : "Modifier le texte";
  $("modifier").setAttribute("aria-pressed", String(enModification));
  $("aide-modif").classList.toggle("cache", !enModification);
}

$("modifier").onclick = () => {
  enModification = !enModification;
  afficher();
};
$("imprimer").onclick = () => window.print();

(async () => {
  if (!leconId) {
    $("titre").textContent = "Aucune leçon choisie";
    return;
  }
  try {
    lecon = await api(`/lecons/${leconId}`);
  } catch (erreur) {
    $("titre").textContent = erreur.message;
    return;
  }
  if (lecon.statut !== "prete") {
    $("titre").textContent = `${lecon.titre} : leçon pas encore prête`;
    return;
  }
  $("titre").textContent = lecon.titre;
  document.title = `Fiche — ${lecon.titre}`;
  $("sous-titre").textContent = `${lecon.metier} · ${lecon.etapes.length} étapes`;
  $("apprendre").href = `apprenti.html?lecon=${lecon.id}`;
  afficher();
})();
