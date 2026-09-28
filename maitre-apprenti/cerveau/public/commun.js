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
