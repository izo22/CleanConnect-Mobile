// Accueil : « Je suis le maître » ou « Je suis l'apprenti », puis une seule chose à faire par écran.

import { api, cleAcces, el, ouvrirPartage } from "./commun.js";

const $ = (id) => document.getElementById(id);
let minuterie = null;

const ETATS = { en_preparation: "En préparation…", prete: "Prête", erreur: "Problème" };

// --- Navigation : #maitre, #apprenti, ou le choix -------------------------------------------

function afficherVue() {
  const vue = location.hash.slice(1);
  for (const nom of ["choix", "maitre", "apprenti"]) {
    $(`vue-${nom}`).classList.toggle("cache", nom !== (vue === "maitre" || vue === "apprenti" ? vue : "choix"));
  }
  try { localStorage.setItem("role", vue); } catch {}
  clearTimeout(minuterie);
  if (vue === "maitre") afficherLeconsMaitre();
  if (vue === "apprenti") afficherLeconsApprenti();
}
window.addEventListener("hashchange", afficherVue);

// --- Le maître -----------------------------------------------------------------------------

async function afficherLeconsMaitre() {
  let lecons;
  try {
    lecons = await api("/lecons");
  } catch (erreur) {
    $("lecons-maitre").replaceChildren(el("p", { classe: "erreur-texte" }, erreur.message));
    return;
  }
  $("lecons-maitre").replaceChildren(
    ...(lecons.length === 0
      ? [el("p", { classe: "vide" }, "Pas encore de leçon. Filme ton premier geste : ça prend quelques minutes.")]
      : lecons.map(carteMaitre)),
  );
  // Tant qu'une leçon est en préparation, on rafraîchit.
  if (lecons.some((l) => l.statut === "en_preparation")) minuterie = setTimeout(afficherLeconsMaitre, 5000);
}

function carteMaitre(lecon) {
  const actions = el("div", { classe: "rangee" });
  if (lecon.statut === "prete") {
    actions.append(
      el("button", { type: "button", classe: "principal", onclick: () => ouvrirPartage(lecon) }, "📲 Partager"),
      el("a", { classe: "bouton", href: `fiche.html?lecon=${lecon.id}` }, "📖 Relire la fiche"),
      el("a", { classe: "bouton", href: `evaluation.html?lecon=${lecon.id}` }, "✔ Juger l'IA"),
    );
  }
  const plus = el("details", { classe: "menu-plus pousse" },
    el("summary", { "aria-label": `Autres actions pour ${lecon.titre}` }, "⋯"),
    el("button", {
      type: "button",
      onclick: async () => {
        if (!confirm(`Supprimer la leçon « ${lecon.titre} » ?`)) return;
        await api(`/lecons/${lecon.id}`, { method: "DELETE" });
        afficherLeconsMaitre();
      },
    }, "Supprimer la leçon"),
  );
  actions.append(plus);
  return el("article", { classe: "carte" },
    el("div", { classe: "rangee" },
      el("h2", { style: "margin: 0" }, lecon.titre),
      el("span", { classe: `badge ${lecon.statut}` }, ETATS[lecon.statut]),
    ),
    el("p", { classe: "vide" }, `${lecon.metier}${lecon.nombreEtapes ? ` · ${lecon.nombreEtapes} étapes` : ""}`),
    lecon.statut === "en_preparation" ? el("p", { classe: "vide" }, "L'IA découpe ta démonstration en étapes. Quelques minutes…") : null,
    lecon.erreur ? el("p", { classe: "erreur-texte" }, `La préparation a échoué : ${lecon.erreur}`) : null,
    actions,
  );
}

// Envoi d'une vidéo déjà filmée (avec la progression).
$("formulaire").addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const fichier = $("video").files[0];
  if (!fichier) return;
  const requete = new URLSearchParams({ titre: $("titre").value, metier: $("metier").value, commentaire: $("commentaire").value });
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/lecons?${requete}`);
  xhr.setRequestHeader("x-cle", cleAcces());
  xhr.setRequestHeader("content-type", fichier.type || "application/octet-stream");
  const barre = $("progression").firstElementChild;
  $("progression").classList.remove("cache");
  xhr.upload.onprogress = (e) => e.lengthComputable && (barre.style.width = `${(100 * e.loaded) / e.total}%`);
  xhr.onload = () => {
    $("progression").classList.add("cache");
    barre.style.width = "0";
    if (xhr.status === 202) {
      $("etat-envoi").textContent = "Vidéo reçue. L'IA prépare la leçon (quelques minutes).";
      $("formulaire").reset();
      afficherLeconsMaitre();
    } else {
      let message = `Erreur ${xhr.status}`;
      try { message = JSON.parse(xhr.responseText).erreur ?? message; } catch {}
      $("etat-envoi").textContent = message;
    }
  };
  xhr.onerror = () => {
    $("progression").classList.add("cache");
    $("etat-envoi").textContent = "L'envoi a échoué (connexion ?)";
  };
  $("etat-envoi").textContent = "Envoi de la vidéo…";
  xhr.send(fichier);
});

// --- L'apprenti ----------------------------------------------------------------------------

async function afficherLeconsApprenti() {
  let lecons;
  try {
    lecons = (await api("/lecons")).filter((l) => l.statut === "prete");
  } catch (erreur) {
    $("lecons-apprenti").replaceChildren(el("p", { classe: "erreur-texte" }, erreur.message));
    return;
  }
  $("lecons-apprenti").replaceChildren(
    ...(lecons.length === 0
      ? [el("p", { classe: "vide" }, "Pas encore de leçon prête. Demande à ton maître de filmer son geste.")]
      : lecons.map((lecon) =>
          el("a", { classe: "tuile", href: `apprenti.html?lecon=${lecon.id}` },
            el("span", { classe: "tuile-titre" }, lecon.titre),
            el("span", { classe: "vide" }, `${lecon.metier} · ${lecon.nombreEtapes} étapes`),
            el("span", { classe: "tuile-action" }, "Commencer →"),
          ))),
  );
}

// --- Démarrage : on revient là où on était la dernière fois -------------------------------

if (!location.hash) {
  try {
    const role = localStorage.getItem("role");
    if (role === "maitre" || role === "apprenti") history.replaceState(null, "", `#${role}`);
  } catch {}
}
afficherVue();
