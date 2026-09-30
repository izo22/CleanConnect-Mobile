// Suivi des mains en direct dans le navigateur, avec MediaPipe (gratuit, tout se passe sur
// le téléphone : aucune image ne part, aucun appel à l'IA). Environ 15 mesures par seconde.

import { centrePaume } from "./mouvement.js";

const IMAGES_PAR_SECONDE = 15;

export class SuiviMains {
  static async creer() {
    const { FilesetResolver, HandLandmarker } = await import("/vendor/mediapipe/vision_bundle.mjs");
    const fichiers = await FilesetResolver.forVisionTasks("/vendor/mediapipe/wasm");
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: "/vendor/mediapipe/hand_landmarker.task", delegate },
      runningMode: "VIDEO",
      numHands: 2,
    });
    let detecteur;
    try {
      detecteur = await HandLandmarker.createFromOptions(fichiers, options("GPU"));
    } catch {
      detecteur = await HandLandmarker.createFromOptions(fichiers, options("CPU"));
    }
    return new SuiviMains(detecteur);
  }

  constructor(detecteur) {
    this.detecteur = detecteur;
    this.actif = false;
    this.dernier = 0;
  }

  /** Suit les mains de la vidéo ; `surMains(t, mains)` reçoit les centres des paumes (0 à 1). */
  demarrer(video, surMains) {
    this.actif = true;
    const tour = (maintenant) => {
      if (!this.actif) return;
      if (maintenant - this.dernier >= 1000 / IMAGES_PAR_SECONDE && video.readyState >= 2 && !video.paused) {
        this.dernier = maintenant;
        const resultat = this.detecteur.detectForVideo(video, maintenant);
        surMains(maintenant / 1000, (resultat.landmarks ?? []).map(centrePaume));
      }
      requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  }

  arreter() {
    this.actif = false;
  }
}
