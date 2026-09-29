/**
 * Appli MentraOS « cloud » : les lunettes filment en direct (RTMP) vers le cerveau, qui analyse
 * les gestes en continu ; les corrections reviennent à l'oreille (et sur l'écran s'il y en a un).
 */

import {AppServer, type AppSession} from "@mentra/sdk"
import type {Request, Response} from "express"
import {Cerveau} from "./cerveau"
import {Controleur, type Lunettes} from "./controleur"
import {pageReglages} from "./page"
import {ecrireReglages, lireReglages, valider} from "./reglages"

function variable(nom: string): string {
  const valeur = process.env[nom]
  if (!valeur) throw new Error(`Variable d'environnement manquante : ${nom} (voir .env.example)`)
  return valeur
}

const cerveau = new Cerveau(variable("URL_CERVEAU"), process.env.CLE_CERVEAU ?? "")
/** Contrôleur de chaque utilisateur connecté (pour appliquer les réglages à chaud). */
const controleurs = new Map<string, Controleur>()

class MaitreApprenti extends AppServer {
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    const lunettes: Lunettes = {
      demarrerVideo: (rtmpUrl) =>
        session.camera.startStream({
          rtmpUrl,
          // 720p à 15 images/s : assez pour voir les mains, léger pour le Wi-Fi des lunettes.
          video: {width: 1280, height: 720, frameRate: 15, bitrate: 1_500_000},
        }),
      arreterVideo: () => session.camera.stopStream(),
      dire: (texte) => void session.audio.speak(texte, {stopOtherAudio: true}).catch(() => undefined),
      // Sans écran (Mentra Live), l'affichage est simplement ignoré.
      afficher: (titre, texte) => session.layouts.showDoubleTextWall(titre, texte),
    }
    const controleur = new Controleur(lunettes, cerveau, await lireReglages(userId), (m) =>
      session.logger.info(m),
    )
    controleurs.get(userId)?.arreter()
    controleurs.set(userId, controleur)

    session.events.onTranscriptionForLanguage("fr-FR", (donnees) => {
      if (donnees.isFinal) void controleur.entendu(donnees.text)
    })
    session.events.onButtonPress(({pressType}) => {
      void (pressType === "long" ? controleur.boutonLong() : controleur.boutonCourt())
    })
    session.camera.onStreamStatus((statut) => session.logger.info(`Vidéo : ${JSON.stringify(statut)}`))

    lunettes.dire("Maître et Apprenti est prêt. Appuie sur le bouton pour commencer.")
  }

  protected async onStop(_sessionId: string, userId: string, _raison: string): Promise<void> {
    await controleurs.get(userId)?.arreter()
    controleurs.delete(userId)
  }
}

const app = new MaitreApprenti({
  packageName: variable("PACKAGE_NAME"),
  apiKey: variable("MENTRAOS_API_KEY"),
  port: Number(process.env.PORT ?? 3000),
})

// Page de réglages ouverte depuis l'appli Mentra (l'utilisateur est identifié par le SDK).
type RequeteAuthentifiee = Request & {authUserId?: string}
const web = app.getExpressApp()
web.get("/webview", async (req: RequeteAuthentifiee, res: Response) => {
  if (!req.authUserId) return void res.status(401).send("Ouvre cette page depuis l'appli Mentra.")
  let lecons: Awaited<ReturnType<Cerveau["lecons"]>> = []
  let erreur: string | null = null
  try {
    lecons = await cerveau.lecons()
  } catch (e) {
    erreur = `Cerveau injoignable : ${e instanceof Error ? e.message : e}`
  }
  res.type("html").send(pageReglages(await lireReglages(req.authUserId), lecons, erreur))
})
web.post("/webview/reglages", async (req: RequeteAuthentifiee, res: Response) => {
  if (!req.authUserId) return void res.status(401).json({erreur: "non connecté"})
  const reglages = valider(req.body)
  await ecrireReglages(req.authUserId, reglages)
  await controleurs.get(req.authUserId)?.changerReglages(reglages)
  res.json({ok: true})
})

await app.start()
console.log(`Appli Mentra prête sur le port ${process.env.PORT ?? 3000}`)
