import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import ffmpegStatic from "ffmpeg-static";
import { echantillonner, finaliserEtapes } from "../src/lecons.ts";
import { decouperClip, dureeVideo, extraireImages } from "../src/video.ts";
import type { EtapeBrute } from "../src/ia.ts";

const executer = promisify(execFile);

function brute(partiel: Partial<EtapeBrute>): EtapeBrute {
  return {
    titre: "Étape",
    consigne: "Fais ceci.",
    debut_s: 0,
    fin_s: 10,
    points_de_controle: [],
    erreurs_frequentes: [],
    criteres_de_reussite: [],
    images_reference: [],
    ...partiel,
  };
}

const images = [0, 2, 4, 6, 8].map((t, i) => ({ t, fichier: `img_${i}.jpg` }));

test("finaliserEtapes numérote et borne les étapes dans la durée de la vidéo", () => {
  const etapes = finaliserEtapes(
    [brute({ debut_s: -3, fin_s: 5, images_reference: [1, 1, 42] }), brute({ debut_s: 5, fin_s: 99 })],
    images,
    8,
  );
  assert.equal(etapes[0].numero, 1);
  assert.equal(etapes[0].debut, 0);
  assert.deepEqual(etapes[0].images, ["img_1.jpg"]);
  assert.equal(etapes[1].fin, 8);
});

test("finaliserEtapes choisit l'image la plus proche du milieu si l'IA n'en donne pas", () => {
  const [etape] = finaliserEtapes([brute({ debut_s: 4, fin_s: 8 })], images, 8);
  assert.deepEqual(etape.images, ["img_3.jpg"]);
});

test("echantillonner garde des éléments régulièrement répartis", () => {
  assert.deepEqual(echantillonner([1, 2, 3], 5), [1, 2, 3]);
  assert.deepEqual(echantillonner([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 5), [0, 2, 4, 6, 8]);
});

test("extrait des images et découpe un clip dans une vraie vidéo", async () => {
  const dossier = await mkdtemp(path.join(tmpdir(), "maitre-apprenti-"));
  try {
    const video = path.join(dossier, "demo.mp4");
    // Vidéo de test de 12 s générée par ffmpeg (mire + son).
    await executer(ffmpegStatic as unknown as string, [
      "-hide_banner", "-y",
      "-f", "lavfi", "-i", "testsrc=duration=12:size=640x360:rate=25",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=12",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", video,
    ]);

    const duree = await dureeVideo(video);
    assert.ok(Math.abs(duree - 12) < 0.2, `durée ${duree}`);

    const extraites = await extraireImages(video, dossier, duree);
    assert.equal(extraites.length, 6);
    assert.deepEqual(extraites.map((i) => i.t), [1, 3, 5, 7, 9, 11]);
    assert.ok((await readdir(dossier)).includes("extrait_0001.jpg"));

    const clip = path.join(dossier, "etape-1.mp4");
    await decouperClip(video, 3, 7, clip);
    assert.ok((await stat(clip)).size > 0);
    const dureeClip = await dureeVideo(clip);
    assert.ok(Math.abs(dureeClip - 4) < 0.3, `durée du clip ${dureeClip}`);

    // Version lunettes : exactement 266×150, sans piste audio.
    const petit = path.join(dossier, "etape-1-lunettes.mp4");
    await decouperClip(video, 3, 7, petit, "lunettes");
    const infos = await executer(ffmpegStatic as unknown as string, ["-hide_banner", "-i", petit]).catch(
      (e: { stderr: string }) => e,
    );
    assert.match(infos.stderr, /Video: h264.* 266x150/);
    assert.doesNotMatch(infos.stderr, /Audio:/);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});
