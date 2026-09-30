// Vérifie l'installation avant de lancer le serveur ou les tests, et dit quoi faire quand
// quelque chose manque. Écrit en JavaScript simple pour tourner même sur un Node trop ancien.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const requerir = createRequire(path.join(RACINE, "package.json"));
const NODE_MINIMUM = [22, 6];

const erreurs = [];
const remarques = [];

const [majeur, mineur] = process.versions.node.split(".").map(Number);
if (majeur < NODE_MINIMUM[0] || (majeur === NODE_MINIMUM[0] && mineur < NODE_MINIMUM[1])) {
  erreurs.push(`Node ${process.versions.node} est trop ancien : il faut Node ${NODE_MINIMUM.join(".")} ou plus (https://nodejs.org).`);
}

// On regarde le dossier plutôt que require.resolve : certains paquets n'exportent pas leur package.json.
const paquetsManquants = ["@anthropic-ai/sdk", "@mediapipe/tasks-vision", "ffmpeg-static", "qrcode"].filter(
  (nom) => !existsSync(path.join(RACINE, "node_modules", nom, "package.json")),
);
if (paquetsManquants.length) {
  erreurs.push(`Dépendances absentes (${paquetsManquants.join(", ")}) : lance « npm ci » (ou « npm install ») dans le dossier cerveau.`);
}

if (!paquetsManquants.includes("ffmpeg-static") || process.env.FFMPEG_PATH) {
  const ffmpeg = process.env.FFMPEG_PATH ?? requerir("ffmpeg-static");
  const essai = ffmpeg ? spawnSync(ffmpeg, ["-version"], { encoding: "utf8" }) : null;
  if (!essai || essai.status !== 0) {
    erreurs.push(
      `ffmpeg ne se lance pas (${ffmpeg ?? "chemin inconnu"}). Son téléchargement a sans doute échoué pendant l'installation ` +
        "(réseau filtré, ou « --ignore-scripts ») : relance « npm rebuild ffmpeg-static », " +
        "ou installe ffmpeg toi-même et indique son chemin dans FFMPEG_PATH.",
    );
  }
}

if (!paquetsManquants.includes("@mediapipe/tasks-vision")) {
  const dossier = path.join(RACINE, "node_modules", "@mediapipe", "tasks-vision");
  if (!existsSync(path.join(dossier, "vision_bundle.mjs")) || !existsSync(path.join(dossier, "wasm"))) {
    erreurs.push("@mediapipe/tasks-vision est incomplet : relance « npm ci ».");
  }
}

if (!existsSync(path.join(RACINE, "modeles", "hand_landmarker.task"))) {
  remarques.push("Modèle de suivi des mains absent : il sera chargé depuis Google. Pour le servir en local : « npm run modeles ».");
}

for (const remarque of remarques) console.log(`ℹ ${remarque}`);
if (erreurs.length) {
  console.error("\nInstallation incomplète :");
  for (const erreur of erreurs) console.error(`  ✗ ${erreur}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ Installation vérifiée (Node ${process.versions.node}, dépendances et ffmpeg présents).`);
