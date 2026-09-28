// Types partagés du cerveau.

export interface Etape {
  id: string;
  numero: number;
  titre: string;
  /** Consigne courte lue à l'apprenti au début de l'étape. */
  consigne: string;
  /** Ce que l'IA doit vérifier pendant l'étape (outil, ordre, forme...). */
  pointsDeControle: string[];
  /** Erreurs typiques d'un débutant sur cette étape. */
  erreursFrequentes: string[];
  /** À quoi on reconnaît que l'étape est réussie (souvent le résultat visible). */
  criteresDeReussite: string[];
  /** Début et fin de l'étape dans la vidéo du maître, en secondes. */
  debut: number | null;
  fin: number | null;
  /** Nom du fichier du clip du maître pour cette étape (absent si la leçon vient des lunettes). */
  clip: string | null;
  /** Même clip en très petit format, pour l'écran des lunettes Meta Ray-Ban Display. */
  clipLunettes: string | null;
  /** Noms des fichiers des images de référence du maître. */
  images: string[];
}

export type StatutLecon = "en_preparation" | "prete" | "erreur";

export interface Lecon {
  id: string;
  titre: string;
  metier: string;
  source: "video" | "lunettes";
  creeLe: string;
  statut: StatutLecon;
  erreur: string | null;
  etapes: Etape[];
}

/** Une image extraite de la vidéo (ou prise par les lunettes) du maître. */
export interface ImageHorodatee {
  t: number;
  fichier: string;
}

export interface Parole {
  t: number;
  texte: string;
}

export type TypeVerdict = "en_cours" | "correction" | "etape_reussie" | "pas_visible";

export interface Verdict {
  verdict: TypeVerdict;
  /** Phrase courte à dire ou afficher à l'apprenti. Vide si rien à dire. */
  message: string;
  pointsValides: string[];
}

export type Commande = "suivant" | "precedent" | "repeter" | "recommencer";

/** Ce que les lunettes et la tablette reçoivent après chaque image ou commande. */
export interface Retour {
  sessionId: string;
  leconId: string;
  termine: boolean;
  etape: {
    index: number;
    total: number;
    titre: string;
    consigne: string;
    clipUrl: string | null;
    /** Version 266×150 sans son du clip, pour l'écran des lunettes. */
    clipLunettesUrl: string | null;
    imageUrls: string[];
  };
  verdict: TypeVerdict | null;
  /** Texte à afficher (écran des lunettes ou tablette). */
  afficher: string;
  /** Texte à dire à voix haute, ou null pour rester silencieux. */
  dire: string | null;
  /** true si l'image a été ignorée parce qu'une analyse était déjà en cours. */
  ignore: boolean;
}
