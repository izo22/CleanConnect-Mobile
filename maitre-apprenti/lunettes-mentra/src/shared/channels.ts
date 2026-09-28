/**
 * Messages échangés entre la partie « fond » (qui pilote les lunettes) et l'écran de réglages
 * de l'appli sur le téléphone. Les deux côtés importent ce fichier.
 */

export type Mode = "apprenti" | "maitre"

export interface Reglages {
  /** Adresse du cerveau, par exemple https://mon-serveur.fr */
  urlCerveau: string
  /** Clé d'accès du cerveau (vide si le serveur n'en demande pas). */
  cle: string
  mode: Mode
  /** Leçon à suivre en mode apprenti. */
  leconId: string
  /** Titre et métier de la démonstration en mode maître. */
  titreDemo: string
  metierDemo: string
}

export interface Etat {
  actif: boolean
  mode: Mode
  /** Étape en cours (mode apprenti) ou nombre d'images envoyées (mode maître). */
  etape: string
  /** Dernier message affiché ou dit. */
  message: string
  erreur: string | null
}

export const REGLAGES_PAR_DEFAUT: Reglages = {
  urlCerveau: "",
  cle: "",
  mode: "apprenti",
  leconId: "",
  titreDemo: "",
  metierDemo: "",
}

export interface Channels {
  // écran → fond
  "reglages:enregistrer": Reglages
  "demarrer": Record<string, never>
  "arreter": Record<string, never>
  "commande": {commande: "suivant" | "precedent" | "repeter" | "recommencer"}

  // fond → écran
  "etat": Etat
  "reglages": Reglages
}

declare global {
  // eslint-disable-next-line no-var
  var mentra: import("@mentra/miniapp/ui").MentraTyped<Channels>
}
