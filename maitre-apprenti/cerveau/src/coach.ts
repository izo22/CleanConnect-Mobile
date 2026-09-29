// Session d'un apprenti : suit l'étape en cours, envoie les séquences vidéo à l'IA et décide quoi dire.

import { readFile } from "node:fs/promises";
import { ReceptionDirect } from "./direct.ts";
import { evaluerGeste, type ImageIA } from "./ia.ts";
import { journalDisque, nouvelleSeance, type JournalSeance } from "./journal.ts";
import { cheminMedia, nouvelId, urlMedia } from "./store.ts";
import type { Commande, Lecon, Retour, TypeEvenement, Verdict } from "./types.ts";
import { cadenceValide, IMAGES_PAR_SEQUENCE } from "./video.ts";

/** En direct, on relance une analyse dès que 2 secondes nouvelles sont arrivées (et que l'IA est libre). */
const SECONDES_NOUVELLES_AVANT_ANALYSE = 2;
/** Nombre de conseils déjà donnés que l'IA garde en mémoire pendant une étape. */
const CONSEILS_EN_MEMOIRE = 4;
/** Délai avant de répéter à voix haute un message identique. */
const DELAI_REPETITION_MS = 15_000;
/** Délai entre deux rappels « je ne vois pas bien ». */
const DELAI_PAS_VISIBLE_MS = 20_000;
/** Une session sans activité pendant ce délai est oubliée. */
const DUREE_VIE_SESSION_MS = 2 * 60 * 60 * 1000;

export type Evaluateur = (options: Parameters<typeof evaluerGeste>[0]) => Promise<Verdict>;
export type ChargeurImage = (leconId: string, fichier: string) => Promise<Buffer>;

async function chargerImageDisque(leconId: string, fichier: string): Promise<Buffer> {
  const chemin = cheminMedia(leconId, "images", fichier);
  if (!chemin) throw new Error(`Image de référence invalide : ${fichier}`);
  return readFile(chemin);
}

/** Journal qui n'enregistre rien (tests, ou séance sans suivi). */
const SANS_JOURNAL: JournalSeance = { evenement: () => {}, intervention: () => {} };

export class SessionApprenti {
  readonly id = nouvelId();
  lecon: Lecon;
  readonly apprenti: string;
  derniereActivite: number;
  private index = 0;
  private termine = false;
  private analyseEnCours = false;
  private direct: ReceptionDirect | null = null;
  private imagesDirect: Buffer[] = [];
  private nouvellesImages = 0;
  private conseils: string[] = [];
  private dernierDit: { texte: string; quand: number } | null = null;
  private dernierPasVisible = 0;
  private dernierRetour: Retour;
  private abonnes = new Set<(retour: Retour) => void>();
  private imagesMaitre = new Map<string, ImageIA[]>();
  private readonly evaluateur: Evaluateur;
  private readonly chargerImage: ChargeurImage;
  private readonly maintenant: () => number;
  private readonly journal: JournalSeance;

  constructor(
    lecon: Lecon,
    options: {
      evaluateur?: Evaluateur;
      chargerImage?: ChargeurImage;
      maintenant?: () => number;
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
    this.maintenant = options.maintenant ?? Date.now;
    this.derniereActivite = this.maintenant();
    this.dernierRetour = this.retour({ afficher: this.annonceEtape(), dire: this.annonceEtape() });
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

  /** Règles du maître qui s'appliquent à l'étape en cours (celles de l'étape et celles de toute la leçon). */
  private reglesEtape(): string[] {
    return (this.lecon.regles ?? []).filter((r) => r.etapeId === null || r.etapeId === this.etape.id).map((r) => r.texte);
  }

  /** Prend en compte une leçon modifiée (nouvelle règle du maître, cadence) sans interrompre la séance. */
  majLecon(lecon: Lecon): void {
    if (lecon.id !== this.lecon.id || lecon.etapes.length !== this.lecon.etapes.length) return;
    this.lecon = lecon;
  }

  private noter(type: TypeEvenement): void {
    this.journal.evenement(type, this.etape.id);
  }

  private annonceEtape(): string {
    return `Étape ${this.etape.numero} : ${this.etape.titre}. ${this.etape.consigne}`;
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

  abonner(abonne: (retour: Retour) => void): () => void {
    this.abonnes.add(abonne);
    return () => this.abonnes.delete(abonne);
  }

  private changerEtape(index: number): void {
    this.index = index;
    this.noter("etape");
    this.imagesDirect = [];
    this.nouvellesImages = 0;
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

  /**
   * Analyse une séquence vidéo de l'apprenti (images successives, 2 par seconde, de la plus
   * ancienne à la plus récente) et décide quoi lui dire.
   */
  async analyserSequence(images: Buffer[]): Promise<Retour> {
    this.derniereActivite = this.maintenant();
    if (this.termine || images.length === 0) return this.dernierRetour;
    // La vidéo arrive en continu ; si l'IA n'a pas fini la séquence précédente, on ignore
    // celle-ci plutôt que d'empiler du retard.
    if (this.analyseEnCours) return { ...this.dernierRetour, dire: null, ignore: true };

    const sequence = images.slice(-IMAGES_PAR_SEQUENCE);
    const indexAuDepart = this.index;
    const etapeAuDepart = this.etape;
    this.analyseEnCours = true;
    let verdict: Verdict;
    const debut = this.maintenant();
    try {
      verdict = await this.evaluateur({
        titreLecon: this.lecon.titre,
        etape: this.etape,
        totalEtapes: this.lecon.etapes.length,
        imagesMaitre: await this.referencesMaitre(),
        imagesApprenti: sequence.map((data) => ({ data })),
        derniersConseils: this.conseils,
        regles: this.reglesEtape(),
        imagesParSeconde: this.imagesParSeconde,
      });
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
    // Chaque analyse est gardée, silences compris, pour que le maître puisse la juger.
    this.journal.intervention(
      {
        etapeId: etapeAuDepart.id,
        etapeNumero: etapeAuDepart.numero,
        t: new Date(debut).toISOString(),
        verdict: verdict.verdict,
        message: verdict.message,
        dit: retour.dire !== null && verdict.verdict !== "en_cours",
        pointsValides: verdict.pointsValides,
        latenceMs: this.maintenant() - debut,
        usage: verdict.usage ?? null,
      },
      sequence,
    );
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

  // --- Direct (vidéo continue des lunettes Mentra) ----------------------------------

  /** Ouvre un point de réception vidéo en direct pour cette session. */
  ouvrirDirect(): ReceptionDirect {
    this.direct ??= new ReceptionDirect({
      surImage: (image) => this.imageDirect(image),
      imagesParSeconde: this.imagesParSeconde,
    });
    return this.direct;
  }

  async fermerDirect(): Promise<void> {
    const direct = this.direct;
    this.direct = null;
    await direct?.arreter();
  }

  private imageDirect(image: Buffer): void {
    this.derniereActivite = this.maintenant();
    this.imagesDirect = [...this.imagesDirect, image].slice(-IMAGES_PAR_SEQUENCE);
    this.nouvellesImages++;
    if (!this.analyseEnCours && this.nouvellesImages >= SECONDES_NOUVELLES_AVANT_ANALYSE * this.imagesParSeconde) {
      this.nouvellesImages = 0;
      // Les abonnés (lunettes, tablette) reçoivent le retour par le flux d'événements.
      void this.analyserSequence(this.imagesDirect);
    }
  }

  commande(commande: Commande): Retour {
    switch (commande) {
      case "suivant":
        if (this.index < this.lecon.etapes.length - 1) {
          this.noter("etape_passee");
          this.changerEtape(this.index + 1);
        }
        break;
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
