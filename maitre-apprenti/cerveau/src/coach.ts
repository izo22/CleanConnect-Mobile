// Session d'un apprenti : suit l'étape en cours, garde en mémoire la vidéo récente et demande
// à l'IA de juger le geste quand il le faut :
// - à la demande (« vérifie », bouton), quand l'apprenti veut passer à l'étape suivante, ou à la
//   fin d'un geste si la vérification automatique est activée — c'est le cas par défaut ;
// - en continu pour les étapes « à surveiller » (couteau, four…).
// Garder la vidéo ne coûte rien ; seul chaque appel à l'IA est payant.

import { readFile } from "node:fs/promises";
import { ReceptionDirect } from "./direct.ts";
import { evaluerGeste, type ImageIA } from "./ia.ts";
import { journalDisque, nouvelleSeance, type JournalSeance } from "./journal.ts";
import { cheminMedia, nouvelId, urlMedia } from "./store.ts";
import type { Commande, Declencheur, Etape, Lecon, Retour, TypeEvenement, Verdict } from "./types.ts";
import {
  cadenceValide,
  IMAGES_PAR_SEQUENCE,
  mouvement,
  preparerPourIA,
  SECONDES_MAX_EN_MEMOIRE,
  vignettesGris,
} from "./video.ts";

/** Étape surveillée en direct : on relance une analyse dès que 2 secondes nouvelles sont arrivées (et que l'IA est libre). */
const SECONDES_NOUVELLES_AVANT_ANALYSE = 2;
/** Nombre de conseils déjà donnés que l'IA garde en mémoire pendant une étape. */
const CONSEILS_EN_MEMOIRE = 4;
/** Délai avant de répéter à voix haute un message identique. */
const DELAI_REPETITION_MS = 15_000;
/** Délai entre deux rappels « je ne vois pas bien ». */
const DELAI_PAS_VISIBLE_MS = 20_000;
/** Une session sans activité pendant ce délai est oubliée. */
const DUREE_VIE_SESSION_MS = 2 * 60 * 60 * 1000;
/** En direct (RTMP), la vidéo arrive avec un peu de retard : on attend la fin du geste avant de vérifier. */
const RETARD_DIRECT_MS = 1_500;
/** Durée regardée quand on ne connaît pas la durée de l'étape chez le maître. */
const FENETRE_PAR_DEFAUT_S = 8;
const FENETRE_MIN_S = 4;
/** Il faut au moins 1 seconde de vidéo de l'étape pour vérifier quelque chose. */
const SECONDES_MIN_POUR_VERIFIER = 1;
/**
 * La vidéo est gardée à 4 images par seconde au moins : assez pour montrer à l'IA des paires
 * d'images à un quart de seconde d'écart, entre lesquelles se voit le sens du mouvement.
 */
const IMAGES_PAR_SECONDE_MEMOIRE = 4;
/** Une vérification montre 4 moments de la tentative, chacun par 2 images rapprochées. */
const MOMENTS_PAR_VERIFICATION = 4;
/** Pas deux vérifications automatiques à moins de 10 secondes d'écart. */
const ECART_MIN_AUTO_MS = 10_000;

export type Evaluateur = (options: Parameters<typeof evaluerGeste>[0]) => Promise<Verdict>;
export type ChargeurImage = (leconId: string, fichier: string) => Promise<Buffer>;
export type FabriqueVignettes = (images: Buffer[]) => Promise<Buffer[]>;
/** Prépare les images envoyées à l'IA (recadrage sur les mains), `reperage` servant à trouver la zone. */
export type PreparateurImages = (images: Buffer[], reperage: Buffer[]) => Promise<Buffer[]>;

/** Recadrage automatique ; en cas d'échec (image illisible…), les images partent telles quelles. */
async function recadrerSurLesMains(images: Buffer[], reperage: Buffer[]): Promise<Buffer[]> {
  try {
    return (await preparerPourIA(images, reperage)).images;
  } catch (erreur) {
    console.warn("Recadrage impossible, images entières :", erreur instanceof Error ? erreur.message : erreur);
    return images;
  }
}

async function chargerImageDisque(leconId: string, fichier: string): Promise<Buffer> {
  const chemin = cheminMedia(leconId, "images", fichier);
  if (!chemin) throw new Error(`Image de référence invalide : ${fichier}`);
  return readFile(chemin);
}

/** Journal qui n'enregistre rien (tests, ou séance sans suivi). */
const SANS_JOURNAL: JournalSeance = { evenement: () => {}, intervention: () => {} };

/**
 * Secondes de vidéo que l'IA regarde quand on lui demande de vérifier : une fois et demie la
 * durée de l'étape chez le maître (l'apprenti est plus lent), entre 4 et 20 secondes.
 */
export function fenetreEtape(etape: Etape): number {
  if (etape.debut === null || etape.fin === null || etape.fin <= etape.debut) return FENETRE_PAR_DEFAUT_S;
  return Math.min(SECONDES_MAX_EN_MEMOIRE, Math.max(FENETRE_MIN_S, Math.round((etape.fin - etape.debut) * 1.5)));
}

/** Choisit `nombre` éléments régulièrement répartis, du premier au dernier. */
export function echantillonner<T>(elements: T[], nombre = IMAGES_PAR_SEQUENCE): T[] {
  if (elements.length <= nombre) return [...elements];
  return Array.from({ length: nombre }, (_, k) => elements[Math.round((k * (elements.length - 1)) / (nombre - 1))]);
}

/**
 * Choisit les images d'une tentative : `moments` instants régulièrement répartis, chacun avec
 * l'image qui le suit immédiatement. Mesuré sur de vraies vidéos : l'IA voit bien mieux le sens
 * du mouvement (qui s'enroule ou se déroule, vers le centre ou vers les bouts) que sur 8 images
 * régulières, pour le même nombre d'images. Renvoie les indices choisis, dans l'ordre.
 */
export function pairesRapprochees(nombre: number, moments = MOMENTS_PAR_VERIFICATION): number[] {
  if (nombre <= moments * 2) return Array.from({ length: nombre }, (_, i) => i);
  const departs = echantillonner(Array.from({ length: nombre - 1 }, (_, i) => i), moments);
  return departs.flatMap((i) => [i, i + 1]);
}

/**
 * Repère la fin probable d'un geste, sans IA : l'image a bougé pendant quelques secondes
 * (l'apprenti travaille), puis ne bouge presque plus (il s'arrête pour regarder son résultat).
 * Les seuils sont des points de départ, à régler sur le terrain.
 */
export class DetecteurFinDeGeste {
  static readonly SEUIL_MOUVEMENT = 0.05;
  static readonly SEUIL_CALME = 0.015;
  static readonly ACTIVITE_MIN_S = 3;
  static readonly CALME_MIN_S = 1.5;
  private precedente: Buffer | null = null;
  private imagesActives = 0;
  private imagesCalmes = 0;
  private readonly imagesParSeconde: number;

  constructor(imagesParSeconde: number) {
    this.imagesParSeconde = imagesParSeconde;
  }

  /** Ajoute la vignette suivante ; renvoie true au moment où un geste vient de se terminer. */
  ajouter(vignette: Buffer): boolean {
    const precedente = this.precedente;
    this.precedente = vignette;
    if (!precedente) return false;
    const m = mouvement(precedente, vignette);
    if (m >= DetecteurFinDeGeste.SEUIL_MOUVEMENT) {
      this.imagesActives++;
      this.imagesCalmes = 0;
      return false;
    }
    this.imagesCalmes = m < DetecteurFinDeGeste.SEUIL_CALME ? this.imagesCalmes + 1 : 0;
    const assezActif = this.imagesActives >= DetecteurFinDeGeste.ACTIVITE_MIN_S * this.imagesParSeconde;
    if (assezActif && this.imagesCalmes >= DetecteurFinDeGeste.CALME_MIN_S * this.imagesParSeconde) {
      this.reinitialiser();
      return true;
    }
    return false;
  }

  reinitialiser(): void {
    this.imagesActives = 0;
    this.imagesCalmes = 0;
  }
}

export class SessionApprenti {
  readonly id = nouvelId();
  lecon: Lecon;
  readonly apprenti: string;
  derniereActivite: number;
  private index = 0;
  private termine = false;
  private analyseEnCours = false;
  private direct: ReceptionDirect | null = null;
  /** Vidéo récente de l'étape en cours (images d'analyse, au plus 20 secondes). */
  private images: Buffer[] = [];
  private nouvellesImages = 0;
  private lotDirect: Buffer[] = [];
  private detecteur: DetecteurFinDeGeste;
  private derniereVerification = Number.NEGATIVE_INFINITY;
  /** L'IA a corrigé l'apprenti qui voulait passer : un second « suivant » passe quand même. */
  private correctionAvantSuivant = false;
  private conseils: string[] = [];
  private dernierDit: { texte: string; quand: number } | null = null;
  private dernierPasVisible = 0;
  private dernierRetour: Retour;
  private abonnes = new Set<(retour: Retour) => void>();
  private imagesMaitre = new Map<string, ImageIA[]>();
  private readonly evaluateur: Evaluateur;
  private readonly chargerImage: ChargeurImage;
  private readonly vignettes: FabriqueVignettes;
  private readonly preparer: PreparateurImages;
  private readonly maintenant: () => number;
  private readonly attendre: (ms: number) => Promise<void>;
  private readonly journal: JournalSeance;

  constructor(
    lecon: Lecon,
    options: {
      evaluateur?: Evaluateur;
      chargerImage?: ChargeurImage;
      vignettes?: FabriqueVignettes;
      preparerImages?: PreparateurImages;
      maintenant?: () => number;
      attendre?: (ms: number) => Promise<void>;
      apprenti?: string;
      /** Fabrique le journal de la séance (par défaut : aucun). */
      journal?: (session: SessionApprenti) => JournalSeance;
    } = {},
  ) {
    if (lecon.statut !== "prete" || lecon.etapes.length === 0) {
      throw new Error("Cette leçon n'est pas encore prête");
    }
    this.lecon = lecon;
    this.apprenti = options.apprenti?.trim() || "Anonyme";
    this.journal = options.journal?.(this) ?? SANS_JOURNAL;
    this.evaluateur = options.evaluateur ?? evaluerGeste;
    this.chargerImage = options.chargerImage ?? chargerImageDisque;
    this.vignettes = options.vignettes ?? vignettesGris;
    this.preparer = options.preparerImages ?? recadrerSurLesMains;
    this.maintenant = options.maintenant ?? Date.now;
    this.attendre = options.attendre ?? ((ms) => new Promise((ok) => setTimeout(ok, ms)));
    this.derniereActivite = this.maintenant();
    this.detecteur = new DetecteurFinDeGeste(this.imagesParSecondeMemoire);
    const annonce = this.annonceEtape();
    const astuce = this.analyse === "demande" ? " Quand tu as fini un geste, dis « vérifie »." : "";
    this.dernierRetour = this.retour({ afficher: annonce, dire: annonce + astuce });
  }

  get etat(): Retour {
    return this.dernierRetour;
  }

  private get etape() {
    return this.lecon.etapes[this.index];
  }

  /** Cadence d'analyse de la leçon (images par seconde). */
  get imagesParSeconde(): number {
    return cadenceValide(this.lecon.imagesParSeconde);
  }

  /** Cadence de la vidéo gardée en mémoire (et donc des morceaux et du direct reçus). */
  get imagesParSecondeMemoire(): number {
    return Math.max(IMAGES_PAR_SECONDE_MEMOIRE, this.imagesParSeconde);
  }

  /** "continu" pour une étape à surveiller, sinon l'IA ne regarde que quand il le faut. */
  private get analyse(): "demande" | "continu" {
    return this.etape.surveiller ? "continu" : "demande";
  }

  /** Le cerveau a besoin de toute la vidéo : étape surveillée, ou vérification automatique. */
  private get envoiVideoContinu(): boolean {
    return this.analyse === "continu" || this.lecon.verificationAuto === true;
  }

  /** Règles du maître qui s'appliquent à l'étape en cours (celles de l'étape et celles de toute la leçon). */
  private reglesEtape(): string[] {
    return (this.lecon.regles ?? []).filter((r) => r.etapeId === null || r.etapeId === this.etape.id).map((r) => r.texte);
  }

  /** Prend en compte une leçon modifiée (règles, textes, réglages) sans interrompre la séance. */
  majLecon(lecon: Lecon): void {
    if (lecon.id !== this.lecon.id || lecon.etapes.length !== this.lecon.etapes.length) return;
    const cadence = this.imagesParSecondeMemoire;
    this.lecon = lecon;
    if (this.imagesParSecondeMemoire !== cadence) this.detecteur = new DetecteurFinDeGeste(this.imagesParSecondeMemoire);
    // Les lunettes et la tablette reçoivent les nouveaux textes et le nouveau mode d'analyse.
    const actuel = this.dernierRetour;
    this.publier(this.retour({ verdict: actuel.verdict, afficher: actuel.afficher, dire: null }));
  }

  private noter(type: TypeEvenement): void {
    this.journal.evenement(type, this.etape.id);
  }

  private annonceEtape(): string {
    const surveillance = this.analyse === "continu" ? " Je te surveille pendant cette étape." : "";
    return `Étape ${this.etape.numero} : ${this.etape.titre}. ${this.etape.consigne}${surveillance}`;
  }

  /** Le texte écrit de l'étape, lu quand l'apprenti dit « explique ». */
  private texteExplication(): string {
    const etape = this.etape;
    const sansPoint = (t: string) => t.trim().replace(/[.!]+$/, "");
    let texte = `${etape.titre}. ${etape.explication?.trim() || etape.consigne}`;
    if (etape.criteresDeReussite.length) {
      texte += ` C'est réussi quand : ${etape.criteresDeReussite.map(sansPoint).join(" ; ")}.`;
    }
    return texte;
  }

  private retour(partiel: Partial<Retour> & { afficher: string; dire: string | null }): Retour {
    const etape = this.etape;
    return {
      sessionId: this.id,
      leconId: this.lecon.id,
      termine: this.termine,
      etape: {
        index: this.index,
        total: this.lecon.etapes.length,
        titre: etape.titre,
        consigne: etape.consigne,
        clipUrl: etape.clip ? urlMedia(this.lecon.id, "clips", etape.clip) : null,
        clipLunettesUrl: etape.clipLunettes ? urlMedia(this.lecon.id, "clips", etape.clipLunettes) : null,
        imageUrls: etape.images.map((f) => urlMedia(this.lecon.id, "images", f)),
        legendes: etape.images.map((_, i) => etape.legendes?.[i] ?? ""),
        mouvementMains: etape.mouvementMains ?? null,
        imageGuideUrl: etape.imageGuide ? urlMedia(this.lecon.id, "images", etape.imageGuide) : null,
        explication: etape.explication?.trim() || etape.consigne,
        pointsDeControle: etape.pointsDeControle,
        erreursFrequentes: etape.erreursFrequentes,
        criteresDeReussite: etape.criteresDeReussite,
        paroles: etape.paroles ?? [],
        analyse: this.analyse,
        fenetreS: fenetreEtape(etape),
        envoiVideoContinu: this.envoiVideoContinu,
      },
      verdict: null,
      ignore: false,
      ...partiel,
    };
  }

  private publier(retour: Retour): Retour {
    this.dernierRetour = retour;
    this.derniereActivite = this.maintenant();
    for (const abonne of this.abonnes) abonne(retour);
    return retour;
  }

  /** Réponse « rien de nouveau » (vidéo gardée en mémoire, ou IA déjà occupée). */
  private sansNouveaute(): Retour {
    return { ...this.dernierRetour, dire: null, ignore: true };
  }

  abonner(abonne: (retour: Retour) => void): () => void {
    this.abonnes.add(abonne);
    return () => this.abonnes.delete(abonne);
  }

  private changerEtape(index: number): void {
    this.index = index;
    this.noter("etape");
    this.images = [];
    this.nouvellesImages = 0;
    this.lotDirect = [];
    this.detecteur.reinitialiser();
    this.correctionAvantSuivant = false;
    this.conseils = [];
    this.dernierDit = null;
  }

  /** Ne répète pas à voix haute le même message à quelques secondes d'intervalle. */
  private aDire(texte: string): string | null {
    const maintenant = this.maintenant();
    if (this.dernierDit?.texte === texte && maintenant - this.dernierDit.quand < DELAI_REPETITION_MS) {
      return null;
    }
    this.dernierDit = { texte, quand: maintenant };
    return texte;
  }

  private async referencesMaitre(): Promise<ImageIA[]> {
    const etape = this.etape;
    let images = this.imagesMaitre.get(etape.id);
    if (!images) {
      images = await Promise.all(
        etape.images.map(async (fichier) => ({ data: await this.chargerImage(this.lecon.id, fichier) })),
      );
      this.imagesMaitre.set(etape.id, images);
    }
    return images;
  }

  // --- Vidéo reçue -------------------------------------------------------------------

  /** Garde des images en mémoire (gratuit : aucun appel à l'IA). */
  private memoriser(images: Buffer[]): void {
    this.derniereActivite = this.maintenant();
    this.images = [...this.images, ...images].slice(-SECONDES_MAX_EN_MEMOIRE * this.imagesParSecondeMemoire);
  }

  /**
   * Reçoit un morceau de vidéo de l'apprenti (images successives, de la plus ancienne à la plus
   * récente). Selon l'étape : simple mise en mémoire, analyse continue (étape surveillée), ou
   * commande envoyée avec la vidéo (« vérifie » ou « suivant » des lunettes Meta).
   */
  async recevoirVideo(images: Buffer[], commande?: "verifier" | "suivant"): Promise<Retour> {
    if (this.termine) return this.dernierRetour;
    this.memoriser(images);
    if (commande) return this.commande(commande);
    if (this.analyse === "continu") return this.analyserContinu();
    if (this.lecon.verificationAuto) return (await this.detecterFinDeGeste(images)) ?? this.sansNouveaute();
    return this.sansNouveaute();
  }

  /** Vérification automatique : si l'apprenti vient de s'arrêter de bouger, on vérifie son geste. */
  private async detecterFinDeGeste(images: Buffer[]): Promise<Retour | null> {
    const indexAuDepart = this.index;
    let vignettes: Buffer[];
    try {
      vignettes = await this.vignettes(images);
    } catch (erreur) {
      console.warn(`Session ${this.id} : détection de mouvement impossible —`, erreur);
      return null;
    }
    if (this.index !== indexAuDepart || this.termine) return null;
    let fin = false;
    for (const vignette of vignettes) fin = this.detecteur.ajouter(vignette) || fin;
    if (!fin || this.analyseEnCours || this.maintenant() - this.derniereVerification < ECART_MIN_AUTO_MS) return null;
    return this.verifier("auto");
  }

  private async appelerIA(sequence: Buffer[], dureeS: number, demande: boolean, instantsS?: number[]): Promise<Verdict> {
    return this.evaluateur({
      titreLecon: this.lecon.titre,
      etape: this.etape,
      totalEtapes: this.lecon.etapes.length,
      imagesMaitre: await this.referencesMaitre(),
      legendesMaitre: this.etape.legendes,
      imagesApprenti: sequence.map((data) => ({ data })),
      derniersConseils: this.conseils,
      regles: this.reglesEtape(),
      dureeS,
      demande,
      instantsS,
    });
  }

  /** Chaque analyse est gardée, silences compris, pour que le maître puisse la juger. */
  private journaliser(
    declencheur: Declencheur,
    etape: Etape,
    debut: number,
    verdict: Verdict,
    sequence: Buffer[],
    retour: Retour | null,
  ): void {
    this.journal.intervention(
      {
        etapeId: etape.id,
        etapeNumero: etape.numero,
        t: new Date(debut).toISOString(),
        declencheur,
        verdict: verdict.verdict,
        message: verdict.message,
        dit: Boolean(retour?.dire) && !retour?.ignore,
        pointsValides: verdict.pointsValides,
        latenceMs: this.maintenant() - debut,
        usage: verdict.usage ?? null,
      },
      sequence,
    );
  }

  // --- Étape surveillée : analyse continue ---------------------------------------------

  private async analyserContinu(): Promise<Retour> {
    if (this.termine || this.images.length === 0) return this.dernierRetour;
    // La vidéo arrive en continu ; si l'IA n'a pas fini la séquence précédente, on n'empile pas de retard.
    if (this.analyseEnCours) return this.sansNouveaute();

    // Les 8 dernières images à la cadence de la leçon (la mémoire en garde davantage).
    const memoire = this.imagesParSecondeMemoire;
    const brute = echantillonner(this.images.slice(-Math.round((IMAGES_PAR_SEQUENCE * memoire) / this.imagesParSeconde)));
    const indexAuDepart = this.index;
    const etape = this.etape;
    this.analyseEnCours = true;
    let verdict: Verdict;
    let sequence = brute;
    const debut = this.maintenant();
    try {
      sequence = await this.preparer(brute, brute);
      verdict = await this.appelerIA(sequence, (brute.length - 1) / this.imagesParSeconde, false);
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : String(erreur);
      console.error(`Session ${this.id} : analyse impossible —`, message);
      return this.publier(this.retour({ afficher: `IA indisponible : ${message}`, dire: null }));
    } finally {
      this.analyseEnCours = false;
    }

    // L'apprenti a changé d'étape (commande) pendant l'analyse : ce verdict ne vaut plus.
    if (this.index !== indexAuDepart || this.termine) return this.dernierRetour;

    const retour = this.appliquerVerdict(verdict);
    this.journaliser("continu", etape, debut, verdict, sequence, retour);
    return retour;
  }

  private appliquerVerdict(verdict: Verdict): Retour {
    switch (verdict.verdict) {
      case "etape_reussie":
        return this.etapeReussie(verdict.message || "Bravo !");
      case "correction": {
        if (!verdict.message) break;
        this.conseils = [...this.conseils, verdict.message].slice(-CONSEILS_EN_MEMOIRE);
        return this.publier(
          this.retour({ verdict: "correction", afficher: verdict.message, dire: this.aDire(verdict.message) }),
        );
      }
      case "pas_visible": {
        const message = verdict.message || "Je ne vois pas bien, regarde ton plan de travail.";
        const maintenant = this.maintenant();
        const dire = maintenant - this.dernierPasVisible >= DELAI_PAS_VISIBLE_MS ? message : null;
        if (dire) this.dernierPasVisible = maintenant;
        return this.publier(this.retour({ verdict: "pas_visible", afficher: message, dire }));
      }
      case "en_cours":
        break;
    }
    const valides = verdict.pointsValides.length ? `\n✓ ${verdict.pointsValides.join("\n✓ ")}` : "";
    return this.publier(this.retour({ verdict: "en_cours", afficher: this.etape.consigne + valides, dire: null }));
  }

  private etapeReussie(bravo: string): Retour {
    this.noter("etape_reussie");
    if (this.index === this.lecon.etapes.length - 1) {
      this.termine = true;
      this.noter("termine");
      const fin = `${bravo} Tu as terminé « ${this.lecon.titre} ».`;
      return this.publier(this.retour({ verdict: "etape_reussie", afficher: fin, dire: fin }));
    }
    this.changerEtape(this.index + 1);
    const annonce = this.annonceEtape();
    return this.publier(
      this.retour({ verdict: "etape_reussie", afficher: annonce, dire: this.aDire(`${bravo} ${annonce}`) }),
    );
  }

  // --- Vérification d'une tentative (à la demande, avant « suivant », automatique) ------

  /**
   * Fait juger par l'IA la dernière tentative : 8 images réparties sur la durée de l'étape chez
   * le maître. Renvoie null quand rien n'a été jugé ou quand, avant « suivant », rien n'empêche
   * de passer (l'appelant passe alors à l'étape suivante).
   */
  private async verifier(declencheur: "demande" | "suivant" | "auto"): Promise<Retour | null> {
    if (this.termine) return null;
    if (this.analyseEnCours) return declencheur === "demande" ? this.sansNouveaute() : null;
    const fps = this.imagesParSecondeMemoire;
    if (this.images.length < SECONDES_MIN_POUR_VERIFIER * fps && !this.direct) {
      if (declencheur !== "demande") return null;
      const message = "Je n'ai pas encore vu ton geste. Fais-le devant toi, puis redis « vérifie ».";
      return this.publier(this.retour({ afficher: message, dire: message }));
    }

    this.analyseEnCours = true;
    const indexAuDepart = this.index;
    const etape = this.etape;
    try {
      if (declencheur !== "auto") {
        const attente = declencheur === "demande" ? "Je regarde ton geste…" : "Je regarde ton geste avant de passer…";
        this.publier(this.retour({ afficher: attente, dire: declencheur === "demande" ? "Je regarde." : null, regarde: true }));
      }
      // En direct, les dernières secondes du geste sont encore en route.
      if (this.direct && declencheur !== "auto") await this.attendre(RETARD_DIRECT_MS);
      if (this.index !== indexAuDepart || this.termine) return null;

      const recentes = this.images.slice(-fenetreEtape(etape) * fps);
      if (recentes.length < SECONDES_MIN_POUR_VERIFIER * fps) {
        if (declencheur !== "demande") return null;
        const message = "Je n'ai pas encore vu ton geste. Fais-le devant toi, puis redis « vérifie ».";
        return this.publier(this.retour({ afficher: message, dire: message }));
      }
      const debut = this.maintenant();
      // La zone des mains est repérée sur 16 images de la tentative ; 4 paires d'images
      // rapprochées et datées partent à l'IA.
      const choix = pairesRapprochees(recentes.length);
      const sequence = await this.preparer(choix.map((i) => recentes[i]), echantillonner(recentes, 16));
      const instants = choix.map((i) => i / fps);
      let verdict: Verdict;
      try {
        verdict = await this.appelerIA(sequence, (recentes.length - 1) / fps, true, instants);
      } catch (erreur) {
        const message = erreur instanceof Error ? erreur.message : String(erreur);
        console.error(`Session ${this.id} : vérification impossible —`, message);
        if (declencheur === "suivant") return null;
        const dire = declencheur === "demande" ? "Je n'arrive pas à vérifier pour le moment." : null;
        return this.publier(this.retour({ afficher: `IA indisponible : ${message}`, dire }));
      }
      if (this.index !== indexAuDepart || this.termine) return null;

      this.derniereVerification = this.maintenant();
      this.detecteur.reinitialiser();
      const retour = this.appliquerVerification(verdict, declencheur);
      this.journaliser(declencheur, etape, debut, verdict, sequence, retour);
      return retour;
    } finally {
      this.analyseEnCours = false;
    }
  }

  private appliquerVerification(verdict: Verdict, declencheur: "demande" | "suivant" | "auto"): Retour | null {
    if (verdict.verdict === "etape_reussie") return this.etapeReussie(verdict.message || "Bravo !");
    if (verdict.verdict === "correction" && verdict.message) {
      this.conseils = [...this.conseils, verdict.message].slice(-CONSEILS_EN_MEMOIRE);
      if (declencheur === "suivant") {
        this.correctionAvantSuivant = true;
        const texte = `Avant de passer : ${verdict.message} Redis « suivant » pour passer quand même.`;
        return this.publier(this.retour({ verdict: "correction", afficher: texte, dire: texte }));
      }
      const dire = declencheur === "demande" ? verdict.message : this.aDire(verdict.message);
      return this.publier(this.retour({ verdict: "correction", afficher: verdict.message, dire }));
    }
    // Rien de faux (ou rien de visible) avant « suivant » : on laisse passer.
    if (declencheur === "suivant") return null;
    if (declencheur === "auto") return this.appliquerVerdict(verdict);
    // L'apprenti a demandé : il a toujours une réponse.
    if (verdict.verdict === "pas_visible") {
      const message = verdict.message || "Je ne vois pas bien, regarde ton plan de travail.";
      this.dernierPasVisible = this.maintenant();
      return this.publier(this.retour({ verdict: "pas_visible", afficher: message, dire: message }));
    }
    const message = verdict.message || "Je ne vois rien de faux. Continue, et redis « vérifie » quand tu as fini.";
    const valides = verdict.pointsValides.length ? `\n✓ ${verdict.pointsValides.join("\n✓ ")}` : "";
    return this.publier(this.retour({ verdict: "en_cours", afficher: message + valides, dire: message }));
  }

  // --- Direct (vidéo continue des lunettes Mentra) ----------------------------------

  /** Ouvre un point de réception vidéo en direct pour cette session. */
  ouvrirDirect(): ReceptionDirect {
    this.direct ??= new ReceptionDirect({
      surImage: (image) => this.imageDirect(image),
      imagesParSeconde: this.imagesParSecondeMemoire,
    });
    return this.direct;
  }

  async fermerDirect(): Promise<void> {
    const direct = this.direct;
    this.direct = null;
    await direct?.arreter();
  }

  private imageDirect(image: Buffer): void {
    if (this.termine) return;
    this.memoriser([image]);
    const fps = this.imagesParSecondeMemoire;
    if (this.analyse === "continu") {
      this.nouvellesImages++;
      if (!this.analyseEnCours && this.nouvellesImages >= SECONDES_NOUVELLES_AVANT_ANALYSE * fps) {
        this.nouvellesImages = 0;
        // Les abonnés (lunettes, tablette) reçoivent le retour par le flux d'événements.
        void this.analyserContinu();
      }
      return;
    }
    if (!this.lecon.verificationAuto) return;
    // Détection de mouvement par paquets d'une seconde.
    this.lotDirect.push(image);
    if (this.lotDirect.length >= fps) {
      const lot = this.lotDirect;
      this.lotDirect = [];
      void this.detecterFinDeGeste(lot);
    }
  }

  // --- Commandes (voix, boutons) ---------------------------------------------------

  async commande(commande: Commande): Promise<Retour> {
    switch (commande) {
      case "verifier":
        return (await this.verifier("demande")) ?? this.dernierRetour;
      case "expliquer": {
        const texte = this.texteExplication();
        return this.publier(this.retour({ afficher: texte, dire: texte }));
      }
      case "suivant": {
        // Avant de passer, l'IA regarde la dernière tentative (sauf après une correction déjà
        // donnée : l'apprenti a choisi de passer quand même).
        if (!this.termine && this.analyse === "demande" && !this.correctionAvantSuivant) {
          const verifie = await this.verifier("suivant");
          if (verifie) return verifie;
        }
        if (this.index < this.lecon.etapes.length - 1) {
          this.noter("etape_passee");
          this.changerEtape(this.index + 1);
        }
        break;
      }
      case "precedent":
        if (this.index > 0) this.changerEtape(this.index - 1);
        break;
      case "recommencer":
        this.termine = false;
        this.changerEtape(0);
        break;
      case "repeter":
        this.dernierDit = null;
        break;
    }
    const annonce = this.annonceEtape();
    return this.publier(this.retour({ afficher: annonce, dire: annonce }));
  }
}

// ---------------------------------------------------------------------------
// Registre des sessions en cours (en mémoire : le prototype tourne sur un seul serveur)
// ---------------------------------------------------------------------------

const sessions = new Map<string, SessionApprenti>();

function oublierSessionsInactives(): void {
  const limite = Date.now() - DUREE_VIE_SESSION_MS;
  for (const [id, session] of sessions) {
    if (session.derniereActivite < limite) {
      void session.fermerDirect();
      sessions.delete(id);
    }
  }
}

/** Démarre une séance, suivie dans le journal (pour l'évaluation par le maître). */
export function creerSession(lecon: Lecon, apprenti = ""): SessionApprenti {
  oublierSessionsInactives();
  const session = new SessionApprenti(lecon, {
    apprenti,
    journal: (s) => journalDisque(nouvelleSeance(s.id, lecon, s.apprenti, lecon.etapes[0].id)),
  });
  sessions.set(session.id, session);
  return session;
}

export function trouverSession(id: string): SessionApprenti | undefined {
  return sessions.get(id);
}

/** Sessions d'une leçon, la plus récemment active en premier (pour que la tablette rejoigne les lunettes). */
export function sessionsDeLecon(leconId: string): SessionApprenti[] {
  oublierSessionsInactives();
  return [...sessions.values()]
    .filter((s) => s.lecon.id === leconId)
    .sort((a, b) => b.derniereActivite - a.derniereActivite);
}
