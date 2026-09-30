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
  /**
   * Le détail du geste, écrit pour la fiche de l'apprenti (quelques phrases). Relu et corrigé
   * par le maître si besoin. Absent sur les leçons créées avant cette fonction.
   */
  explication?: string;
  /** Ce que le maître a dit pendant cette étape de sa démonstration (lunettes). */
  paroles?: string[];
  /**
   * Étape « à surveiller » (couteau, four…) : l'IA regarde en continu. Sinon, elle ne regarde
   * que quand l'apprenti le demande (« vérifie »), quand il veut passer à la suite, ou à la fin
   * d'un geste si la vérification automatique est activée.
   */
  surveiller?: boolean;
  /** Début et fin de l'étape dans la vidéo du maître, en secondes. */
  debut: number | null;
  fin: number | null;
  /** Nom du fichier du clip du maître pour cette étape (absent si la leçon vient des lunettes). */
  clip: string | null;
  /** Même clip en très petit format, pour l'écran des lunettes Meta Ray-Ban Display. */
  clipLunettes: string | null;
  /** Noms des fichiers des images de référence du maître (recadrées sur ses mains). */
  images: string[];
  /**
   * Légendes écrites par le maître sous les images de référence (même ordre que `images` ;
   * "" = pas de légende). L'apprenti les voit, et l'IA s'en sert pour comprendre le geste.
   */
  legendes?: string[];
  /** Première image de l'étape, non recadrée : le guide de placement du téléphone de l'apprenti. */
  imageGuide?: string | null;
}

export type StatutLecon = "en_preparation" | "prete" | "erreur";

/** Règle donnée par le maître pour corriger l'interprétation de l'IA (elle prime sur son jugement). */
export interface Regle {
  id: string;
  /** Étape concernée, ou null pour toute la leçon. */
  etapeId: string | null;
  texte: string;
  creeLe: string;
  /** Intervention jugée fausse qui a donné naissance à la règle, s'il y en a une. */
  source: string | null;
}

export interface Lecon {
  id: string;
  titre: string;
  metier: string;
  source: "video" | "lunettes";
  creeLe: string;
  statut: StatutLecon;
  erreur: string | null;
  etapes: Etape[];
  /** Règles du maître (absent sur les leçons créées avant cette fonction). */
  regles?: Regle[];
  /** Cadence d'analyse : 2 (gestes lents) à 5 (gestes rapides) images par seconde. Défaut : 2. */
  imagesParSeconde?: number;
  /** Vérifier tout seul quand l'apprenti s'arrête de bouger (fin probable d'un geste). Défaut : non. */
  verificationAuto?: boolean;
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

/** Jetons consommés par un appel à l'IA (pour calculer le coût). */
export interface Consommation {
  entree: number;
  sortie: number;
  cacheLecture: number;
  cacheEcriture: number;
}

export interface Verdict {
  verdict: TypeVerdict;
  /** Phrase courte à dire ou afficher à l'apprenti. Vide si rien à dire. */
  message: string;
  pointsValides: string[];
  usage?: Consommation;
  /** Ce que l'IA a vu du mouvement avant de juger (variante « observer »). */
  observation?: string;
}

// ---------------------------------------------------------------------------
// Journal des séances (évaluation du pilote)
// ---------------------------------------------------------------------------

/**
 * Avis du maître sur une intervention :
 * - sur une correction ou une validation : "juste", "fausse" ou "inutile" ;
 * - sur un silence : "ok" (rien à dire) ou "manquee" (l'IA aurait dû corriger).
 */
export type Avis = "juste" | "fausse" | "inutile" | "ok" | "manquee";

export interface Annotation {
  avis: Avis;
  commentaire: string;
  regleId: string | null;
  le: string;
}

/**
 * Ce qui a déclenché une analyse :
 * - "demande" : l'apprenti a dit « vérifie » ou appuyé sur le bouton ;
 * - "suivant" : il a voulu passer à l'étape suivante ;
 * - "auto" : il s'est arrêté de bouger (vérification automatique) ;
 * - "continu" : étape à surveiller, l'IA regarde en permanence.
 */
export type Declencheur = "demande" | "suivant" | "auto" | "continu";

/** Une analyse de l'IA pendant une séance, avec les images qu'elle a vues. */
export interface Intervention {
  id: string;
  seanceId: string;
  leconId: string;
  etapeId: string;
  etapeNumero: number;
  t: string;
  /** Absent sur les séances enregistrées avant l'analyse à la demande (c'était alors "continu"). */
  declencheur?: Declencheur;
  verdict: TypeVerdict;
  message: string;
  /** Vrai si le message a été dit à l'apprenti (sinon : silence ou répétition évitée). */
  dit: boolean;
  pointsValides: string[];
  images: string[];
  /** Temps de réponse de l'IA, en millisecondes. */
  latenceMs: number;
  usage: Consommation | null;
  coutUsd: number;
  annotation: Annotation | null;
}

export type TypeEvenement = "etape" | "etape_reussie" | "etape_passee" | "termine";

export interface Evenement {
  t: string;
  type: TypeEvenement;
  etapeId: string;
}

export interface Seance {
  id: string;
  leconId: string;
  apprenti: string;
  debut: string;
  derniereActivite: string;
  termine: boolean;
  evenements: Evenement[];
}

export type Commande = "suivant" | "precedent" | "repeter" | "recommencer" | "verifier" | "expliquer";

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
    /** Légendes du maître, dans l'ordre des images ("" = pas de légende). */
    legendes: string[];
    /** Image entière du début de l'étape, pour caler le téléphone de l'apprenti (guide de placement). */
    imageGuideUrl: string | null;
    /** Texte écrit de l'étape (fiche de l'apprenti). */
    explication: string;
    pointsDeControle: string[];
    erreursFrequentes: string[];
    criteresDeReussite: string[];
    paroles: string[];
    /** "demande" : l'IA regarde quand on lui demande ; "continu" : étape surveillée en permanence. */
    analyse: "demande" | "continu";
    /** Secondes de vidéo que l'IA regarde quand on lui demande de vérifier. */
    fenetreS: number;
    /**
     * Vrai si le cerveau a besoin de la vidéo en permanence (étape surveillée ou vérification
     * automatique). Sinon les lunettes peuvent n'envoyer la vidéo qu'avec « vérifie » ou « suivant ».
     */
    envoiVideoContinu: boolean;
  };
  verdict: TypeVerdict | null;
  /** Texte à afficher (écran des lunettes ou tablette). */
  afficher: string;
  /** Texte à dire à voix haute, ou null pour rester silencieux. */
  dire: string | null;
  /** true pendant que l'IA regarde le geste (l'écran de l'apprenti passe en « je regarde… »). */
  regarde?: boolean;
  /**
   * true si rien de nouveau n'est à montrer : vidéo simplement gardée en mémoire (analyse à la
   * demande) ou analyse déjà en cours.
   */
  ignore: boolean;
}
