// Client HTTP du cerveau (voir ../../cerveau) : leçons, sessions, directs vidéo, flux d'événements.

/** Réponse du cerveau pendant une leçon (voir cerveau/src/types.ts, type Retour). */
export interface Retour {
  sessionId: string
  termine: boolean
  etape: {index: number; total: number; titre: string}
  verdict: string | null
  afficher: string
  dire: string | null
  ignore: boolean
}

export interface ResumeLecon {
  id: string
  titre: string
  metier: string
  statut: "en_preparation" | "prete" | "erreur"
}

export class Cerveau {
  private readonly base: string

  constructor(
    url: string,
    private readonly cle: string,
    private readonly requete: typeof fetch = fetch,
  ) {
    this.base = url.replace(/\/+$/, "")
  }

  private async appel<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
    const reponse = await this.requete(`${this.base}/api${chemin}`, {
      method: methode,
      headers: {"content-type": "application/json", "x-cle": this.cle},
      body: corps === undefined ? undefined : JSON.stringify(corps),
    })
    const donnees = (await reponse.json().catch(() => ({}))) as T & {erreur?: string}
    if (!reponse.ok) throw new Error(donnees.erreur ?? `Erreur ${reponse.status} du cerveau`)
    return donnees
  }

  lecons = () => this.appel<ResumeLecon[]>("GET", "/lecons")
  creerSession = (leconId: string) => this.appel<Retour>("POST", "/sessions", {leconId})
  etatSession = (id: string) => this.appel<Retour>("GET", `/sessions/${id}`)
  commande = (id: string, commande: string) => this.appel<Retour>("POST", `/sessions/${id}/commande`, {commande})
  ouvrirDirect = (id: string) => this.appel<{rtmpUrl: string}>("POST", `/sessions/${id}/direct`, {})
  fermerDirect = (id: string) => this.appel<unknown>("DELETE", `/sessions/${id}/direct`)
  creerCapture = (titre: string, metier: string) =>
    this.appel<{captureId: string}>("POST", "/captures", {titre, metier})
  directCapture = (id: string) => this.appel<{rtmpUrl: string}>("POST", `/captures/${id}/direct`, {})
  parole = (id: string, texte: string) => this.appel<unknown>("POST", `/captures/${id}/parole`, {texte})
  marquerEtape = (id: string) => this.appel<unknown>("POST", `/captures/${id}/etape`, {})
  terminerCapture = (id: string) => this.appel<unknown>("POST", `/captures/${id}/terminer`, {})

  /**
   * Suit le flux d'événements d'une session : chaque analyse du direct y arrive.
   * Renvoie une fonction pour arrêter l'écoute.
   */
  ecouter(sessionId: string, surRetour: (retour: Retour) => void, surErreur: (e: Error) => void): () => void {
    const controle = new AbortController()
    void (async () => {
      try {
        const reponse = await this.requete(`${this.base}/api/sessions/${sessionId}/evenements`, {
          headers: {"x-cle": this.cle},
          signal: controle.signal,
        })
        if (!reponse.ok || !reponse.body) throw new Error(`Flux d'événements indisponible (${reponse.status})`)
        const lecteur = reponse.body.getReader()
        const decodeur = new TextDecoder()
        let tampon = ""
        for (;;) {
          const {value, done} = await lecteur.read()
          if (done) break
          tampon += decodeur.decode(value, {stream: true})
          const lignes = tampon.split("\n")
          tampon = lignes.pop() ?? ""
          for (const ligne of lignes) {
            if (ligne.startsWith("data: ")) surRetour(JSON.parse(ligne.slice(6)) as Retour)
          }
        }
      } catch (erreur) {
        if (!controle.signal.aborted) surErreur(erreur instanceof Error ? erreur : new Error(String(erreur)))
      }
    })()
    return () => controle.abort()
  }
}
