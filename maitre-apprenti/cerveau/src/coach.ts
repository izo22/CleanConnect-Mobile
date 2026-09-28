// Session d'un apprenti : suit l'étape en cours, envoie les images à l'IA et décide quoi dire.

import { readFile } from "node:fs/promises";
import { evaluerGeste, type ImageIA } from "./ia.ts";
import { cheminMedia, nouvelId, urlMedia } from "./store.ts";
import type { Commande, Lecon, Retour, Verdict } from "./types.ts";

/** On n'envoie à l'IA que les images les plus récentes de l'apprenti (la dernière compte). */
const IMAGES_APPRENTI = 2;
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

export class SessionApprenti {
  readonly id = nouvelId();
  readonly lecon: Lecon;
  derniereActivite: number;
  private index = 0;
  private termine = false;
  private analyseEnCours = false;
  private imagesApprenti: Buffer[] = [];
  private conseils: string[] = [];
  private dernierDit: { texte: string; quand: number } | null = null;
  private dernierPasVisible = 0;
  private dernierRetour: Retour;
  private abonnes = new Set<(retour: Retour) => void>();
  private imagesMaitre = new Map<string, ImageIA[]>();
  private readonly evaluateur: Evaluateur;
  private readonly chargerImage: ChargeurImage;
  private readonly maintenant: () => number;

  constructor(
    lecon: Lecon,
    options: { evaluateur?: Evaluateur; chargerImage?: ChargeurImage; maintenant?: () => number } = {},
  ) {
    if (lecon.statut !== "prete" || lecon.etapes.length === 0) {
      throw new Error("Cette leçon n'est pas encore prête");
    }
    this.lecon = lecon;
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
    this.imagesApprenti = [];
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

  async analyserImage(image: Buffer): Promise<Retour> {
    this.derniereActivite = this.maintenant();
    if (this.termine) return this.dernierRetour;
    // Les lunettes envoient une image toutes les quelques secondes ; si l'IA n'a pas fini
    // la précédente, on ignore celle-ci plutôt que d'empiler du retard.
    if (this.analyseEnCours) return { ...this.dernierRetour, dire: null, ignore: true };

    this.imagesApprenti = [...this.imagesApprenti, image].slice(-IMAGES_APPRENTI);
    const indexAuDepart = this.index;
    this.analyseEnCours = true;
    let verdict: Verdict;
    try {
      verdict = await this.evaluateur({
        titreLecon: this.lecon.titre,
        etape: this.etape,
        totalEtapes: this.lecon.etapes.length,
        imagesMaitre: await this.referencesMaitre(),
        imagesApprenti: this.imagesApprenti.map((data) => ({ data })),
        derniersConseils: this.conseils,
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
    if (this.index === this.lecon.etapes.length - 1) {
      this.termine = true;
      const fin = `${bravo} Tu as terminé « ${this.lecon.titre} ».`;
      return this.publier(this.retour({ verdict: "etape_reussie", afficher: fin, dire: fin }));
    }
    this.changerEtape(this.index + 1);
    const annonce = this.annonceEtape();
    return this.publier(
      this.retour({ verdict: "etape_reussie", afficher: annonce, dire: this.aDire(`${bravo} ${annonce}`) }),
    );
  }

  commande(commande: Commande): Retour {
    switch (commande) {
      case "suivant":
        if (this.index < this.lecon.etapes.length - 1) this.changerEtape(this.index + 1);
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
    if (session.derniereActivite < limite) sessions.delete(id);
  }
}

export function creerSession(lecon: Lecon): SessionApprenti {
  oublierSessionsInactives();
  const session = new SessionApprenti(lecon);
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
