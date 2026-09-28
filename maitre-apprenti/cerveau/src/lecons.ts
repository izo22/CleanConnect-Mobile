// Fabrication des leçons : à partir d'une vidéo du maître, ou d'une démonstration filmée en direct avec les lunettes.

import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { construireLecon, type EtapeBrute, type ImageIA } from "./ia.ts";
import { dossierLecon, nouvelId, preparerDossierLecon, sauverLecon } from "./store.ts";
import type { Etape, ImageHorodatee, Lecon, Parole } from "./types.ts";
import { decouperClip, dureeVideo, extraireImages, IMAGES_MAX_POUR_IA } from "./video.ts";

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

/** Garde au plus `max` éléments, régulièrement répartis. */
export function echantillonner<T>(elements: T[], max: number): T[] {
  if (elements.length <= max) return elements;
  const pas = elements.length / max;
  return Array.from({ length: max }, (_, i) => elements[Math.floor(i * pas)]);
}

/**
 * Transforme les étapes proposées par l'IA en étapes de la leçon : bornes remises dans la
 * durée, images de référence vérifiées (et choisies au milieu de l'étape si l'IA n'en donne pas).
 */
export function finaliserEtapes(
  brutes: EtapeBrute[],
  images: ImageHorodatee[],
  duree: number | null,
): Etape[] {
  const fin = duree ?? images[images.length - 1]?.t ?? 0;
  return brutes.map((brute, i) => {
    const debut = Math.max(0, Math.min(brute.debut_s, fin));
    const finEtape = Math.max(debut, Math.min(brute.fin_s, fin));
    const indices = [...new Set(brute.images_reference)].filter((n) => n >= 0 && n < images.length).slice(0, 3);
    if (indices.length === 0 && images.length > 0) {
      const milieu = (debut + finEtape) / 2;
      let proche = 0;
      images.forEach((image, n) => {
        if (Math.abs(image.t - milieu) < Math.abs(images[proche].t - milieu)) proche = n;
      });
      indices.push(proche);
    }
    return {
      id: `etape-${i + 1}`,
      numero: i + 1,
      titre: brute.titre,
      consigne: brute.consigne,
      pointsDeControle: brute.points_de_controle,
      erreursFrequentes: brute.erreurs_frequentes,
      criteresDeReussite: brute.criteres_de_reussite,
      debut: Number(debut.toFixed(1)),
      fin: Number(finEtape.toFixed(1)),
      clip: null,
      clipLunettes: null,
      images: indices.map((n) => images[n].fichier),
    };
  });
}

/** Supprime les images extraites qui ne servent de référence à aucune étape. */
async function nettoyerImages(dossier: string, toutes: ImageHorodatee[], etapes: Etape[]): Promise<void> {
  const utilisees = new Set(etapes.flatMap((e) => e.images));
  await Promise.all(
    toutes
      .filter((image) => !utilisees.has(image.fichier))
      .map((image) => unlink(path.join(dossier, image.fichier)).catch(() => undefined)),
  );
}

async function echec(lecon: Lecon, erreur: unknown): Promise<void> {
  lecon.statut = "erreur";
  lecon.erreur = erreur instanceof Error ? erreur.message : String(erreur);
  console.error(`Leçon ${lecon.id} : échec de la préparation —`, lecon.erreur);
  await sauverLecon(lecon);
}

// ---------------------------------------------------------------------------
// Depuis une vidéo
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
  void preparerDepuisVideo(lecon, cheminVideo, options.commentaire);
  return lecon;
}

async function preparerDepuisVideo(lecon: Lecon, video: string, commentaire: string): Promise<void> {
  const dossierImages = path.join(dossierLecon(lecon.id), "images");
  try {
    const duree = await dureeVideo(video);
    const images = await extraireImages(video, dossierImages, duree);
    if (images.length === 0) throw new Error("Aucune image n'a pu être extraite de la vidéo");

    const brutes = await construireLecon({
      titre: lecon.titre,
      metier: lecon.metier,
      images: await lireImages(dossierImages, images),
      duree,
      commentaire,
    });
    const etapes = finaliserEtapes(brutes, images, duree);

    for (const etape of etapes) {
      // Un clip trop court ne montre rien : on garde au moins 2 secondes autour de l'étape.
      const debut = Math.max(0, Math.min(etape.debut ?? 0, duree - 2));
      const fin = Math.min(duree, Math.max(etape.fin ?? duree, debut + 2));
      const dossierClips = path.join(dossierLecon(lecon.id), "clips");
      etape.clip = `etape-${etape.numero}.mp4`;
      etape.clipLunettes = `etape-${etape.numero}-lunettes.mp4`;
      await decouperClip(video, debut, fin, path.join(dossierClips, etape.clip), "tablette");
      await decouperClip(video, debut, fin, path.join(dossierClips, etape.clipLunettes), "lunettes");
    }

    await nettoyerImages(dossierImages, images, etapes);
    lecon.etapes = etapes;
    lecon.statut = "prete";
    await sauverLecon(lecon);
    console.log(`Leçon ${lecon.id} prête : ${etapes.length} étapes.`);
  } catch (erreur) {
    await echec(lecon, erreur);
  }
}

// ---------------------------------------------------------------------------
// Depuis les lunettes du maître (démonstration en direct)
// ---------------------------------------------------------------------------

export class CaptureMaitre {
  readonly lecon: Lecon;
  readonly debut = Date.now();
  readonly images: ImageHorodatee[] = [];
  readonly paroles: Parole[] = [];
  readonly reperes: number[] = [];
  termine = false;

  constructor(lecon: Lecon) {
    this.lecon = lecon;
  }

  private instant(): number {
    return Number(((Date.now() - this.debut) / 1000).toFixed(1));
  }

  async ajouterImage(data: Buffer): Promise<ImageHorodatee> {
    const image = {
      t: this.instant(),
      fichier: `direct_${String(this.images.length + 1).padStart(4, "0")}.jpg`,
    };
    await writeFile(path.join(dossierLecon(this.lecon.id), "images", image.fichier), data);
    this.images.push(image);
    return image;
  }

  ajouterParole(texte: string): void {
    if (texte.trim()) this.paroles.push({ t: this.instant(), texte: texte.trim() });
  }

  marquerEtape(): number {
    const t = this.instant();
    this.reperes.push(t);
    return t;
  }

  /** Termine la démonstration et prépare la leçon en arrière-plan. */
  terminer(): void {
    if (this.termine) return;
    this.termine = true;
    void this.preparer();
  }

  private async preparer(): Promise<void> {
    const dossierImages = path.join(dossierLecon(this.lecon.id), "images");
    try {
      if (this.images.length === 0) throw new Error("Aucune image reçue des lunettes du maître");
      const choisies = echantillonner(this.images, IMAGES_MAX_POUR_IA);
      const duree = this.instant();
      const brutes = await construireLecon({
        titre: this.lecon.titre,
        metier: this.lecon.metier,
        images: await lireImages(dossierImages, choisies),
        duree,
        paroles: this.paroles,
        reperes: this.reperes,
      });
      const etapes = finaliserEtapes(brutes, choisies, duree);
      await nettoyerImages(dossierImages, this.images, etapes);
      this.lecon.etapes = etapes;
      this.lecon.statut = "prete";
      await sauverLecon(this.lecon);
      console.log(`Leçon ${this.lecon.id} (lunettes) prête : ${etapes.length} étapes.`);
    } catch (erreur) {
      await echec(this.lecon, erreur);
    }
  }
}

export async function demarrerCapture(titre: string, metier: string): Promise<CaptureMaitre> {
  const lecon = nouvelleLecon(titre, metier, "lunettes");
  await sauverLecon(lecon);
  return new CaptureMaitre(lecon);
}
