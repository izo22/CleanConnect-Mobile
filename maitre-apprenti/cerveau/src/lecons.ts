// Fabrication des leçons à partir de la vidéo du maître : envoyée d'un bloc (page web),
// en morceaux (lunettes Meta) ou en direct (lunettes Mentra).

import { access, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ReceptionDirect } from "./direct.ts";
import { construireLecon, type EtapeBrute, type ImageIA } from "./ia.ts";
import { dossierLecon, nouvelId, preparerDossierLecon, sauverLecon } from "./store.ts";
import type { Etape, ImageHorodatee, Lecon, Parole } from "./types.ts";
import {
  assemblerVideos,
  decouperClip,
  dureeVideo,
  extraireImages,
  normaliserMorceau,
  preparerPourIA,
  recadrer,
  sequenceEtape,
  type MorceauVideo,
} from "./video.ts";

function nouvelleLecon(titre: string, metier: string, source: Lecon["source"]): Lecon {
  return {
    id: nouvelId(),
    titre: titre.trim() || "Leçon sans titre",
    metier: metier.trim() || "non précisé",
    source,
    creeLe: new Date().toISOString(),
    statut: "en_preparation",
    erreur: null,
    etapes: [],
  };
}

async function lireImages(dossier: string, images: ImageHorodatee[]): Promise<ImageIA[]> {
  return Promise.all(
    images.map(async (image) => ({ t: image.t, data: await readFile(path.join(dossier, image.fichier)) })),
  );
}

/**
 * Transforme les étapes proposées par l'IA en étapes de la leçon, bornes remises dans la durée.
 * Ce que le maître a dit pendant une étape est rangé avec elle (fiche écrite de l'apprenti).
 */
export function finaliserEtapes(brutes: EtapeBrute[], duree: number, paroles: Parole[] = []): Etape[] {
  return brutes.map((brute, i) => {
    const debut = Math.max(0, Math.min(brute.debut_s, duree));
    const fin = Math.max(debut, Math.min(brute.fin_s, duree));
    const derniere = i === brutes.length - 1;
    const dites = paroles.filter((p) => p.t >= debut && (p.t < fin || (derniere && p.t <= duree)));
    return {
      id: `etape-${i + 1}`,
      numero: i + 1,
      titre: brute.titre,
      consigne: brute.consigne,
      explication: brute.explication,
      paroles: dites.map((p) => p.texte),
      pointsDeControle: brute.points_de_controle,
      erreursFrequentes: brute.erreurs_frequentes,
      criteresDeReussite: brute.criteres_de_reussite,
      debut: Number(debut.toFixed(1)),
      fin: Number(fin.toFixed(1)),
      clip: null,
      clipLunettes: null,
      images: [],
    };
  });
}

async function echec(lecon: Lecon, erreur: unknown): Promise<void> {
  lecon.statut = "erreur";
  lecon.erreur = erreur instanceof Error ? erreur.message : String(erreur);
  console.error(`Leçon ${lecon.id} : échec de la préparation —`, lecon.erreur);
  await sauverLecon(lecon);
}

/**
 * Prépare une leçon à partir de la vidéo complète du maître :
 * l'IA découpe en étapes, puis chaque étape reçoit ses clips et sa séquence de référence.
 */
async function preparerDepuisVideo(
  lecon: Lecon,
  video: string,
  extras: { commentaire?: string; paroles?: Parole[]; reperes?: number[] } = {},
): Promise<void> {
  const dossier = dossierLecon(lecon.id);
  const dossierImages = path.join(dossier, "images");
  try {
    const duree = await dureeVideo(video);
    const extraites = await extraireImages(video, dossierImages, duree);
    if (extraites.length === 0) throw new Error("Aucune image n'a pu être extraite de la vidéo");

    const brutes = await construireLecon({
      titre: lecon.titre,
      metier: lecon.metier,
      images: await lireImages(dossierImages, extraites),
      duree,
      ...extras,
    });
    const etapes = finaliserEtapes(brutes, duree, extras.paroles);

    for (const etape of etapes) {
      // Un clip trop court ne montre rien : on garde au moins 2 secondes autour de l'étape.
      const debut = Math.max(0, Math.min(etape.debut ?? 0, duree - 2));
      const fin = Math.min(duree, Math.max(etape.fin ?? duree, debut + 2));
      const dossierClips = path.join(dossier, "clips");
      etape.clip = `etape-${etape.numero}.mp4`;
      etape.clipLunettes = `etape-${etape.numero}-lunettes.mp4`;
      await decouperClip(video, debut, fin, path.join(dossierClips, etape.clip), "tablette");
      await decouperClip(video, debut, fin, path.join(dossierClips, etape.clipLunettes), "lunettes");

      // Séquence de référence : le geste du maître sur toute l'étape, recadrée sur ses mains
      // comme le seront les images de l'apprenti. La première image entière sert de guide de placement.
      const brutes = await sequenceEtape(video, debut, fin);
      const { images: sequence } = await preparerPourIA(brutes);
      if (brutes.length > 0) {
        etape.imageGuide = `etape-${etape.numero}-guide.jpg`;
        await writeFile(path.join(dossierImages, etape.imageGuide), (await recadrer([brutes[0]], null))[0]);
      }
      etape.images = [];
      for (const [k, image] of sequence.entries()) {
        const fichier = `etape-${etape.numero}-ref-${k + 1}.jpg`;
        await writeFile(path.join(dossierImages, fichier), image);
        etape.images.push(fichier);
      }
    }

    await Promise.all(extraites.map((i) => unlink(path.join(dossierImages, i.fichier)).catch(() => undefined)));
    lecon.etapes = etapes;
    lecon.statut = "prete";
    await sauverLecon(lecon);
    console.log(`Leçon ${lecon.id} prête : ${etapes.length} étapes.`);
  } catch (erreur) {
    await echec(lecon, erreur);
  }
}

// ---------------------------------------------------------------------------
// Vidéo envoyée d'un bloc
// ---------------------------------------------------------------------------

/**
 * Enregistre la vidéo et lance la préparation en arrière-plan. La leçon est renvoyée tout de
 * suite avec le statut "en_preparation" ; son statut passe à "prete" ou "erreur" ensuite.
 */
export async function creerLeconDepuisVideo(options: {
  titre: string;
  metier: string;
  commentaire: string;
  video: Buffer;
}): Promise<Lecon> {
  const lecon = nouvelleLecon(options.titre, options.metier, "video");
  const dossier = await preparerDossierLecon(lecon.id);
  const cheminVideo = path.join(dossier, "source-video");
  await writeFile(cheminVideo, options.video);
  await sauverLecon(lecon);
  void preparerDepuisVideo(lecon, cheminVideo, { commentaire: options.commentaire });
  return lecon;
}

// ---------------------------------------------------------------------------
// Démonstration filmée avec les lunettes (morceaux de vidéo ou direct)
// ---------------------------------------------------------------------------

export class CaptureMaitre {
  readonly lecon: Lecon;
  readonly debut = Date.now();
  readonly paroles: Parole[] = [];
  readonly reperes: number[] = [];
  termine = false;
  private readonly morceaux: string[] = [];
  private fileAttente: Promise<void> = Promise.resolve();
  private direct: ReceptionDirect | null = null;
  /** Instant (depuis le début de la capture) où la vidéo commence vraiment. */
  private debutVideo: number | null = null;

  constructor(lecon: Lecon) {
    this.lecon = lecon;
  }

  private get dossier(): string {
    return path.join(dossierLecon(this.lecon.id), "capture");
  }

  private instant(): number {
    return Number(((Date.now() - this.debut) / 1000).toFixed(1));
  }

  /** Ajoute un morceau de vidéo (lunettes Meta). Les morceaux sont traités dans l'ordre d'arrivée. */
  ajouterMorceau(morceau: MorceauVideo): Promise<void> {
    const recu = this.instant();
    const numero = this.morceaux.length + 1;
    const fichier = path.join(this.dossier, `morceau-${String(numero).padStart(5, "0")}.mp4`);
    this.morceaux.push(fichier);
    const traitement = this.fileAttente.then(async () => {
      await mkdir(this.dossier, { recursive: true });
      await normaliserMorceau(morceau, fichier);
      // Le premier morceau a été filmé juste avant de nous parvenir.
      if (this.debutVideo === null) this.debutVideo = Math.max(0, recu - (await dureeVideo(fichier)));
    });
    // Un morceau illisible ne doit pas bloquer les suivants.
    this.fileAttente = traitement.catch((e: unknown) => console.warn("Morceau ignoré :", e));
    return traitement;
  }

  /** Ouvre un direct RTMP (lunettes Mentra) dont la vidéo est enregistrée pour la leçon. */
  async demarrerDirect(): Promise<ReceptionDirect> {
    if (this.direct) return this.direct;
    await mkdir(this.dossier, { recursive: true });
    this.direct = new ReceptionDirect({
      dossierEnregistrement: this.dossier,
      surImage: () => {
        if (this.debutVideo === null) this.debutVideo = this.instant();
      },
    });
    return this.direct;
  }

  ajouterParole(texte: string): void {
    if (texte.trim()) this.paroles.push({ t: this.instant(), texte: texte.trim() });
  }

  marquerEtape(): number {
    const t = this.instant();
    this.reperes.push(t);
    return t;
  }

  /** Termine la démonstration : la vidéo est assemblée et la leçon préparée en arrière-plan. */
  async terminer(): Promise<void> {
    if (this.termine) return;
    this.termine = true;
    await this.direct?.arreter();
    await this.fileAttente;
    void this.preparer();
  }

  private async preparer(): Promise<void> {
    try {
      const candidats = [...this.morceaux, ...(this.direct?.enregistrements ?? [])];
      const existants: string[] = [];
      for (const f of candidats) {
        if (await access(f).then(() => true, () => false)) existants.push(f);
      }
      if (existants.length === 0) throw new Error("Aucune vidéo reçue des lunettes du maître");
      const video = path.join(dossierLecon(this.lecon.id), "source-video.mp4");
      await assemblerVideos(existants, video);
      await rm(this.dossier, { recursive: true, force: true });

      // Les paroles et repères sont datés depuis le début de la capture : on les recale sur la vidéo.
      const decalage = this.debutVideo ?? 0;
      const recaler = (t: number) => Number(Math.max(0, t - decalage).toFixed(1));
      await preparerDepuisVideo(this.lecon, video, {
        paroles: this.paroles.map((p) => ({ ...p, t: recaler(p.t) })),
        reperes: this.reperes.map(recaler),
      });
    } catch (erreur) {
      await echec(this.lecon, erreur);
    }
  }
}

export async function demarrerCapture(titre: string, metier: string): Promise<CaptureMaitre> {
  const lecon = nouvelleLecon(titre, metier, "lunettes");
  await preparerDossierLecon(lecon.id);
  await sauverLecon(lecon);
  return new CaptureMaitre(lecon);
}
