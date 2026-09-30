// Outils partagés par les pages : appels à l'API avec la clé d'accès éventuelle.

const parametres = new URLSearchParams(location.search);
if (parametres.get("cle")) {
  try { localStorage.setItem("cle-acces", parametres.get("cle")); } catch {}
}

export function cleAcces() {
  try { return localStorage.getItem("cle-acces") ?? ""; } catch { return ""; }
}

export async function api(chemin, options = {}) {
  const entetes = { "x-cle": cleAcces(), ...(options.headers ?? {}) };
  if (options.body && typeof options.body === "string") entetes["content-type"] ??= "application/json";
  const reponse = await fetch(`/api${chemin}`, { ...options, headers: entetes });
  const corps = await reponse.json().catch(() => ({}));
  if (reponse.status === 401) {
    const cle = prompt("Clé d'accès du serveur :");
    if (cle) {
      try { localStorage.setItem("cle-acces", cle); } catch {}
      return api(chemin, options);
    }
  }
  if (!reponse.ok) throw new Error(corps.erreur ?? `Erreur ${reponse.status}`);
  return corps;
}

/** Crée un élément avec du texte (jamais de HTML injecté depuis les données). */
export function el(balise, attributs = {}, ...enfants) {
  const noeud = document.createElement(balise);
  for (const [nom, valeur] of Object.entries(attributs)) {
    if (nom === "classe") noeud.className = valeur;
    else if (nom.startsWith("on")) noeud.addEventListener(nom.slice(2), valeur);
    else noeud.setAttribute(nom, valeur);
  }
  for (const enfant of enfants) {
    if (enfant !== null && enfant !== undefined) noeud.append(enfant);
  }
  return noeud;
}

// --- Partager une leçon : QR code à scanner par l'apprenti ---------------------------------

/** Adresse de la leçon pour l'apprenti (avec la clé d'accès du serveur, s'il y en a une). */
export function lienApprenti(leconId) {
  const url = new URL(`/apprenti.html?lecon=${encodeURIComponent(leconId)}`, location.origin);
  if (cleAcces()) url.searchParams.set("cle", cleAcces());
  return url.toString();
}

/** Vrai si la page est ouverte en local : un autre téléphone ne pourrait pas suivre le lien. */
export const adresseLocale = () => ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

/** Le QR code d'une leçon, à afficher dans une page. */
export function qrLecon(leconId) {
  const cle = cleAcces();
  return el("img", {
    classe: "qr",
    alt: "QR code de la leçon, à scanner avec l'appareil photo du téléphone de l'apprenti",
    src: `/api/qr?texte=${encodeURIComponent(lienApprenti(leconId))}${cle ? `&cle=${encodeURIComponent(cle)}` : ""}`,
  });
}

/** Boutons « Envoyer le lien » (partage du téléphone) ou « Copier le lien ». */
export function boutonsLien(leconId, titre) {
  const lien = lienApprenti(leconId);
  const etat = el("span", { classe: "vide", role: "status" });
  const boutons = el("div", { classe: "rangee centre" });
  if (navigator.share) {
    boutons.append(el("button", {
      type: "button",
      onclick: () => navigator.share({ title: titre, text: `Leçon « ${titre} »`, url: lien }).catch(() => undefined),
    }, "Envoyer le lien"));
  }
  boutons.append(
    el("button", {
      type: "button",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(lien);
          etat.textContent = "Lien copié.";
        } catch {
          prompt("Copie ce lien :", lien);
        }
      },
    }, "Copier le lien"),
    etat,
  );
  return boutons;
}

/** Fenêtre « Partager » : le QR code en grand, et le lien à envoyer. */
export function ouvrirPartage(lecon) {
  const fenetre = el("dialog", { classe: "partage", "aria-labelledby": "titre-partage" },
    el("h2", { id: "titre-partage" }, `Partager « ${lecon.titre} »`),
    el("p", {}, "Ton apprenti scanne ce code avec l'appareil photo de son téléphone : il arrive directement dans la leçon."),
    qrLecon(lecon.id),
    adresseLocale()
      ? el("p", { classe: "erreur-texte" }, "Attention : cette page est ouverte en local (localhost). Ouvre-la avec l'adresse publique du serveur pour que le code marche sur un autre téléphone.")
      : null,
    boutonsLien(lecon.id, lecon.titre),
    el("form", { method: "dialog", classe: "rangee centre" }, el("button", { classe: "principal" }, "Fermer")),
  );
  fenetre.addEventListener("close", () => fenetre.remove());
  document.body.append(fenetre);
  fenetre.showModal();
}
