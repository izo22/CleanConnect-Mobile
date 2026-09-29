import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";
import { finaliserEtapes } from "../src/lecons.ts";
import {
  assemblerVideos,
  decouperClip,
  DecoupeurJpeg,
  dureeVideo,
  extraireImages,
  FFMPEG,
  normaliserMorceau,
  sequenceDepuisMorceau,
  sequenceEtape,
} from "../src/video.ts";

const executer = promisify(execFile);
let dossier = "";
let video = "";

/** Génère une vidéo de test (mire animée + son) avec ffmpeg. */
async function genererVideo(fichier: string, duree: number, options: string[] = []) {
  await executer(FFMPEG, [
    "-hide_banner", "-y",
    "-f", "lavfi", "-i", `testsrc=duration=${duree}:size=640x360:rate=25`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${duree}`,
    ...(options.length ? options : ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"]),
    "-shortest", fichier,
  ]);
}

before(async () => {
  dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-video-"));
  video = path.join(dossier, "demo.mp4");
  await genererVideo(video, 12);
});
after(() => rm(dossier, { recursive: true, force: true }));

test("finaliserEtapes numérote et borne les étapes dans la durée de la vidéo", () => {
  const brute = (debut_s: number, fin_s: number) => ({
    titre: "Étape", consigne: "Fais ceci.", debut_s, fin_s,
    points_de_controle: [], erreurs_frequentes: [], criteres_de_reussite: [],
  });
  const etapes = finaliserEtapes([brute(-3, 5), brute(5, 99)], 8);
  assert.equal(etapes[0].numero, 1);
  assert.equal(etapes[0].debut, 0);
  assert.equal(etapes[1].fin, 8);
});

test("DecoupeurJpeg recompose les images même coupées en morceaux", () => {
  const a = Buffer.from([0xff, 0xd8, 1, 2, 0xff, 0xd9]);
  const b = Buffer.from([0xff, 0xd8, 3, 0xff, 0xd9]);
  const d = new DecoupeurJpeg();
  const flux = Buffer.concat([a, b]);
  assert.deepEqual(d.ajouter(flux.subarray(0, 4)), []);
  assert.deepEqual(d.ajouter(flux.subarray(4, 8)), [a]);
  assert.deepEqual(d.ajouter(flux.subarray(8)), [b]);
});

test("extrait les images pour l'IA et découpe les clips aux deux formats", async () => {
  const duree = await dureeVideo(video);
  assert.ok(Math.abs(duree - 12) < 0.2, `durée ${duree}`);

  const images = path.join(dossier, "images");
  await executer("mkdir", ["-p", images]);
  const extraites = await extraireImages(video, images, duree);
  assert.deepEqual(extraites.map((i) => i.t), [1, 3, 5, 7, 9, 11]);
  assert.ok((await readdir(images)).includes("extrait_0001.jpg"));

  const clip = path.join(dossier, "etape-1.mp4");
  await decouperClip(video, 3, 7, clip);
  assert.ok(Math.abs((await dureeVideo(clip)) - 4) < 0.3);

  // Version lunettes : exactement 266×150, sans piste audio.
  const petit = path.join(dossier, "etape-1-lunettes.mp4");
  await decouperClip(video, 3, 7, petit, "lunettes");
  const infos = await executer(FFMPEG, ["-hide_banner", "-i", petit]).catch((e: { stderr: string }) => e);
  assert.match(infos.stderr, /Video: h264.* 266x150/);
  assert.doesNotMatch(infos.stderr, /Audio:/);
});

test("séquence de référence : 8 images réparties sur l'étape du maître", async () => {
  const sequence = await sequenceEtape(video, 2, 10);
  assert.equal(sequence.length, 8);
  for (const image of sequence) assert.equal(image[0], 0xff);
});

test("séquence de l'apprenti depuis un morceau MP4, WebM ou HEVC brut (lunettes Meta)", async () => {
  // MP4 de 4 s → 8 images (2 par seconde).
  const mp4 = path.join(dossier, "morceau.mp4");
  await genererVideo(mp4, 4);
  assert.equal((await sequenceDepuisMorceau({ donnees: await readFile(mp4), type: "video/mp4" })).length, 8);

  // WebM (tablette, MediaRecorder) de 6 s → on garde les 8 dernières images.
  const webm = path.join(dossier, "morceau.webm");
  await genererVideo(webm, 6, ["-c:v", "libvpx", "-b:v", "500k", "-c:a", "libopus"]);
  assert.equal((await sequenceDepuisMorceau({ donnees: await readFile(webm), type: "video/webm" })).length, 8);

  // HEVC brut à 15 images/s (ce qu'envoient les lunettes Meta) : 60 images = 4 s.
  const hevc = path.join(dossier, "morceau.hevc");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=4:size=504x896:rate=15",
    "-c:v", "libx265", "-x265-params", "log-level=error", "-f", "hevc", hevc,
  ]);
  const brut = await sequenceDepuisMorceau({ donnees: await readFile(hevc), type: "video/hevc", imagesParSeconde: 15 });
  assert.equal(brut.length, 8);

  await assert.rejects(
    sequenceDepuisMorceau({ donnees: Buffer.from("pas une vidéo"), type: "video/mp4" }),
    /ffmpeg|image/,
  );
});

test("les morceaux des lunettes du maître sont normalisés puis assemblés", async () => {
  const hevc = path.join(dossier, "maitre.hevc");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=504x896:rate=15",
    "-c:v", "libx265", "-x265-params", "log-level=error", "-f", "hevc", hevc,
  ]);
  const a = path.join(dossier, "a.mp4");
  const b = path.join(dossier, "b.mp4");
  await normaliserMorceau({ donnees: await readFile(hevc), type: "video/hevc", imagesParSeconde: 15 }, a);
  await normaliserMorceau({ donnees: await readFile(video), type: "video/mp4" }, b);
  const complet = path.join(dossier, "complet.mp4");
  await assemblerVideos([a, b], complet);
  assert.ok((await stat(complet)).size > 0);
  const duree = await dureeVideo(complet);
  assert.ok(Math.abs(duree - 15) < 0.6, `durée assemblée ${duree}`);
});
