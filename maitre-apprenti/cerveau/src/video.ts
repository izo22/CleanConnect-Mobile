// Traitement de la vidéo du maître avec ffmpeg : extraction d'images et découpe des clips par étape.

import { execFile } from "node:child_process";
import { readdir, rename } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";
import type { ImageHorodatee } from "./types.ts";

const executer = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? (ffmpegStatic as unknown as string | null) ?? "ffmpeg";

/** Au-delà, la requête envoyée à l'IA devient trop lourde : on espace les images. */
export const IMAGES_MAX_POUR_IA = 80;

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
