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
  imagesDepuisMorceau,
  mouvement,
  normaliserMorceau,
  preparerPourIA,
  recadrer,
  sequenceDepuisMorceau,
  sequenceEtape,
  vignettesGris,
  zoneActive,
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
    titre: "Étape", consigne: "Fais ceci.", explication: "Détail.", debut_s, fin_s,
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
  // Une image par seconde (vidéo courte), datée au milieu de sa seconde.
  assert.deepEqual(extraites.map((i) => i.t), [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5]);
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

test("vignettes et mesure du mouvement (vérification automatique, sans IA)", async () => {
  // 3 s d'image fixe puis 3 s de mire animée.
  const fixe = path.join(dossier, "fixe.mp4");
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=gray:size=320x240:duration=3:rate=15",
    "-f", "lavfi", "-i", "testsrc2=size=320x240:duration=3:rate=15",
    "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", fixe,
  ]);
  const images = await imagesDepuisMorceau({ donnees: await readFile(fixe), type: "video/mp4" }, 2);
  assert.ok(images.length >= 11 && images.length <= 13, `${images.length} images`);
  const vignettes = await vignettesGris(images);
  assert.equal(vignettes.length, images.length);
  assert.equal(vignettes[0].length, 32 * 18);
  assert.ok(mouvement(vignettes[0], vignettes[1]) < 0.01, "image fixe");
  const fin = vignettes.length - 1;
  assert.ok(mouvement(vignettes[fin - 1], vignettes[fin]) > 0.02, "mire animée");
  assert.equal(mouvement(Buffer.alloc(4, 0), Buffer.alloc(4, 255)), 1);
});

/** Largeur et hauteur d'une image JPEG (marqueur SOF). */
function tailleJpeg(image: Buffer): { largeur: number; hauteur: number } {
  for (let i = 2; i < image.length - 9; i++) {
    if (image[i] === 0xff && image[i + 1] >= 0xc0 && image[i + 1] <= 0xc2) {
      return { hauteur: image.readUInt16BE(i + 5), largeur: image.readUInt16BE(i + 7) };
    }
  }
  throw new Error("JPEG sans taille");
}

test("zone active : les pixels qui bougent, avec une marge, aux proportions de l'image", () => {
  const vignette = (valeur: (x: number, y: number) => number) => {
    const b = Buffer.alloc(32 * 18);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 32; x++) b[y * 32 + x] = valeur(x, y);
    return b;
  };
  // Seul un carré en bas à droite (x 22 à 25, y 11 à 14) change d'une image à l'autre.
  const mains = (k: number) => vignette((x, y) => (x >= 22 && x <= 25 && y >= 11 && y <= 14 ? (k % 2 ? 200 : 40) : 90));
  const zone = zoneActive([mains(0), mains(1), mains(2), mains(3)]);
  assert.ok(zone);
  assert.equal(zone.l, 0.5); // zoom limité à 2 fois
  assert.equal(zone.l, zone.h);
  assert.ok(zone.x > 0.35 && zone.x + zone.l <= 1);
  assert.ok(zone.y + zone.h <= 1);
  // Rien ne bouge, ou tout bouge (caméra sur la tête) : image entière.
  const fixe = vignette(() => 90);
  assert.equal(zoneActive([fixe, fixe, fixe]), null);
  assert.equal(zoneActive([vignette(() => 10), vignette(() => 200), vignette(() => 10)]), null);
  assert.equal(zoneActive([fixe]), null);
});

test("recadrage automatique sur une vraie vidéo : l'IA reçoit la zone des mains à 640 px", async () => {
  // Plan de travail fixe en 1280×720 ; seul un « outil » rouge bouge, en bas à droite.
  const fichier = path.join(dossier, "mains.mp4");
  await executer(FFMPEG, [
    "-hide_banner", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=10:duration=4,hue=s=0",
    "-f", "lavfi", "-i", "color=c=red:size=140x140:rate=10:duration=4",
    "-filter_complex", "[0:v]trim=start=0:end=0.1,loop=loop=-1:size=1:start=0,setpts=N/10/TB[fond];[fond][1:v]overlay=x='900+120*sin(t*5)':y='480+60*cos(t*5)':shortest=1",
    "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", fichier,
  ]);
  const images = await imagesDepuisMorceau({ donnees: await readFile(fichier), type: "video/mp4" }, 2);
  assert.equal(tailleJpeg(images[0]).largeur, 1280, "images de travail en 1280 px");
  const { images: pourIA, zone } = await preparerPourIA(images);
  assert.ok(zone, "une zone de mouvement est trouvée");
  assert.ok(zone.x >= 0.4 && zone.y >= 0.3, `zone en bas à droite : ${JSON.stringify(zone)}`);
  assert.equal(pourIA.length, images.length);
  assert.deepEqual(tailleJpeg(pourIA[0]), { largeur: 640, hauteur: 360 });
  // Sans zone : simple réduction.
  assert.equal(tailleJpeg((await recadrer([images[0]], null))[0]).largeur, 640);
});
