import { api, cleAcces, el } from "./commun.js";

const $ = (id) => document.getElementById(id);
const leconId = new URLSearchParams(location.search).get("lecon");
let lecon = null;
let seanceChoisie = null;

const pourcent = (x) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);
const duree = (s) => (s === null || s === undefined ? "—" : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, "0")}`);
const dollars = (x) => (x === null || x === undefined ? "—" : `${x.toFixed(x < 1 ? 3 : 2)} $`);
const titreEtape = (id) => lecon.etapes.find((e) => e.id === id)?.titre ?? id;

// --- Mesures -----------------------------------------------------------------------

async function afficherMesures() {
  const m = await api(`/lecons/${leconId}/metriques`);
  const carte = (valeur, libelle, detail) =>
    el("div", { classe: "mesure" }, el("div", { classe: "valeur" }, valeur), el("div", { classe: "libelle" }, libelle), detail ? el("div", { classe: "detail" }, detail) : null);
  $("mesures").replaceChildren(
    carte(pourcent(m.precision), "Corrections justes", `${m.correctionsJugees} jugées sur ${m.correctionsDites} dites`),
    carte(pourcent(m.tauxFausses), "Corrections fausses", "à faire baisser avec les règles"),
    carte(pourcent(m.tauxInutiles), "Corrections inutiles", "justes mais sans intérêt"),
    carte(String(m.erreursManquees), "Erreurs ratées", `détection : ${pourcent(m.detection)}`),
    carte(`${m.seancesTerminees} / ${m.seances}`, "Séances terminées", pourcent(m.tauxTermine)),
    carte(duree(m.dureeMedianeSeanceS), "Durée médiane d'une leçon", "séances terminées"),
    carte(
      m.coutParHeureUsd === null ? "—" : `${dollars(m.coutParHeureUsd)}/h`,
      "Coût IA par heure de pratique",
      `${dollars(m.coutParSeanceUsd)} par séance · ${dollars(m.coutParAnalyseUsd)} par analyse · ${m.analyses} analyses ` +
        `(demandées ${m.analysesParDeclencheur.demande}, avant « suivant » ${m.analysesParDeclencheur.suivant}, ` +
        `auto ${m.analysesParDeclencheur.auto}, surveillance ${m.analysesParDeclencheur.continu})`,
    ),
    carte(m.latenceMedianeMs === null ? "—" : `${(m.latenceMedianeMs / 1000).toFixed(1)} s`, "Temps de réponse de l'IA", "à ajouter à la durée observée"),
  );
  $("par-etape").replaceChildren(
    el("thead", {}, el("tr", {}, ...["Étape", "Temps médian pour réussir seul", "Validées par l'IA", "Passées à la main", "Vérifications", "Corrections", "Dont fausses"].map((t) => el("th", {}, t)))),
    el("tbody", {}, ...m.etapes.map((e) =>
      el("tr", {},
        el("td", {}, `${e.numero}. ${e.titre}`),
        el("td", {}, duree(e.dureeMedianeS)),
        el("td", {}, String(e.reussitesAuto)),
        el("td", {}, String(e.passagesManuels)),
        el("td", {}, String(e.verifications)),
        el("td", {}, String(e.corrections)),
        el("td", {}, String(e.fausses)),
      ))),
  );
}

// --- Cadence et règles ---------------------------------------------------------------

function afficherRegles() {
  const regles = lecon.regles ?? [];
  $("regles").replaceChildren(
    ...(regles.length === 0
      ? [el("li", { classe: "vide" }, "Aucune règle pour l'instant. Quand tu juges une correction fausse, ton explication peut en devenir une.")]
      : regles.map((r) =>
          el("li", {},
            el("div", {}, el("strong", {}, r.etapeId ? `Étape « ${titreEtape(r.etapeId)} »` : "Toute la leçon"), el("div", {}, r.texte)),
            el("button", {
              type: "button",
              "aria-label": `Supprimer la règle : ${r.texte}`,
              onclick: async () => {
                lecon.regles = await api(`/lecons/${leconId}/regles/${r.id}`, { method: "DELETE" });
                afficherRegles();
              },
            }, "Supprimer"),
          ))),
  );
}

async function enregistrerReglages(reglages) {
  try {
    await api(`/lecons/${leconId}/reglages`, { method: "POST", body: JSON.stringify(reglages) });
    $("etat-reglages").textContent = "Enregistré : les séances en cours en tiennent compte tout de suite.";
  } catch (erreur) {
    $("etat-reglages").textContent = erreur.message;
  }
}

function afficherReglages() {
  $("cadence").value = String(lecon.imagesParSeconde ?? 2);
  $("auto").checked = lecon.verificationAuto === true;
  $("surveillees").replaceChildren(...lecon.etapes.map((etape) => {
    const caseEtape = el("input", { type: "checkbox", value: etape.id });
    caseEtape.checked = etape.surveiller === true;
    caseEtape.addEventListener("change", () => {
      etape.surveiller = caseEtape.checked;
      enregistrerReglages({ etapesSurveillees: lecon.etapes.filter((e) => e.surveiller).map((e) => e.id) });
    });
    return el("label", { classe: "case", style: "margin-top: 6px" }, caseEtape, el("span", {}, `${etape.numero}. ${etape.titre}`));
  }));
}

$("cadence").addEventListener("change", (e) => enregistrerReglages({ imagesParSeconde: Number(e.target.value) }));
$("auto").addEventListener("change", (e) => enregistrerReglages({ verificationAuto: e.target.checked }));

$("form-regle").addEventListener("submit", async (e) => {
  e.preventDefault();
  const texte = $("texte-regle").value.trim();
  if (!texte) return;
  const etapeId = $("etape-regle").value || null;
  const regle = await api(`/lecons/${leconId}/regles`, { method: "POST", body: JSON.stringify({ texte, etapeId }) });
  lecon.regles = [...(lecon.regles ?? []), regle];
  $("texte-regle").value = "";
  afficherRegles();
});

// --- Séances -------------------------------------------------------------------------

async function afficherSeances() {
  const seances = await api(`/lecons/${leconId}/seances`);
  if (seances.length === 0) {
    $("seances").replaceChildren(el("p", { classe: "vide" }, "Aucune séance pour l'instant. Lance la leçon sur les lunettes ou la tablette."));
    return;
  }
  $("seances").replaceChildren(el("div", { classe: "liste-seances" }, ...seances.map((s) =>
    el("button", {
      type: "button",
      classe: `seance ${s.id === seanceChoisie ? "choisie" : ""}`,
      onclick: () => choisirSeance(s.id),
    },
      el("strong", {}, s.apprenti),
      el("span", {}, new Date(s.debut).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })),
      el("span", { classe: `badge ${s.termine ? "prete" : ""}` }, s.termine ? "Terminée" : "Non terminée"),
      el("span", { classe: "vide" }, `${s.correctionsDites} corrections · ${s.jugees}/${s.analyses} jugées`),
    ))));
}

async function choisirSeance(id) {
  seanceChoisie = id;
  afficherSeances();
  await afficherInterventions();
  $("bloc-interventions").classList.remove("cache");
  $("bloc-interventions").scrollIntoView({ behavior: "smooth" });
}

// --- Interventions et avis du maître ------------------------------------------------

const LIBELLES = {
  correction: "Correction",
  etape_reussie: "Validation d'étape",
  en_cours: "Silence",
  pas_visible: "« Je ne vois pas bien »",
};
const DECLENCHEURS = {
  demande: "demandée par l'apprenti",
  suivant: "avant « suivant »",
  auto: "automatique (fin de geste)",
  continu: "surveillance continue",
};
const BOUTONS = {
  correction: [["juste", "Juste"], ["fausse", "Fausse"], ["inutile", "Inutile"]],
  pas_visible: [["juste", "Justifié"], ["inutile", "Inutile"]],
  etape_reussie: [["juste", "Juste"], ["fausse", "Validée à tort"]],
  en_cours: [["ok", "Rien à dire"], ["manquee", "Erreur ratée"]],
};

async function afficherInterventions() {
  const { seance, interventions } = await api(`/seances/${seanceChoisie}`);
  $("titre-seance").textContent = `Séance de ${seance.apprenti}`;
  const avecSilences = $("silences").checked;
  // Une vérification demandée reçoit toujours une réponse, même sans erreur : elle reste visible.
  const visibles = interventions.filter((i) => avecSilences || i.verdict !== "en_cours" || i.dit);
  const debut = Date.parse(seance.debut);
  $("interventions").replaceChildren(
    ...(visibles.length === 0
      ? [el("p", { classe: "vide" }, "L'IA n'a rien dit pendant cette séance. Coche « Montrer aussi les silences » pour vérifier qu'elle n'a rien raté.")]
      : visibles.map((i) => carteIntervention(i, debut))),
  );
}
$("silences").addEventListener("change", () => seanceChoisie && afficherInterventions());

function carteIntervention(i, debut) {
  const secondes = Math.max(0, Math.round((Date.parse(i.t) - debut) / 1000));
  const cle = cleAcces() ? `?cle=${encodeURIComponent(cleAcces())}` : "";
  const detail = el("div", { classe: "detail-avis cache" });
  const carte = el("article", { classe: `carte intervention ${i.verdict}` },
    el("div", { classe: "rangee" },
      el("span", { classe: `badge ${i.verdict}` }, i.verdict === "en_cours" && i.dit ? "Rien de faux" : LIBELLES[i.verdict] ?? i.verdict),
      el("span", {}, `Étape ${i.etapeNumero} · ${titreEtape(i.etapeId)}`),
      el("span", { classe: "vide" }, DECLENCHEURS[i.declencheur ?? "continu"]),
      el("span", { classe: "vide pousse" }, `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")} · réponse en ${(i.latenceMs / 1000).toFixed(1)} s${i.dit ? "" : " · non dite"}`),
    ),
    i.message ? el("p", { classe: "message" }, `« ${i.message} »`) : null,
    el("div", { classe: "images" }, ...i.images.map((f, k) =>
      el("img", { src: `/api/seances/${i.seanceId}/images/${f}${cle}`, alt: `Image ${k + 1} sur ${i.images.length} de l'apprenti`, loading: "lazy" }))),
    el("div", { classe: "rangee avis" }, ...(BOUTONS[i.verdict] ?? []).map(([avis, libelle]) =>
      el("button", {
        type: "button",
        "aria-pressed": String(i.annotation?.avis === avis),
        onclick: () => (avis === "fausse" || avis === "manquee" ? ouvrirExplication(i, avis, detail) : enregistrer(i, avis, "", false, "etape")),
      }, libelle))),
    i.annotation?.commentaire ? el("p", { classe: "vide" }, `Ton explication : ${i.annotation.commentaire}${i.annotation.regleId ? " (devenue une règle)" : ""}`) : null,
    detail,
  );
  return carte;
}

/** « Fausse » ou « Erreur ratée » : le maître explique, et son explication peut devenir une règle. */
function ouvrirExplication(i, avis, detail) {
  const idTexte = `explication-${i.seanceId}-${i.id}`;
  const texte = el("textarea", {
    id: idTexte,
    placeholder: avis === "fausse"
      ? "Pourquoi c'est faux ? Ex. : Cette inclinaison est normale pour cette pâte."
      : "Qu'aurait-il fallu dire ? Ex. : Signale quand la pâte est roulée seulement au milieu.",
  });
  const regle = el("input", { type: "checkbox", id: `${idTexte}-regle` });
  regle.checked = true;
  const portee = el("select", { id: `${idTexte}-portee` },
    el("option", { value: "etape" }, "pour cette étape"),
    el("option", { value: "lecon" }, "pour toute la leçon"));
  detail.replaceChildren(
    el("label", { for: idTexte }, avis === "fausse" ? "Explique à l'IA" : "Ce qu'il fallait dire"),
    texte,
    el("div", { classe: "rangee", style: "margin-top: 8px" },
      el("label", { classe: "case", style: "margin: 0" }, regle, el("span", {}, "En faire une règle")),
      el("label", { for: `${idTexte}-portee`, classe: "sr" }, "Portée de la règle"),
      portee,
      el("button", { type: "button", classe: "principal pousse", onclick: () => enregistrer(i, avis, texte.value, regle.checked, portee.value) }, "Enregistrer"),
    ),
  );
  detail.classList.remove("cache");
  texte.focus();
}

async function enregistrer(i, avis, commentaire, regle, portee) {
  if (regle && !commentaire.trim()) {
    alert("Écris une explication pour en faire une règle.");
    return;
  }
  const reponse = await api(`/seances/${i.seanceId}/interventions/${i.id}/annotation`, {
    method: "POST",
    body: JSON.stringify({ avis, commentaire, regle, portee }),
  });
  if (reponse.regle) {
    lecon.regles = [...(lecon.regles ?? []), reponse.regle];
    afficherRegles();
  }
  await Promise.all([afficherInterventions(), afficherMesures(), afficherSeances()]);
}

// --- Démarrage -----------------------------------------------------------------------

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
  $("titre").textContent = `Évaluation — ${lecon.titre}`;
  document.title = `Évaluation — ${lecon.titre}`;
  $("lien-fiche").href = `fiche.html?lecon=${lecon.id}`;
  afficherReglages();
  $("etape-regle").replaceChildren(
    el("option", { value: "" }, "Toute la leçon"),
    ...lecon.etapes.map((e) => el("option", { value: e.id }, `Étape ${e.numero} · ${e.titre}`)),
  );
  afficherRegles();
  await Promise.all([afficherMesures(), afficherSeances()]);
})();
