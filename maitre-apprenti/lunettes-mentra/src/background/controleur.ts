/**
 * Logique des lunettes, indépendante du SDK Mentra (pour pouvoir la tester) :
 * - mode apprenti : photo toutes les quelques secondes → le cerveau juge → correction à l'oreille ;
 * - mode maître : photos + voix du maître envoyées au cerveau, qui en fait une leçon.
 */

import type {Etat, Reglages} from "../shared/channels"

/** Délai entre deux photos. L'IA met 2 à 5 s à répondre : inutile d'aller plus vite. */
export const INTERVALLE_PHOTO_MS = 4000

/** Ce que le contrôleur attend des lunettes (branché sur le SDK Mentra dans index.ts). */
export interface Lunettes {
  /** Prend une photo et renvoie son adresse https. */
  prendrePhoto(): Promise<string>
  dire(texte: string): void
  afficher(titre: string, texte: string): void
}

/** Réponse du cerveau (voir cerveau/src/types.ts, type Retour). */
interface Retour {
  sessionId: string
  termine: boolean
  etape: {index: number; total: number; titre: string}
  afficher: string
  dire: string | null
  ignore: boolean
}

type CommandeApprenti = "suivant" | "precedent" | "repeter" | "recommencer"

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
export function commandeApprenti(texte: string): CommandeApprenti | "pause" | null {
  const t = normaliser(texte)
  if (!t || t.split(" ").length > 4) return null
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
  private etat: Etat
  /** Incrémenté à chaque démarrage/arrêt : une boucle d'une ancienne génération s'arrête d'elle-même. */
  private generation = 0
  private sessionId: string | null = null
  private sessionLeconId = ""
  private captureId: string | null = null
  private imagesEnvoyees = 0
  private derniereErreurDite = ""

  constructor(
    private readonly lunettes: Lunettes,
    reglages: Reglages,
    private readonly notifier: (etat: Etat) => void,
    private readonly requete: typeof fetch = fetch,
    private readonly attendre: (ms: number) => Promise<void> = (ms) => new Promise((ok) => setTimeout(ok, ms)),
  ) {
    this.reglages = reglages
    this.etat = {actif: false, mode: reglages.mode, etape: "", message: "Prêt", erreur: null}
  }

  get etatActuel(): Etat {
    return this.etat
  }

  get actif(): boolean {
    return this.etat.actif
  }

  changerReglages(reglages: Reglages): void {
    if (this.etat.actif) this.arreter()
    this.reglages = reglages
    this.maj({mode: reglages.mode, message: "Réglages enregistrés", erreur: null})
  }

  private maj(partiel: Partial<Etat>): void {
    this.etat = {...this.etat, ...partiel}
    this.notifier(this.etat)
  }

  /** Appel à l'API du cerveau : POST avec un corps JSON, ou GET si `corps` est absent. */
  private async appel<T>(chemin: string, corps?: unknown): Promise<T> {
    const base = this.reglages.urlCerveau.replace(/\/+$/, "")
    const reponse = await this.requete(`${base}/api${chemin}`, {
      method: corps === undefined ? "GET" : "POST",
      headers: {"content-type": "application/json", "x-cle": this.reglages.cle},
      body: corps === undefined ? undefined : JSON.stringify(corps),
    })
    const donnees = (await reponse.json().catch(() => ({}))) as T & {erreur?: string}
    if (!reponse.ok) throw new Error(donnees.erreur ?? `Erreur ${reponse.status} du cerveau`)
    return donnees
  }

  private signalerErreur(erreur: unknown): void {
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    this.maj({erreur: message})
    this.lunettes.afficher("Problème", message)
    // On ne répète pas la même erreur à l'oreille toutes les 4 secondes.
    if (message !== this.derniereErreurDite) {
      this.derniereErreurDite = message
      this.lunettes.dire("Je n'arrive pas à joindre le cerveau.")
    }
  }

  // --- Démarrage / arrêt ---------------------------------------------------------

  async demarrer(): Promise<void> {
    if (this.etat.actif) return
    if (!this.reglages.urlCerveau) {
      this.maj({erreur: "Indique l'adresse du cerveau dans les réglages"})
      return
    }
    const generation = ++this.generation
    this.imagesEnvoyees = 0
    this.derniereErreurDite = ""
    this.maj({actif: true, erreur: null, message: "Démarrage…", etape: ""})
    try {
      if (this.reglages.mode === "apprenti") await this.demarrerApprenti()
      else await this.demarrerMaitre()
    } catch (erreur) {
      this.signalerErreur(erreur)
      this.arreter()
      return
    }
    void this.boucle(generation)
  }

  arreter(): void {
    this.generation++
    this.maj({actif: false, message: "En pause"})
  }

  private async boucle(generation: number): Promise<void> {
    while (generation === this.generation) {
      const debut = Date.now()
      try {
        if (this.reglages.mode === "apprenti") await this.tourApprenti()
        else await this.tourMaitre()
        if (generation === this.generation && this.etat.erreur) this.maj({erreur: null})
      } catch (erreur) {
        if (generation === this.generation) this.signalerErreur(erreur)
      }
      await this.attendre(Math.max(500, INTERVALLE_PHOTO_MS - (Date.now() - debut)))
    }
  }

  // --- Mode apprenti -------------------------------------------------------------

  private async demarrerApprenti(): Promise<void> {
    if (!this.reglages.leconId) throw new Error("Choisis une leçon dans les réglages")
    // Après une pause, on reprend là où l'apprenti en était (si la session existe encore).
    if (this.sessionId && this.sessionLeconId === this.reglages.leconId) {
      try {
        const retour = await this.appel<Retour>(`/sessions/${this.sessionId}`)
        if (!retour.termine) {
          this.appliquer({...retour, dire: `On reprend. ${retour.etape.titre}.`})
          return
        }
      } catch {
        // Session expirée : on en ouvre une nouvelle ci-dessous.
      }
    }
    const retour = await this.appel<Retour>("/sessions", {leconId: this.reglages.leconId})
    this.sessionId = retour.sessionId
    this.sessionLeconId = this.reglages.leconId
    this.appliquer(retour)
  }

  private async tourApprenti(): Promise<void> {
    if (!this.sessionId) return
    const photo = await this.lunettes.prendrePhoto()
    const retour = await this.appel<Retour>(`/sessions/${this.sessionId}/image`, {imageUrl: photo})
    this.appliquer(retour)
    if (retour.termine) this.arreter()
  }

  private appliquer(retour: Retour): void {
    if (retour.ignore) return
    const etape = retour.termine
      ? "Leçon terminée"
      : `Étape ${retour.etape.index + 1}/${retour.etape.total} : ${retour.etape.titre}`
    this.lunettes.afficher(etape, retour.afficher)
    if (retour.dire) this.lunettes.dire(retour.dire)
    this.maj({etape, message: retour.afficher})
  }

  async commande(commande: CommandeApprenti): Promise<void> {
    if (this.reglages.mode !== "apprenti" || !this.sessionId) return
    try {
      this.appliquer(await this.appel<Retour>(`/sessions/${this.sessionId}/commande`, {commande}))
    } catch (erreur) {
      this.signalerErreur(erreur)
    }
  }

  // --- Mode maître -------------------------------------------------------------

  private async demarrerMaitre(): Promise<void> {
    const {captureId} = await this.appel<{captureId: string}>("/captures", {
      titre: this.reglages.titreDemo,
      metier: this.reglages.metierDemo,
    })
    this.captureId = captureId
    const consigne = "Je t'écoute. Explique tes gestes à voix haute. Dis « étape suivante » à chaque nouvelle étape, et « terminé » à la fin."
    this.lunettes.afficher("Démonstration", consigne)
    this.lunettes.dire(consigne)
    this.maj({etape: "Démonstration en cours", message: consigne})
  }

  private async tourMaitre(): Promise<void> {
    if (!this.captureId) return
    const photo = await this.lunettes.prendrePhoto()
    await this.appel(`/captures/${this.captureId}/image`, {imageUrl: photo})
    this.imagesEnvoyees++
    this.maj({etape: `Démonstration : ${this.imagesEnvoyees} images envoyées`})
  }

  async marquerEtape(): Promise<void> {
    if (!this.captureId || !this.etat.actif) return
    try {
      await this.appel(`/captures/${this.captureId}/etape`, {})
      this.lunettes.dire("Étape suivante, c'est noté.")
      this.maj({message: "Nouvelle étape marquée"})
    } catch (erreur) {
      this.signalerErreur(erreur)
    }
  }

  async terminerDemonstration(): Promise<void> {
    if (!this.captureId) return
    const captureId = this.captureId
    this.captureId = null
    this.arreter()
    try {
      await this.appel(`/captures/${captureId}/terminer`, {})
      const fin = "Merci ! La leçon est en préparation, elle sera prête dans quelques minutes."
      this.lunettes.afficher("Démonstration terminée", fin)
      this.lunettes.dire(fin)
      this.maj({etape: "Démonstration terminée", message: fin})
    } catch (erreur) {
      this.signalerErreur(erreur)
    }
  }

  async parole(texte: string): Promise<void> {
    if (!this.captureId || !this.etat.actif || !texte.trim()) return
    try {
      await this.appel(`/captures/${this.captureId}/parole`, {texte})
    } catch (erreur) {
      this.signalerErreur(erreur)
    }
  }

  // --- Entrées : voix et bouton ----------------------------------------------------

  /** Phrase entendue (transcription finale). */
  async entendu(texte: string): Promise<void> {
    if (this.reglages.mode === "maitre") {
      const commande = commandeMaitre(texte)
      if (commande === "etape") return this.marquerEtape()
      if (commande === "terminer") return this.terminerDemonstration()
      return this.parole(texte)
    }
    if (!this.etat.actif) return
    const commande = commandeApprenti(texte)
    if (commande === "pause") {
      this.arreter()
      this.lunettes.dire("Pause. Appuie sur le bouton pour reprendre.")
    } else if (commande) {
      await this.commande(commande)
    }
  }

  /** Appui court : démarrer / mettre en pause (apprenti) ou marquer une étape (maître). */
  async boutonCourt(): Promise<void> {
    if (this.reglages.mode === "maitre" && this.etat.actif) return this.marquerEtape()
    if (this.etat.actif) {
      this.arreter()
      this.lunettes.dire("Pause.")
    } else {
      await this.demarrer()
    }
  }

  /** Appui long : étape suivante (apprenti) ou fin de la démonstration (maître). */
  async boutonLong(): Promise<void> {
    if (this.reglages.mode === "maitre") return this.terminerDemonstration()
    return this.commande("suivant")
  }
}
