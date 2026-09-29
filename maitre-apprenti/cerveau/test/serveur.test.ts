import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";

// Données dans un dossier temporaire, clé d'accès activée, IA volontairement injoignable.
const dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-serveur-"));
process.env.DOSSIER_DONNEES = dossier;
process.env.CLE_ACCES = "secret";
process.env.ANTHROPIC_API_KEY = "cle-de-test";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";

const { serveur } = await import("../src/server.ts");
const { sauverLecon, preparerDossierLecon } = await import("../src/store.ts");
const { FFMPEG } = await import("../src/video.ts");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
const LECON_ID = "0123456789ab";
let base = "";
let morceau = Buffer.alloc(0);

async function api(chemin: string, options: RequestInit = {}) {
  const reponse = await fetch(`${base}/api${chemin}`, {
    ...options,
    headers: { "x-cle": "secret", ...(options.headers ?? {}) },
  });
  return { statut: reponse.status, corps: await reponse.json() };
}

before(async () => {
  const dossierLecon = await preparerDossierLecon(LECON_ID);
  await writeFile(path.join(dossierLecon, "images", "ref.jpg"), JPEG);
  await writeFile(path.join(dossierLecon, "clips", "etape-1.mp4"), Buffer.from("0123456789"));
  await sauverLecon({
    id: LECON_ID,
    titre: "Croissant",
    metier: "boulangerie",
    source: "video",
    creeLe: new Date().toISOString(),
    statut: "prete",
    erreur: null,
    etapes: [1, 2].map((numero) => ({
      id: `etape-${numero}`,
      numero,
      titre: `Étape ${numero}`,
      consigne: `Consigne ${numero}`,
      pointsDeControle: [],
      erreursFrequentes: [],
      criteresDeReussite: [],
      debut: 0,
      fin: 5,
      clip: "etape-1.mp4",
      clipLunettes: null,
      images: ["ref.jpg"],
    })),
  });
  // Un morceau de vidéo de 4 s, comme en envoie la tablette.
  const fichier = path.join(dossier, "morceau.webm");
  await promisify(execFile)(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=4:size=320x240:rate=15",
    "-c:v", "libvpx", "-b:v", "300k", fichier,
  ]);
  morceau = await readFile(fichier);
  await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
});

after(async () => {
  serveur.closeAllConnections();
  await new Promise((ok) => serveur.close(ok));
  await rm(dossier, { recursive: true, force: true });
});

test("l'API refuse les appels sans la clé d'accès", async () => {
  const reponse = await fetch(`${base}/api/lecons`);
  assert.equal(reponse.status, 401);
});

test("liste les leçons", async () => {
  const { statut, corps } = await api("/lecons");
  assert.equal(statut, 200);
  assert.equal(corps[0].titre, "Croissant");
  assert.equal(corps[0].nombreEtapes, 2);
});

test("une session d'apprenti se crée, reçoit de la vidéo et obéit aux commandes", async () => {
  const creee = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId: LECON_ID }) });
  assert.equal(creee.statut, 201);
  assert.equal(creee.corps.dire, "Étape 1 : Étape 1. Consigne 1");
  const id = creee.corps.sessionId;

  // L'IA est injoignable ici : le serveur doit répondre proprement sans planter.
  const video = await api(`/sessions/${id}/video`, {
    method: "POST",
    headers: { "content-type": "video/webm" },
    body: morceau,
  });
  assert.equal(video.statut, 200);
  assert.match(video.corps.afficher, /IA indisponible/);

  const suivant = await api(`/sessions/${id}/commande`, {
    method: "POST",
    body: JSON.stringify({ commande: "suivant" }),
  });
  assert.equal(suivant.corps.etape.index, 1);

  const liste = await api(`/sessions?lecon=${LECON_ID}`);
  assert.equal(liste.corps[0].sessionId, id);

  const inconnue = await api(`/sessions/${id}/commande`, {
    method: "POST",
    body: JSON.stringify({ commande: "danser" }),
  });
  assert.equal(inconnue.statut, 400);
});

test("refuse les photos et les vidéos illisibles", async () => {
  const creee = await api("/sessions", { method: "POST", body: JSON.stringify({ leconId: LECON_ID }) });
  const id = creee.corps.sessionId;
  const photo = await api(`/sessions/${id}/video`, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: JPEG,
  });
  assert.equal(photo.statut, 415);
  const illisible = await api(`/sessions/${id}/video`, {
    method: "POST",
    headers: { "content-type": "video/mp4" },
    body: "pas une vidéo",
  });
  assert.equal(illisible.statut, 422);
});

test("sert les clips par morceaux (lecture vidéo) et bloque les chemins suspects", async () => {
  const partiel = await fetch(`${base}/media/lecons/${LECON_ID}/clips/etape-1.mp4`, {
    headers: { range: "bytes=2-5" },
  });
  assert.equal(partiel.status, 206);
  assert.equal(await partiel.text(), "2345");
  assert.equal(partiel.headers.get("content-range"), "bytes 2-5/10");

  const suspect = await fetch(`${base}/media/lecons/${LECON_ID}/clips/..%2Flecon.json`);
  assert.equal(suspect.status, 404);
});

test("sert la page d'accueil", async () => {
  const reponse = await fetch(`${base}/`);
  assert.equal(reponse.status, 200);
  assert.match(await reponse.text(), /Maître/);
});
