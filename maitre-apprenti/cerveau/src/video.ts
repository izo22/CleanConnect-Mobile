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
/** Une séquence envoyée à l'IA = 8 images de l'apprenti (sur 4 s en continu, sur toute la tentative à la demande). */
export const IMAGES_PAR_SEQUENCE = 8;
export const IMAGES_PAR_SECONDE = 2;
/** Largeur des images envoyées à l'IA pour juger un geste (assez pour voir les mains, peu coûteux). */
const LARGEUR_ANALYSE = 640;
/**
 * Largeur des images gardées en mémoire : deux fois plus que pour l'IA, pour pouvoir recadrer
 * sur la zone où travaillent les mains sans perdre de détails (voir preparerPourIA).
 */
const LARGEUR_TRAVAIL = 1280;

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

/** Lance ffmpeg (avec `entree` sur son entrée standard) et renvoie tout ce qu'il écrit sur sa sortie standard. */
function ffmpegVersMemoire(args: string[], entree?: Buffer): Promise<Buffer> {
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
    processus.stdin.on("error", () => undefined); // ffmpeg peut fermer son entrée avant la fin
    processus.stdin.end(entree);
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

/** Filtre ffmpeg qui produit les images de travail (recadrées ensuite pour l'IA), à la cadence de la leçon. */
export const filtreAnalyse = (imagesParSeconde = IMAGES_PAR_SECONDE) =>
  `fps=${imagesParSeconde},scale='min(${LARGEUR_TRAVAIL},iw)':-2`;

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

/** Au plus ce nombre de secondes d'images est tiré d'un morceau (et gardé en mémoire par une séance). */
export const SECONDES_MAX_EN_MEMOIRE = 20;

/**
 * Transforme un morceau de vidéo en séquence de geste : les 8 dernières images à la cadence
 * demandée (2 images/s = 4 dernières secondes ; 4 images/s = 2 dernières secondes), prêtes pour l'IA.
 */
export async function sequenceDepuisMorceau(morceau: MorceauVideo, imagesParSeconde = IMAGES_PAR_SECONDE): Promise<Buffer[]> {
  return (await imagesDepuisMorceau(morceau, imagesParSeconde)).slice(-IMAGES_PAR_SEQUENCE);
}

/** Toutes les images d'un morceau à la cadence demandée (au plus les 20 dernières secondes). */
export async function imagesDepuisMorceau(morceau: MorceauVideo, imagesParSeconde = IMAGES_PAR_SECONDE): Promise<Buffer[]> {
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
    return images.slice(-SECONDES_MAX_EN_MEMOIRE * imagesParSeconde);
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Détection de mouvement (vérification automatique à la fin d'un geste), sans appel à l'IA
// ---------------------------------------------------------------------------

/** Taille des vignettes comparées : assez pour voir des mains bouger, négligeable à calculer. */
export const VIGNETTE = { largeur: 32, hauteur: 18 };
const TAILLE_VIGNETTE = VIGNETTE.largeur * VIGNETTE.hauteur;

/** Réduit des images JPEG en vignettes 32×18 en niveaux de gris (un octet par pixel). */
export async function vignettesGris(images: Buffer[]): Promise<Buffer[]> {
  if (images.length === 0) return [];
  const sortie = await ffmpegVersMemoire(
    [
      "-f", "image2pipe", "-c:v", "mjpeg", "-i", "pipe:0",
      "-vf", `scale=${VIGNETTE.largeur}:${VIGNETTE.hauteur},format=gray`,
      "-f", "rawvideo", "pipe:1",
    ],
    Buffer.concat(images),
  );
  const vignettes: Buffer[] = [];
  for (let debut = 0; debut + TAILLE_VIGNETTE <= sortie.length; debut += TAILLE_VIGNETTE) {
    vignettes.push(sortie.subarray(debut, debut + TAILLE_VIGNETTE));
  }
  return vignettes;
}

/** Différence moyenne entre deux vignettes, de 0 (identiques) à 1 (tout a changé). */
export function mouvement(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let somme = 0;
  for (let i = 0; i < n; i++) somme += Math.abs(a[i] - b[i]);
  return somme / (n * 255);
}

// ---------------------------------------------------------------------------
// Recadrage automatique sur la zone où travaillent les mains
// ---------------------------------------------------------------------------

/** Rectangle en fractions de l'image (0 à 1). */
export interface Zone {
  x: number;
  y: number;
  l: number;
  h: number;
}

/** Un pixel de vignette « bouge » si sa différence moyenne d'une image à l'autre dépasse ce seuil (sur 255). */
const SEUIL_PIXEL_ACTIF = 12;
/** Marge ajoutée autour des mains, de chaque côté (en fraction de l'image). */
const MARGE_ZONE = 0.12;
/** On ne zoome jamais plus que 2 fois : le geste garde son contexte (bol, plan de travail…). */
const TAILLE_MIN_ZONE = 0.5;
/** Au-delà, recadrer n'apporte presque rien. */
const TAILLE_MAX_ZONE = 0.85;

/**
 * Trouve la zone où ça bouge (les mains, l'outil) à partir des vignettes d'une séquence. Renvoie
 * null s'il n'y a pas assez de mouvement ou s'il y en a partout (caméra portée sur la tête) :
 * on garde alors l'image entière. La zone a les proportions de l'image.
 */
export function zoneActive(vignettes: Buffer[], largeur = VIGNETTE.largeur, hauteur = VIGNETTE.hauteur): Zone | null {
  if (vignettes.length < 2) return null;
  const energie = new Float64Array(largeur * hauteur);
  for (let k = 1; k < vignettes.length; k++) {
    for (let i = 0; i < energie.length; i++) energie[i] += Math.abs(vignettes[k][i] - vignettes[k - 1][i]);
  }
  let x0 = largeur;
  let x1 = -1;
  let y0 = hauteur;
  let y1 = -1;
  let actifs = 0;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (energie[y * largeur + x] / (vignettes.length - 1) < SEUIL_PIXEL_ACTIF) continue;
      actifs++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (actifs < 3) return null;
  const gauche = x0 / largeur - MARGE_ZONE;
  const droite = (x1 + 1) / largeur + MARGE_ZONE;
  const haut = y0 / hauteur - MARGE_ZONE;
  const bas = (y1 + 1) / hauteur + MARGE_ZONE;
  // Même fraction en largeur et en hauteur : la zone garde les proportions de l'image.
  const cote = Math.max(droite - gauche, bas - haut, TAILLE_MIN_ZONE);
  if (cote >= TAILLE_MAX_ZONE) return null;
  const borner = (v: number) => Math.min(Math.max(v, 0), 1 - cote);
  const arrondir = (v: number) => Number(v.toFixed(3));
  return {
    x: arrondir(borner((gauche + droite) / 2 - cote / 2)),
    y: arrondir(borner((haut + bas) / 2 - cote / 2)),
    l: arrondir(cote),
    h: arrondir(cote),
  };
}

/** Recadre des images JPEG sur une zone (ou pas) et les met à la taille envoyée à l'IA. */
export async function recadrer(images: Buffer[], zone: Zone | null): Promise<Buffer[]> {
  if (images.length === 0) return [];
  const filtre = zone
    ? `crop=iw*${zone.l}:ih*${zone.h}:iw*${zone.x}:ih*${zone.y},scale=${LARGEUR_ANALYSE}:-2`
    : `scale='min(${LARGEUR_ANALYSE},iw)':-2`;
  const sortie = await ffmpegVersMemoire(
    ["-f", "image2pipe", "-c:v", "mjpeg", "-i", "pipe:0", "-vf", filtre, "-q:v", "5", "-f", "image2pipe", "-c:v", "mjpeg", "pipe:1"],
    Buffer.concat(images),
  );
  const resultat = new DecoupeurJpeg().ajouter(sortie);
  if (resultat.length !== images.length) throw new Error("Recadrage : nombre d'images inattendu");
  return resultat;
}

/**
 * Prépare des images de travail pour l'IA : recadrage automatique sur la zone où les mains
 * bougent (repérée sur `reperage`, par défaut les images elles-mêmes), puis réduction à 640 px.
 * L'IA voit ainsi les mains en plus gros pour le même prix, sans que personne ne règle le cadre.
 */
export async function preparerPourIA(images: Buffer[], reperage: Buffer[] = images): Promise<{ images: Buffer[]; zone: Zone | null }> {
  const zone = zoneActive(await vignettesGris(reperage));
  return { images: await recadrer(images, zone), zone };
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
 * en images de travail (à passer par preparerPourIA, comme celles de l'apprenti).
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
    "-an", "-vf", `fps=${(nombre / duree).toFixed(4)},scale='min(${LARGEUR_TRAVAIL},iw)':-2`,
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
