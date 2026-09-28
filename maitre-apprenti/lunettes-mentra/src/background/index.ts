/**
 * Point d'entrée « fond » de l'appli : branche le contrôleur sur les lunettes Mentra
 * (caméra, haut-parleur, écran s'il y en a un, micro, bouton) et sur l'écran de réglages.
 */

import {registerMiniapp} from "@mentra/miniapp/background"
import {REGLAGES_PAR_DEFAUT, type Channels, type Reglages} from "../shared/channels"
import {Controleur, type Lunettes} from "./controleur"

const CLE_REGLAGES = "reglages"

registerMiniapp<Channels>(async (session) => {
  const brut = await session.storage.get(CLE_REGLAGES)
  let reglages: Reglages = {...REGLAGES_PAR_DEFAUT, ...(brut ? (JSON.parse(brut) as Partial<Reglages>) : {})}

  const lunettes: Lunettes = {
    async prendrePhoto() {
      if (session.capabilities?.hasCamera === false) {
        throw new Error("Ces lunettes n'ont pas de caméra")
      }
      // Taille moyenne et compression : assez pour voir le geste, léger à envoyer.
      const photo = await session.camera.takePhoto({size: "medium", compress: "medium", sound: false})
      return photo.photoUrl
    },
    dire(texte) {
      // Une nouvelle correction coupe la précédente plutôt que de s'empiler.
      void session.speaker.speak(texte, {stopOtherAudio: true}).catch(() => undefined)
    },
    afficher(titre, texte) {
      const ecran = session.capabilities?.display
      if (!ecran) return // Mentra Live : pas d'écran, tout passe par la voix.
      const largeur = ecran.width ?? 576
      const hauteur = ecran.height ?? 288
      void session.display.render([
        {type: "text", id: "titre", box: {x: 0, y: 0, w: largeur, h: Math.round(hauteur * 0.25)}, text: titre},
        {
          type: "text",
          id: "texte",
          box: {x: 0, y: Math.round(hauteur * 0.28), w: largeur, h: Math.round(hauteur * 0.72)},
          text: texte,
        },
      ])
    },
  }

  const controleur = new Controleur(lunettes, reglages, (etat) => session.ui.send("etat", etat))

  // Voix : commandes de l'apprenti, ou explications et commandes du maître.
  session.transcription.configure({languageHints: ["fr"]})
  session.transcription.forLanguage("fr-FR", (donnees) => {
    if (donnees.isFinal) void controleur.entendu(donnees.text)
  })

  // Bouton des lunettes.
  session.input.onButtonPress(({pressType}) => {
    void (pressType === "long" ? controleur.boutonLong() : controleur.boutonCourt())
  })

  // Écran de réglages sur le téléphone.
  session.ui.onOpen(() => {
    session.ui.send("reglages", reglages)
    session.ui.send("etat", controleur.etatActuel)
  })
  session.ui.on("reglages:enregistrer", async (nouveaux) => {
    reglages = nouveaux
    await session.storage.set(CLE_REGLAGES, JSON.stringify(reglages))
    controleur.changerReglages(reglages)
    session.ui.send("reglages", reglages)
  })
  session.ui.on("demarrer", () => void controleur.demarrer())
  session.ui.on("arreter", () => controleur.arreter())
  session.ui.on("commande", ({commande}) => void controleur.commande(commande))
})
