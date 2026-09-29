// Page de réglages affichée dans l'appli Mentra (webview) : choix du mode et de la leçon.

import type {ResumeLecon} from "./cerveau"
import type {Reglages} from "./controleur"

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]!)

export function pageReglages(reglages: Reglages, lecons: ResumeLecon[], erreur: string | null): string {
  const options = lecons
    .filter((l) => l.statut === "prete")
    .map(
      (l) =>
        `<option value="${echapper(l.id)}" ${l.id === reglages.leconId ? "selected" : ""}>${echapper(l.titre)} (${echapper(l.metier)})</option>`,
    )
    .join("")
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maître &amp; Apprenti</title>
<style>
  :root { --fond:#faf6f0; --surface:#fff; --texte:#2b2118; --doux:#7a6a5a; --bord:#e8dccd; --accent:#b5651d; --accent-texte:#fff; --alerte:#a8471c; color-scheme: light dark; }
  @media (prefers-color-scheme: dark) { :root { --fond:#1b1714; --surface:#26201b; --texte:#f3ebe2; --doux:#b4a595; --bord:#3a3029; --accent:#e0914a; --accent-texte:#1b1714; --alerte:#f3a47a; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.5 system-ui, sans-serif; }
  main { max-width:520px; margin:0 auto; padding:16px; }
  h1 { font-size:1.4rem; }
  .carte { background:var(--surface); border:1px solid var(--bord); border-radius:14px; padding:16px; display:grid; gap:12px; margin-bottom:12px; }
  label { display:grid; gap:4px; font-weight:600; }
  input, select { font:inherit; padding:10px 12px; border-radius:10px; border:1px solid var(--bord); background:var(--fond); color:var(--texte); }
  .choix { display:flex; gap:8px; }
  .choix label { flex:1; display:flex; gap:6px; align-items:center; font-weight:400; }
  button { font:inherit; font-weight:600; padding:12px; border-radius:10px; border:none; background:var(--accent); color:var(--accent-texte); }
  .doux { color:var(--doux); font-size:.9rem; }
  .erreur { color:var(--alerte); }
</style>
</head>
<body>
<main>
  <h1>Maître &amp; Apprenti</h1>
  ${erreur ? `<p class="erreur">${echapper(erreur)}</p>` : ""}
  <form class="carte" id="f">
    <div class="choix">
      <label><input type="radio" name="mode" value="apprenti" ${reglages.mode === "apprenti" ? "checked" : ""}> Je suis apprenti</label>
      <label><input type="radio" name="mode" value="maitre" ${reglages.mode === "maitre" ? "checked" : ""}> Je suis le maître</label>
    </div>
    <label id="bloc-lecon">Leçon
      <select name="leconId"><option value="">La plus récente</option>${options}</select>
    </label>
    <label id="bloc-apprenti">Ton prénom <input name="apprenti" value="${echapper(reglages.apprenti)}" autocomplete="given-name"></label>
    <label id="bloc-titre">Titre de la démonstration <input name="titreDemo" value="${echapper(reglages.titreDemo)}" placeholder="Croissant au beurre"></label>
    <label id="bloc-metier">Métier <input name="metierDemo" value="${echapper(reglages.metierDemo)}" placeholder="Boulangerie"></label>
    <button>Enregistrer</button>
    <p class="doux" id="etat"></p>
  </form>
  <p class="doux">Sur les lunettes : appui court pour démarrer, puis pour faire vérifier ton geste ; appui long pour
  l'étape suivante (ou « terminé » en mode maître). À la voix : « vérifie », « explique », « suivant », « précédent »,
  « répète », « pause ».</p>
</main>
<script>
  const f = document.getElementById("f");
  const maj = () => {
    const maitre = f.mode.value === "maitre";
    document.getElementById("bloc-lecon").hidden = maitre;
    document.getElementById("bloc-apprenti").hidden = maitre;
    document.getElementById("bloc-titre").hidden = !maitre;
    document.getElementById("bloc-metier").hidden = !maitre;
  };
  f.addEventListener("change", maj);
  maj();
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const donnees = Object.fromEntries(new FormData(f));
    const r = await fetch("reglages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(donnees) });
    document.getElementById("etat").textContent = r.ok ? "Réglages enregistrés." : "Échec de l'enregistrement.";
  });
</script>
</body>
</html>`
}
