/**
 * Logique des lunettes, indépendante du SDK Mentra (pour pouvoir la tester) :
 * - mode apprenti : les lunettes filment en direct vers le cerveau, qui garde les dernières
 *   secondes ; l'IA juge le geste quand l'apprenti dit « vérifie » (ou appuie sur le bouton),
 *   quand il dit « suivant », ou en continu sur les étapes à surveiller. Les corrections sont
 *   dites à l'oreille ;
 * - mode maître : la démonstration est filmée en direct et enregistrée, avec la voix du maître,
 *   puis le cerveau en fait une leçon.
 */

import type {Cerveau, Retour} from "./cerveau"

export type Mode = "apprenti" | "maitre"

export interface Reglages {
  mode: Mode
  /** Leçon à suivre en mode apprenti (vide : la plus récente). */
  leconId: string
  /** Prénom de l'apprenti, pour que le maître suive ses séances. */
  apprenti: string
  /** Titre et métier de la démonstration en mode maître. */
  titreDemo: string
  metierDemo: string
}

export const REGLAGES_PAR_DEFAUT: Reglages = {mode: "apprenti", leconId: "", apprenti: "", titreDemo: "", metierDemo: ""}

/** Ce que le contrôleur attend des lunettes (branché sur le SDK Mentra dans index.ts). */
export interface Lunettes {
  /** Démarre la vidéo en direct vers cette adresse RTMP. */
  demarrerVideo(rtmpUrl: string): Promise<void>
  arreterVideo(): Promise<void>
  dire(texte: string): void
  afficher(titre: string, texte: string): void
}

type Commande = "suivant" | "precedent" | "repeter" | "recommencer" | "verifier" | "expliquer"

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Reconnaît une commande vocale courte de l'apprenti. Les phrases longues sont ignorées. */
export function commandeApprenti(texte: string): Commande | "pause" | null {
  const t = normaliser(texte)
  if (!t || t.split(" ").length > 4) return null
  if (/\b(verifie|verifier|verif|regarde|check)\b|c'est bon/.test(t)) return "verifier"
  if (/\b(explique|expliquer|explication|details|comment)\b/.test(t)) return "expliquer"
  if (/\b(suivant|suivante)\b/.test(t)) return "suivant"
  if (/\b(precedent|precedente|retour)\b/.test(t)) return "precedent"
  if (/\b(repete|repeter|redis|redire)\b/.test(t)) return "repeter"
  if (/\b(recommence|recommencer)\b/.test(t)) return "recommencer"
  if (/\b(pause|stop|arrete)\b/.test(t)) return "pause"
  return null
}

/** Reconnaît les commandes vocales du maître pendant sa démonstration. */
export function commandeMaitre(texte: string): "etape" | "terminer" | null {
  const t = normaliser(texte)
  if (!t || t.split(" ").length > 5) return null
  if (/\b(etape suivante|nouvelle etape|suivant)\b/.test(t)) return "etape"
  if (/\b(termine|terminee|fini|finie|fin de la demo|fin de la demonstration)\b/.test(t)) return "terminer"
  return null
}

export class Controleur {
  private reglages: Reglages
  actif = false
  private sessionId: string | null = null
  private sessionLeconId = ""
  private captureId: string | null = null
  private arreterEcoute: (() => void) | null = null
  private dernierDit = ""

  constructor(
    private readonly lunettes: Lunettes,
    private readonly cerveau: Cerveau,
    reglages: Reglages,
    private readonly journal: (message: string) => void = console.log,
  ) {
    this.reglages = reglages
  }

  async changerReglages(reglages: Reglages): Promise<void> {
    if (this.actif) await this.arreter()
    this.reglages = reglages
    this.lunettes.dire(reglages.mode === "maitre" ? "Mode maître prêt." : "Leçon choisie. Appuie sur le bouton pour commencer.")
  }

  private erreur(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e)
    this.journal(`Erreur : ${message}`)
    this.lunettes.afficher("Problème", message)
    this.lunettes.dire("Je n'arrive pas à joindre le cerveau.")
  }

  // --- Démarrage / arrêt ---------------------------------------------------------

  async demarrer(): Promise<void> {
    if (this.actif) return
    this.actif = true
    try {
      if (this.reglages.mode === "apprenti") await this.demarrerApprenti()
      else await this.demarrerMaitre()
    } catch (e) {
      this.actif = false
      this.erreur(e)
    }
  }

  /** Pause (apprenti). En mode maître, la démonstration se termine avec « terminé ». */
  async arreter(): Promise<void> {
    if (!this.actif) return
    this.actif = false
    this.arreterEcoute?.()
    this.arreterEcoute = null
    await this.lunettes.arreterVideo().catch(() => undefined)
    if (this.sessionId) await this.cerveau.fermerDirect(this.sessionId).catch(() => undefined)
  }

  // --- Mode apprenti -------------------------------------------------------------

  private async choisirLecon(): Promise<string> {
    if (this.reglages.leconId) return this.reglages.leconId
    const pretes = (await this.cerveau.lecons()).filter((l) => l.statut === "prete")
    if (pretes.length === 0) throw new Error("Aucune leçon prête sur le cerveau")
    return pretes[0].id // la plus récente
  }

  private async demarrerApprenti(): Promise<void> {
    const leconId = await this.choisirLecon()
    let retour: Retour | null = null
    // Après une pause, on reprend là où l'apprenti en était (si la session existe encore).
    if (this.sessionId && this.sessionLeconId === leconId) {
      retour = await this.cerveau.etatSession(this.sessionId).catch(() => null)
      if (retour?.termine) retour = null
      if (retour) retour = {...retour, dire: `On reprend. ${retour.etape.titre}.`}
    }
    if (!retour) {
      retour = await this.cerveau.creerSession(leconId, this.reglages.apprenti)
      this.sessionId = retour.sessionId
      this.sessionLeconId = leconId
    }
    this.appliquer(retour)
    const sessionId = retour.sessionId
    this.arreterEcoute = this.cerveau.ecouter(
      sessionId,
      (r) => {
        this.appliquer(r)
        if (r.termine) void this.arreter()
      },
      (e) => this.erreur(e),
    )
    const {rtmpUrl} = await this.cerveau.ouvrirDirect(sessionId)
    await this.lunettes.demarrerVideo(rtmpUrl)
  }

  private appliquer(retour: Retour): void {
    if (retour.ignore) return
    const titre = retour.termine
      ? "Leçon terminée"
      : `Étape ${retour.etape.index + 1}/${retour.etape.total} : ${retour.etape.titre}`
    this.lunettes.afficher(titre, retour.afficher)
    // Le flux d'événements renvoie aussi l'état courant à la connexion : on ne redit pas la même phrase.
    if (retour.dire && retour.dire !== this.dernierDit) {
      this.dernierDit = retour.dire
      this.lunettes.dire(retour.dire)
    }
  }

  async commande(commande: Commande): Promise<void> {
    if (this.reglages.mode !== "apprenti" || !this.sessionId) return
    try {
      this.dernierDit = ""
      this.appliquer(await this.cerveau.commande(this.sessionId, commande))
    } catch (e) {
      this.erreur(e)
    }
  }

  // --- Mode maître -------------------------------------------------------------

  private async demarrerMaitre(): Promise<void> {
    const {captureId} = await this.cerveau.creerCapture(this.reglages.titreDemo, this.reglages.metierDemo)
    this.captureId = captureId
    const {rtmpUrl} = await this.cerveau.directCapture(captureId)
    await this.lunettes.demarrerVideo(rtmpUrl)
    const consigne =
      "Je filme. Explique tes gestes à voix haute. Dis « étape suivante » à chaque nouvelle étape, et « terminé » à la fin."
    this.lunettes.afficher("Démonstration", consigne)
    this.lunettes.dire(consigne)
  }

  async marquerEtape(): Promise<void> {
    if (!this.captureId || !this.actif) return
    try {
      await this.cerveau.marquerEtape(this.captureId)
      this.lunettes.dire("Étape suivante, c'est noté.")
    } catch (e) {
      this.erreur(e)
    }
  }

  async terminerDemonstration(): Promise<void> {
    const captureId = this.captureId
    if (!captureId) return
    this.captureId = null
    this.actif = false
    await this.lunettes.arreterVideo().catch(() => undefined)
    try {
      await this.cerveau.terminerCapture(captureId)
      const fin = "Merci ! La leçon est en préparation, elle sera prête dans quelques minutes."
      this.lunettes.afficher("Démonstration terminée", fin)
      this.lunettes.dire(fin)
    } catch (e) {
      this.erreur(e)
    }
  }

  // --- Entrées : voix et bouton ----------------------------------------------------

  /** Phrase entendue (transcription finale). */
  async entendu(texte: string): Promise<void> {
    if (this.reglages.mode === "maitre") {
      const commande = commandeMaitre(texte)
      if (commande === "etape") return this.marquerEtape()
      if (commande === "terminer") return this.terminerDemonstration()
      if (this.captureId && this.actif && texte.trim()) {
        await this.cerveau.parole(this.captureId, texte.trim()).catch((e) => this.erreur(e))
      }
      return
    }
    if (!this.actif) return
    const commande = commandeApprenti(texte)
    if (commande === "pause") {
      await this.arreter()
      this.lunettes.dire("Pause. Appuie sur le bouton pour reprendre.")
    } else if (commande) {
      await this.commande(commande)
    }
  }

  /** Appui court : démarrer, puis « vérifie mon geste » (apprenti) ; marquer une étape (maître). */
  async boutonCourt(): Promise<void> {
    if (this.reglages.mode === "maitre" && this.actif) return this.marquerEtape()
    if (this.actif) return this.commande("verifier")
    await this.demarrer()
  }

  /** Appui long : étape suivante (apprenti) ou fin de la démonstration (maître). */
  async boutonLong(): Promise<void> {
    if (this.reglages.mode === "maitre") return this.terminerDemonstration()
    return this.commande("suivant")
  }
}
