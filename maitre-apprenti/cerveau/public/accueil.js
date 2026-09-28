import { api, cleAcces, el } from "./commun.js";

const conteneur = document.getElementById("lecons");
const formulaire = document.getElementById("formulaire");
const etatEnvoi = document.getElementById("etat-envoi");
const progression = document.getElementById("progression");
const ouvertes = new Set();
let minuterie = null;

const LIBELLES = { en_preparation: "En préparation…", prete: "Prête", erreur: "Erreur" };

async function afficherLecons() {
  let lecons;
  try {
    lecons = await api("/lecons");
  } catch (erreur) {
    conteneur.replaceChildren(el("p", { classe: "erreur-texte" }, erreur.message));
    return;
  }
  if (lecons.length === 0) {
    conteneur.replaceChildren(el("p", { classe: "vide" }, "Aucune leçon pour l'instant."));
  } else {
    conteneur.replaceChildren(...(await Promise.all(lecons.map(carteLecon))));
  }
  // Tant qu'une leçon est en préparation, on rafraîchit régulièrement.
  clearTimeout(minuterie);
  if (lecons.some((l) => l.statut === "en_preparation")) minuterie = setTimeout(afficherLecons, 5000);
}

async function carteLecon(lecon) {
  const actions = el("div", { classe: "rangee" });
  if (lecon.statut === "prete") {
    actions.append(
      el("a", { classe: "bouton principal", href: `apprenti.html?lecon=${lecon.id}` }, "Apprendre"),
      el("button", {
        onclick: () => {
          ouvertes.has(lecon.id) ? ouvertes.delete(lecon.id) : ouvertes.add(lecon.id);
          afficherLecons();
        },
      }, ouvertes.has(lecon.id) ? "Masquer les étapes" : "Voir les étapes"),
    );
  }
  actions.append(
    el("button", {
      classe: "pousse",
      onclick: async () => {
        if (!confirm(`Supprimer la leçon « ${lecon.titre} » ?`)) return;
        await api(`/lecons/${lecon.id}`, { method: "DELETE" });
        afficherLecons();
      },
    }, "Supprimer"),
  );

  const carte = el(
    "article",
    { classe: "carte" },
    el("div", { classe: "rangee" },
      el("h2", { style: "margin: 0" }, lecon.titre),
      el("span", { classe: `badge ${lecon.statut}` }, LIBELLES[lecon.statut]),
    ),
    el("p", { classe: "vide" },
      `${lecon.metier} · ${lecon.source === "lunettes" ? "filmée avec les lunettes" : "vidéo"}` +
      (lecon.nombreEtapes ? ` · ${lecon.nombreEtapes} étapes` : ""),
    ),
    lecon.erreur ? el("p", { classe: "erreur-texte" }, lecon.erreur) : null,
    actions,
  );

  if (ouvertes.has(lecon.id)) carte.append(await listeEtapes(lecon.id));
  return carte;
}

async function listeEtapes(id) {
  const lecon = await api(`/lecons/${id}`);
  return el("ol", { classe: "etapes" }, ...lecon.etapes.map((etape) => {
    const media = etape.clip
      ? el("video", { src: `/media/lecons/${id}/clips/${etape.clip}`, controls: "", preload: "metadata" })
      : etape.images[0]
        ? el("img", { src: `/media/lecons/${id}/images/${etape.images[0]}`, alt: "", style: "max-width: 360px; border-radius: 10px" })
        : null;
    const details = [
      etape.pointsDeControle.length ? `À vérifier : ${etape.pointsDeControle.join(" · ")}` : null,
      etape.erreursFrequentes.length ? `Erreurs fréquentes : ${etape.erreursFrequentes.join(" · ")}` : null,
      etape.criteresDeReussite.length ? `Réussi quand : ${etape.criteresDeReussite.join(" · ")}` : null,
    ].filter(Boolean);
    return el("li", {},
      el("strong", {}, `${etape.numero}. ${etape.titre}`),
      el("p", { style: "margin: 4px 0" }, etape.consigne),
      ...details.map((d) => el("p", { classe: "details", style: "margin: 2px 0" }, d)),
      media,
    );
  }));
}

formulaire.addEventListener("submit", (evenement) => {
  evenement.preventDefault();
  const fichier = document.getElementById("video").files[0];
  if (!fichier) return;
  const requete = new URLSearchParams({
    titre: document.getElementById("titre").value,
    metier: document.getElementById("metier").value,
    commentaire: document.getElementById("commentaire").value,
  });
  // XMLHttpRequest plutôt que fetch pour afficher la progression de l'envoi.
  const xhr = new XMLHttpRequest();
  xhr.open("POST", `/api/lecons?${requete}`);
  xhr.setRequestHeader("x-cle", cleAcces());
  xhr.setRequestHeader("content-type", fichier.type || "application/octet-stream");
  progression.classList.remove("cache");
  const barre = progression.firstElementChild;
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) barre.style.width = `${(100 * e.loaded) / e.total}%`;
  };
  xhr.onload = () => {
    progression.classList.add("cache");
    barre.style.width = "0";
    if (xhr.status === 202) {
      etatEnvoi.textContent = "Vidéo reçue. L'IA découpe la démonstration en étapes (quelques minutes).";
      formulaire.reset();
      afficherLecons();
    } else {
      let message = `Erreur ${xhr.status}`;
      try { message = JSON.parse(xhr.responseText).erreur ?? message; } catch {}
      etatEnvoi.textContent = message;
    }
  };
  xhr.onerror = () => {
    progression.classList.add("cache");
    etatEnvoi.textContent = "L'envoi a échoué (connexion ?)";
  };
  etatEnvoi.textContent = "Envoi de la vidéo…";
  xhr.send(fichier);
});

afficherLecons();
