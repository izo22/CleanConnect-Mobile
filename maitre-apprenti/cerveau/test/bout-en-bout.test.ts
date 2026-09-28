// Parcours complet avec un faux serveur Claude : vidéo du maître → leçon avec clips → apprenti corrigé.

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

const dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-e2e-"));
process.env.DOSSIER_DONNEES = path.join(dossier, "donnees");
process.env.ANTHROPIC_API_KEY = "cle-de-test";
delete process.env.CLE_ACCES;

interface RequeteClaude {
  entetes: IncomingMessage["headers"];
  corps: Record<string, any>;
}
const requetes: RequeteClaude[] = [];

const ETAPES = {
  etapes: [
    {
      titre: "Pesée", consigne: "Pèse 500 g de farine.", debut_s: 0, fin_s: 4,
      points_de_controle: ["La balance affiche 500 g"], erreurs_frequentes: ["Oublier la tare"],
      criteres_de_reussite: ["500 g de farine dans le bol"], images_reference: [0],
    },
    {
      titre: "Façonnage", consigne: "Roule la pâte en baguette.", debut_s: 4, fin_s: 10,
      points_de_controle: [], erreurs_frequentes: [], criteres_de_reussite: ["Baguette de 55 cm"],
      images_reference: [],
    },
  ],
};

/** Réponse au format de l'API Messages, en flux (SSE) ou d'un bloc. */
function repondre(texte: string, enFlux: boolean) {
  const message = {
    id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [{ type: "text", text: texte }], stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
  if (!enFlux) return { type: "application/json", corps: JSON.stringify(message) };
  const evenements = [
    ["message_start", { type: "message_start", message: { ...message, content: [], stop_reason: null } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: texte } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 10 } }],
    ["message_stop", { type: "message_stop" }],
  ];
  return {
    type: "text/event-stream",
    corps: evenements.map(([nom, data]) => `event: ${nom}\ndata: ${JSON.stringify(data)}\n\n`).join(""),
  };
}

const fauxClaude = createServer(async (req, res) => {
  const morceaux: Buffer[] = [];
  for await (const m of req) morceaux.push(m as Buffer);
  const corps = JSON.parse(Buffer.concat(morceaux).toString("utf8"));
  requetes.push({ entetes: req.headers, corps });
  const texte = String(corps.system).includes("Tu prépares une leçon")
    ? JSON.stringify(ETAPES)
    : JSON.stringify({ verdict: "correction", message: "Remets la balance à zéro.", points_valides: [] });
  const reponse = repondre(texte, corps.stream === true);
  res.writeHead(200, { "content-type": reponse.type });
  res.end(reponse.corps);
});

let base = "";
let serveur: typeof import("../src/server.ts")["serveur"];

before(async () => {
  await new Promise<void>((ok) => fauxClaude.listen(0, "127.0.0.1", ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(fauxClaude.address() as AddressInfo).port}`;
  ({ serveur } = await import("../src/server.ts"));
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
});

after(async () => {
  serveur.closeAllConnections();
  await new Promise((ok) => serveur.close(ok));
  await new Promise((ok) => fauxClaude.close(ok));
  await rm(dossier, { recursive: true, force: true });
});

async function attendreLecon(id: string) {
  for (let essai = 0; essai < 120; essai++) {
    const lecon = await (await fetch(`${base}/api/lecons/${id}`)).json();
    if (lecon.statut !== "en_preparation") return lecon;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  throw new Error("La leçon n'est jamais prête");
}

test("de la vidéo du maître à la correction de l'apprenti", async () => {
  // 1. Le maître envoie une vidéo de 10 s.
  const video = path.join(dossier, "demo.mp4");
  await promisify(execFile)(ffmpegStatic as unknown as string, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=10:size=640x360:rate=25",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", video,
  ]);
  const envoi = await fetch(`${base}/api/lecons?titre=Baguette&metier=Boulangerie&commentaire=500%20g%20de%20farine`, {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: await readFile(video),
  });
  assert.equal(envoi.status, 202);
  const lecon = await attendreLecon((await envoi.json()).id);
  assert.equal(lecon.statut, "prete", lecon.erreur);
  assert.equal(lecon.etapes.length, 2);

  // La requête de construction de leçon est bien formée.
  const construction = requetes[0];
  assert.equal(construction.corps.model, "claude-opus-5-5");
  assert.equal(construction.corps.stream, true);
  assert.equal(construction.corps.fallbacks, "default");
  assert.match(String(construction.entetes["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.equal(construction.corps.output_config.format.type, "json_schema");
  const images = construction.corps.messages[0].content.filter((b: any) => b.type === "image");
  assert.equal(images.length, 5);
  assert.ok(JSON.stringify(construction.corps.messages).includes("500 g de farine"));

  // 2. Chaque étape a son clip, lisible par le navigateur.
  const clip = await fetch(`${base}${`/media/lecons/${lecon.id}/clips/${lecon.etapes[1].clip}`}`);
  assert.equal(clip.status, 200);
  assert.equal(clip.headers.get("content-type"), "video/mp4");
  assert.equal(lecon.etapes[1].clipLunettes, "etape-2-lunettes.mp4");
  assert.equal(lecon.etapes[0].images.length, 1);
  assert.equal(lecon.etapes[1].images.length, 1);

  // 3. L'apprenti commence et envoie une photo de son plan de travail.
  const session = await (await fetch(`${base}/api/sessions`, {
    method: "POST",
    body: JSON.stringify({ leconId: lecon.id }),
  })).json();
  assert.equal(session.dire, "Étape 1 : Pesée. Pèse 500 g de farine.");
  assert.equal(session.etape.clipLunettesUrl, `/media/lecons/${lecon.id}/clips/etape-1-lunettes.mp4`);

  const dossierImages = path.join(process.env.DOSSIER_DONNEES!, "lecons", lecon.id, "images");
  const photo = await readFile(path.join(dossierImages, lecon.etapes[0].images[0]));
  const retour = await (await fetch(`${base}/api/sessions/${session.sessionId}/image`, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: photo,
  })).json();
  assert.equal(retour.verdict, "correction");
  assert.equal(retour.dire, "Remets la balance à zéro.");

  // La requête de correction est bien formée : effort bas, référence du maître en cache.
  const correction = requetes[1];
  assert.equal(correction.corps.stream, undefined);
  assert.equal(correction.corps.output_config.effort, "low");
  const contenu = correction.corps.messages[0].content;
  const indexCache = contenu.findIndex((b: any) => b.cache_control);
  assert.equal(contenu[indexCache].type, "image");
  // Après le point de cache : les conseils puis la photo de l'apprenti.
  assert.ok(contenu.slice(indexCache + 1).some((b: any) => b.type === "image"));
});
