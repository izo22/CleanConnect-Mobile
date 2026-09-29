// Traitement vidéo avec ffmpeg : images pour l'IA, séquences de gestes, clips par étape,
// morceaux de vidéo envoyés par les lunettes ou la tablette.

import { execFile, spawn } from "node:child_process";
import { mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import type { ImageHorodatee } from "./types.ts";

const executer = promisify(execFile);
export const FFMPEG = process.env.FFMPEG_PATH ?? (ffmpegStatic as unknown as string | null) ?? "ffmpeg";

/** Au-delà, la requête envoyée à l'IA pour construire la leçon devient trop lourde. */
export const IMAGES_MAX_POUR_IA = 80;
/** Une séquence de geste = 8 images sur 4 secondes (2 images par seconde). */
export const IMAGES_PAR_SEQUENCE = 8;
export const IMAGES_PAR_SECONDE = 2;
/** Largeur des images envoyées à l'IA pour juger un geste (assez pour voir les mains, peu coûteux). */
const LARGEUR_ANALYSE = 640;

async function ffmpeg(args: string[]): Promise<string> {
  try {
    const { stderr } = await executer(FFMPEG, ["-hide_banner", "-y", ...args], {
      maxBuffer: 20 * 1024 * 1024,
    });
    return stderr;
  } catch (erreur) {
    const e = erreur as { stderr?: string; message: string };
    throw new Error(`ffmpeg a échoué : ${(e.stderr ?? e.message).slice(-500)}`);
  }
}

/** Lance ffmpeg et renvoie tout ce qu'il écrit sur sa sortie standard. */
function ffmpegVersMemoire(args: string[]): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const processus = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", ...args]);
    const morceaux: Buffer[] = [];
    let erreurs = "";
    processus.stdout.on("data", (m: Buffer) => morceaux.push(m));
    processus.stderr.on("data", (m: Buffer) => (erreurs += m.toString()));
    processus.on("error", rejeter);
    processus.on("close", (code) => {
      if (code === 0) resoudre(Buffer.concat(morceaux));
      else rejeter(new Error(`ffmpeg a échoué : ${erreurs.slice(-500)}`));
    });
    processus.stdin.end();
  });
}

/** Sépare une suite d'images JPEG collées les unes aux autres (sortie « image2pipe » de ffmpeg). */
export class DecoupeurJpeg {
  private tampon = Buffer.alloc(0);

  /** Ajoute des octets et renvoie les images JPEG complètes trouvées. */
  ajouter(octets: Buffer): Buffer[] {
    this.tampon = Buffer.concat([this.tampon, octets]);
    const images: Buffer[] = [];
    for (;;) {
      const debut = this.tampon.indexOf(Buffer.from([0xff, 0xd8]));
      if (debut < 0) {
        this.tampon = Buffer.alloc(0);
        break;
      }
      const fin = this.tampon.indexOf(Buffer.from([0xff, 0xd9]), debut + 2);
      if (fin < 0) {
        this.tampon = this.tampon.subarray(debut);
        break;
      }
      images.push(Buffer.from(this.tampon.subarray(debut, fin + 2)));
      this.tampon = this.tampon.subarray(fin + 2);
    }
    return images;
  }
}

/** Filtre ffmpeg qui produit les images d'analyse, à la cadence de la leçon. */
export const filtreAnalyse = (imagesParSeconde = IMAGES_PAR_SECONDE) =>
  `fps=${imagesParSeconde},scale=${LARGEUR_ANALYSE}:-2`;

/** Cadence d'analyse autorisée : 2 (gestes lents, 4 s vues) à 5 (gestes rapides, 1,6 s vue). */
export const cadenceValide = (n: unknown): number =>
  typeof n === "number" && Number.isInteger(n) && n >= 2 && n <= 5 ? n : IMAGES_PAR_SECONDE;

export async function dureeVideo(fichier: string): Promise<number> {
  // ffmpeg sans sortie termine en erreur, mais affiche la durée dans stderr.
  let sortie: string;
  try {
    const { stderr } = await executer(FFMPEG, ["-hide_banner", "-i", fichier]);
    sortie = stderr;
  } catch (erreur) {
    sortie = (erreur as { stderr?: string }).stderr ?? "";
  }
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(sortie);
  if (!m) throw new Error("Impossible de lire la durée de la vidéo (fichier vidéo valide ?)");
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// ---------------------------------------------------------------------------
// Morceaux de vidéo envoyés pendant une leçon ou une démonstration
// ---------------------------------------------------------------------------

/** Un morceau de vidéo reçu : fichier conteneur (MP4, WebM…) ou flux HEVC brut des lunettes Meta. */
export interface MorceauVideo {
  donnees: Buffer;
  /** Type MIME annoncé par l'envoyeur. */
  type: string;
  /** Cadence du flux brut (HEVC sans conteneur ne porte pas l'information). */
  imagesParSeconde?: number;
}

function optionsEntree(morceau: MorceauVideo): string[] {
  if (/hevc|h265/i.test(morceau.type)) {
    return ["-f", "hevc", "-framerate", String(morceau.imagesParSeconde ?? 15)];
  }
  return [];
}

/**
 * Transforme un morceau de vidéo en séquence de geste : les 8 dernières images à la cadence
 * demandée (2 images/s = 4 dernières secondes ; 4 images/s = 2 dernières secondes), prêtes pour l'IA.
 */
export async function sequenceDepuisMorceau(morceau: MorceauVideo, imagesParSeconde = IMAGES_PAR_SECONDE): Promise<Buffer[]> {
  // Passage par un fichier : un MP4 ne se lit pas toujours en flux (index à la fin du fichier).
  const dossier = await mkdtemp(path.join(tmpdir(), "sequence-"));
  try {
    const entree = path.join(dossier, "morceau");
    await writeFile(entree, morceau.donnees);
    const sortie = await ffmpegVersMemoire([
      ...optionsEntree(morceau), "-i", entree,
      "-an", "-vf", filtreAnalyse(imagesParSeconde), "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "pipe:1",
    ]);
    const images = new DecoupeurJpeg().ajouter(sortie);
    if (images.length === 0) throw new Error("Aucune image lisible dans ce morceau de vidéo");
    return images.slice(-IMAGES_PAR_SEQUENCE);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/** Convertit un morceau reçu en MP4 H.264 à cadence fixe (pour pouvoir les mettre bout à bout). */
export async function normaliserMorceau(morceau: MorceauVideo, sortie: string): Promise<void> {
  const dossier = await mkdtemp(path.join(tmpdir(), "morceau-"));
  try {
    const entree = path.join(dossier, "entree");
    await writeFile(entree, morceau.donnees);
    await ffmpeg([
      ...optionsEntree(morceau), "-i", entree,
      "-vf", "fps=15,scale=-2:'min(720,ih)'",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ar", "48000", "-ac", "1",
      sortie,
    ]);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

/** Met plusieurs vidéos bout à bout dans un seul MP4 (réencodé pour tolérer des formats différents). */
export async function assemblerVideos(morceaux: string[], sortie: string): Promise<void> {
  if (morceaux.length === 0) throw new Error("Aucune vidéo à assembler");
  const dossier = await mkdtemp(path.join(tmpdir(), "assemblage-"));
  try {
    // Chaque morceau est d'abord mis au même format (avec une piste son muette si besoin),
    // puis ils sont concaténés sans réencodage.
    const normalises: string[] = [];
    for (const [i, morceau] of morceaux.entries()) {
      const cible = path.join(dossier, `${i}.mp4`);
      await ffmpeg([
        "-i", morceau,
        "-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=48000",
        "-map", "0:v:0", "-map", "0:a:0?", "-map", "1:a:0",
        "-vf", "fps=15,scale=-2:'min(720,ih)',setsar=1",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "1", "-shortest",
        cible,
      ]);
      normalises.push(cible);
    }
    const liste = path.join(dossier, "liste.txt");
    await writeFile(liste, normalises.map((f) => `file '${f}'`).join("\n"));
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", liste, "-map", "0:v", "-map", "0:a:0", "-c", "copy", "-movflags", "+faststart", sortie]);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Vidéo du maître : images pour construire la leçon, séquences et clips par étape
// ---------------------------------------------------------------------------

/**
 * Extrait des images régulièrement espacées (au plus IMAGES_MAX_POUR_IA), redimensionnées
 * pour l'IA. Retourne les images avec leur instant dans la vidéo.
 */
export async function extraireImages(
  video: string,
  dossierSortie: string,
  duree: number,
): Promise<ImageHorodatee[]> {
  const intervalle = Math.max(2, duree / IMAGES_MAX_POUR_IA);
  await ffmpeg([
    "-i", video,
    "-vf", `fps=1/${intervalle.toFixed(3)},scale=768:-2`,
    "-q:v", "4",
    path.join(dossierSortie, "extrait_%04d.jpg"),
  ]);
  const fichiers = (await readdir(dossierSortie)).filter((f) => f.startsWith("extrait_")).sort();
  // Le filtre fps place la n-ième image au milieu de son intervalle.
  return fichiers.map((fichier, i) => ({
    fichier,
    t: Math.min(duree, Number(((i + 0.5) * intervalle).toFixed(1))),
  }));
}

/**
 * Séquence de référence d'une étape : `nombre` images réparties sur toute l'étape du maître,
 * au même format que les séquences de l'apprenti.
 */
export async function sequenceEtape(
  video: string,
  debut: number,
  fin: number,
  nombre = IMAGES_PAR_SEQUENCE,
): Promise<Buffer[]> {
  const duree = Math.max(0.5, fin - debut);
  const sortie = await ffmpegVersMemoire([
    "-ss", debut.toFixed(2), "-t", duree.toFixed(2), "-i", video,
    "-an", "-vf", `fps=${(nombre / duree).toFixed(4)},scale=${LARGEUR_ANALYSE}:-2`,
    "-frames:v", String(nombre), "-q:v", "4",
    "-f", "image2pipe", "-c:v", "mjpeg", "pipe:1",
  ]);
  return new DecoupeurJpeg().ajouter(sortie);
}

/**
 * Formats de clip :
 * - "tablette" : jusqu'à 720p avec le son (explications du maître) ;
 * - "lunettes" : 266×150 sans son, la taille de l'exemple vidéo de Meta pour les Ray-Ban Display
 *   (le lecteur des lunettes refuse les vidéos trop grandes).
 */
export type FormatClip = "tablette" | "lunettes";

const FILTRES: Record<FormatClip, string[]> = {
  tablette: [
    "-vf", "scale=-2:'min(720,ih)'",
    "-c:a", "aac", "-b:a", "96k",
  ],
  lunettes: [
    "-vf", "scale=266:150:force_original_aspect_ratio=decrease,pad=266:150:(ow-iw)/2:(oh-ih)/2",
    "-an",
  ],
};

/** Découpe le passage [debut, fin] de la vidéo en MP4 léger. */
export async function decouperClip(
  video: string,
  debut: number,
  fin: number,
  sortie: string,
  format: FormatClip = "tablette",
): Promise<void> {
  const temporaire = `${sortie}.en-cours.mp4`;
  await ffmpeg([
    "-ss", debut.toFixed(2),
    "-to", fin.toFixed(2),
    "-i", video,
    ...FILTRES[format],
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    temporaire,
  ]);
  await rename(temporaire, sortie);
}
