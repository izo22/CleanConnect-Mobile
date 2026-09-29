// Parcours complets avec un faux serveur Claude et de vraies vidéos (ffmpeg) :
// vidéo du maître → leçon → apprenti corrigé, en morceaux et en direct (RTMP).

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";

const executer = promisify(execFile);
const dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-e2e-"));
process.env.DOSSIER_DONNEES = path.join(dossier, "donnees");
process.env.ANTHROPIC_API_KEY = "cle-de-test";
process.env.PORTS_RTMP = "19350-19359";
delete process.env.CLE_ACCES;

const { FFMPEG } = await import("../src/video.ts");

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
      criteres_de_reussite: ["500 g de farine dans le bol"],
    },
    {
      titre: "Façonnage", consigne: "Roule la pâte en baguette.", debut_s: 4, fin_s: 10,
      points_de_controle: [], erreurs_frequentes: [], criteres_de_reussite: ["Baguette de 55 cm"],
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
    : JSON.stringify({ verdict: "correction", message: "Roule du centre vers les bords.", points_valides: [] });
  const reponse = repondre(texte, corps.stream === true);
  res.writeHead(200, { "content-type": reponse.type });
  res.end(reponse.corps);
});

let base = "";
let serveur: typeof import("../src/server.ts")["serveur"];
let videoMaitre = "";

before(async () => {
  await new Promise<void>((ok) => fauxClaude.listen(0, "127.0.0.1", ok));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(fauxClaude.address() as AddressInfo).port}`;
  ({ serveur } = await import("../src/server.ts"));
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  videoMaitre = path.join(dossier, "demo.mp4");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=10:size=640x360:rate=25",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=10",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", videoMaitre,
  ]);
});

after(async () => {
  serveur.closeAllConnections();
  await new Promise((ok) => serveur.close(ok));
  await new Promise((ok) => fauxClaude.close(ok));
  await rm(dossier, { recursive: true, force: true });
});

async function api(chemin: string, options: RequestInit = {}) {
  const reponse = await fetch(`${base}/api${chemin}`, options);
  return { statut: reponse.status, corps: await reponse.json() };
}

const postJson = (chemin: string, corps: unknown = {}) =>
  api(chemin, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });

async function attendreLecon(id: string) {
  for (let essai = 0; essai < 240; essai++) {
    const { corps } = await api(`/lecons/${id}`);
    if (corps.statut !== "en_preparation") return corps;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  throw new Error("La leçon n'est jamais prête");
}

/** Pousse une vidéo en direct (RTMP) comme le feraient les lunettes Mentra. */
function pousserDirect(rtmpUrl: string, secondes: number): Promise<void> {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, [
      "-hide_banner", "-loglevel", "error", "-re",
      "-f", "lavfi", "-i", `testsrc=duration=${secondes}:size=640x360:rate=15`,
      "-f", "lavfi", "-i", `sine=frequency=440:duration=${secondes}`,
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-g", "15",
      "-c:a", "aac", "-shortest", "-f", "flv", rtmpUrl,
    ]);
    let erreurs = "";
    p.stderr.on("data", (m: Buffer) => (erreurs += m));
    p.on("close", (code) => (code === 0 ? ok() : ko(new Error(`envoi RTMP : ${erreurs}`))));
  });
}

/** Lit le flux d'événements d'une session jusqu'à trouver un retour qui vérifie `condition`. */
async function attendreEvenement(sessionId: string, condition: (r: any) => boolean) {
  const reponse = await fetch(`${base}/api/sessions/${sessionId}/evenements`, { signal: AbortSignal.timeout(30_000) });
  const lecteur = reponse.body!.getReader();
  let tampon = "";
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) throw new Error("flux terminé");
    tampon += Buffer.from(value).toString();
    for (const ligne of tampon.split("\n")) {
      if (ligne.startsWith("data: ")) {
        const retour = JSON.parse(ligne.slice(6));
        if (condition(retour)) {
          await lecteur.cancel();
          return retour;
        }
      }
    }
    tampon = tampon.slice(tampon.lastIndexOf("\n") + 1);
  }
}

let leconId = "";

test("vidéo du maître → leçon avec clips et séquences de référence", async () => {
  const envoi = await fetch(`${base}/api/lecons?titre=Baguette&metier=Boulangerie&commentaire=500%20g%20de%20farine`, {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: await readFile(videoMaitre),
  });
  assert.equal(envoi.status, 202);
  const lecon = await attendreLecon((await envoi.json()).id);
  assert.equal(lecon.statut, "prete", lecon.erreur);
  leconId = lecon.id;
  assert.equal(lecon.etapes.length, 2);
  for (const etape of lecon.etapes) {
    assert.equal(etape.images.length, 8, "8 images de référence par étape");
    assert.ok(etape.clip && etape.clipLunettes);
  }

  const construction = requetes.find((r) => r.corps.stream === true)!;
  assert.equal(construction.corps.model, "claude-opus-5-5");
  assert.equal(construction.corps.fallbacks, "default");
  assert.match(String(construction.entetes["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.equal(construction.corps.messages[0].content.filter((b: any) => b.type === "image").length, 5);
  assert.ok(JSON.stringify(construction.corps.messages).includes("500 g de farine"));

  const clip = await fetch(`${base}/media/lecons/${lecon.id}/clips/${lecon.etapes[1].clip}`);
  assert.equal(clip.headers.get("content-type"), "video/mp4");
});

test("apprenti : un morceau de vidéo → séquence de 8 images comparée au maître", async () => {
  const session = (await postJson("/sessions", { leconId })).corps;
  assert.equal(session.dire, "Étape 1 : Pesée. Pèse 500 g de farine.");
  assert.equal(session.etape.clipLunettesUrl, `/media/lecons/${leconId}/clips/etape-1-lunettes.mp4`);

  const avant = requetes.length;
  const morceau = path.join(dossier, "apprenti.mp4");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=duration=5:size=640x360:rate=25",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", morceau,
  ]);
  const retour = (await api(`/sessions/${session.sessionId}/video`, {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: await readFile(morceau),
  })).corps;
  assert.equal(retour.verdict, "correction");
  assert.equal(retour.dire, "Roule du centre vers les bords.");

  const correction = requetes[avant];
  assert.equal(correction.corps.output_config.effort, "low");
  const contenu = correction.corps.messages[0].content;
  const indexCache = contenu.findIndex((b: any) => b.cache_control);
  // Avant le point de cache : les 8 images du maître ; après : les 8 dernières de l'apprenti.
  assert.equal(contenu.slice(0, indexCache + 1).filter((b: any) => b.type === "image").length, 8);
  assert.equal(contenu.slice(indexCache + 1).filter((b: any) => b.type === "image").length, 8);
});

test("le maître juge une correction fausse : sa règle part à l'IA dès l'analyse suivante", async () => {
  const session = (await postJson("/sessions", { leconId, apprenti: "Léa" })).corps;
  const morceau = path.join(dossier, "apprenti-2.mp4");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=duration=4:size=640x360:rate=25",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", morceau,
  ]);
  const envoyer = () =>
    api(`/sessions/${session.sessionId}/video`, { method: "POST", headers: { "content-type": "video/mp4" }, body: readFileSync(morceau) });
  await envoyer();
  await new Promise((ok) => setTimeout(ok, 150)); // écriture du journal

  // La séance est dans le journal, avec le prénom, les 8 images et le verdict.
  const seances = (await api(`/lecons/${leconId}/seances`)).corps;
  const seance = seances.find((s: any) => s.id === session.sessionId);
  assert.equal(seance.apprenti, "Léa");
  const { interventions } = (await api(`/seances/${session.sessionId}`)).corps;
  assert.equal(interventions.length, 1);
  assert.equal(interventions[0].images.length, 8);
  assert.equal(interventions[0].verdict, "correction");
  const image = await fetch(`${base}/api/seances/${session.sessionId}/images/${interventions[0].images[0]}`);
  assert.equal(image.headers.get("content-type"), "image/jpeg");

  // « Fausse », avec une explication qui devient une règle de l'étape.
  const avis = await postJson(`/seances/${session.sessionId}/interventions/${interventions[0].id}/annotation`, {
    avis: "fausse", commentaire: "Rouler depuis le bout est aussi correct.", regle: true, portee: "etape",
  });
  assert.equal(avis.statut, 200);
  assert.equal(avis.corps.regle.etapeId, "etape-1");
  assert.equal(avis.corps.intervention.annotation.regleId, avis.corps.regle.id);

  // Cadence rapide : l'IA verra 4 images par seconde.
  assert.equal((await postJson(`/lecons/${leconId}/reglages`, { imagesParSeconde: 4 })).corps.imagesParSeconde, 4);

  const avant = requetes.length;
  await envoyer();
  const texte = JSON.stringify(requetes[avant].corps.messages);
  assert.ok(texte.includes("Rouler depuis le bout est aussi correct."), "la règle du maître est envoyée à l'IA");
  assert.ok(texte.includes("4 par seconde"));

  const m = (await api(`/lecons/${leconId}/metriques`)).corps;
  assert.equal(m.correctionsJugees, 1);
  assert.equal(m.tauxFausses, 1);
  assert.ok(m.analyses >= 2);

  // On revient à la cadence normale pour les tests suivants.
  await postJson(`/lecons/${leconId}/reglages`, { imagesParSeconde: 2 });
});

test("apprenti en direct (RTMP, lunettes Mentra) : analyse continue, retours dans le flux d'événements", async () => {
  const session = (await postJson("/sessions", { leconId })).corps;
  const { statut, corps } = await postJson(`/sessions/${session.sessionId}/direct`);
  assert.equal(statut, 201);
  assert.match(corps.rtmpUrl, /^rtmp:\/\/127\.0\.0\.1:1935\d\/live\/[a-f0-9]{16}$/);

  const evenement = attendreEvenement(session.sessionId, (r) => r.verdict === "correction");
  await new Promise((ok) => setTimeout(ok, 500)); // le temps que ffmpeg se mette à l'écoute
  await pousserDirect(corps.rtmpUrl, 6);
  const retour = await evenement;
  assert.equal(retour.afficher, "Roule du centre vers les bords.");

  assert.equal((await api(`/sessions/${session.sessionId}/direct`, { method: "DELETE" })).statut, 200);
});

test("maître avec les lunettes Meta : morceaux HEVC + voix → leçon", async () => {
  const { corps } = await postJson("/captures", { titre: "Croissant", metier: "Boulangerie" });
  const id = corps.captureId;
  const hevc = path.join(dossier, "maitre.hevc");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=504x896:rate=15",
    "-c:v", "libx265", "-x265-params", "log-level=error", "-f", "hevc", hevc,
  ]);
  const donnees = await readFile(hevc);
  for (let i = 0; i < 3; i++) {
    const envoi = await api(`/captures/${id}/video?ips=15`, {
      method: "POST",
      headers: { "content-type": "video/hevc" },
      body: donnees,
    });
    assert.equal(envoi.statut, 200);
    if (i === 0) await postJson(`/captures/${id}/parole`, { texte: "Je rabats la pâte vers moi" });
    if (i === 1) await postJson(`/captures/${id}/etape`);
  }
  const avant = requetes.length;
  assert.equal((await postJson(`/captures/${id}/terminer`)).statut, 202);
  const lecon = await attendreLecon(id);
  assert.equal(lecon.statut, "prete", lecon.erreur);
  assert.equal(lecon.source, "lunettes");
  assert.ok(lecon.etapes.every((e: any) => e.clip && e.images.length > 0));
  const construction = JSON.stringify(requetes.slice(avant)[0].corps.messages);
  assert.ok(construction.includes("Je rabats la pâte vers moi"));
  assert.ok(construction.includes("changement d'étape"));
});

test("maître avec les lunettes Mentra : direct RTMP enregistré → leçon", async () => {
  const { corps } = await postJson("/captures", { titre: "Pain de mie", metier: "Boulangerie" });
  const id = corps.captureId;
  const direct = await postJson(`/captures/${id}/direct`);
  assert.equal(direct.statut, 201);
  await new Promise((ok) => setTimeout(ok, 500));
  await pousserDirect(direct.corps.rtmpUrl, 5);
  assert.equal((await postJson(`/captures/${id}/terminer`)).statut, 202);
  const lecon = await attendreLecon(id);
  assert.equal(lecon.statut, "prete", lecon.erreur);
  assert.ok(lecon.etapes[0].clip);
});
