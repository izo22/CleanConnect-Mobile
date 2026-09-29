import {afterAll, beforeAll, describe, expect, test} from "bun:test"
import {spawn, type ChildProcess} from "node:child_process"
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import path from "node:path"
import {Cerveau} from "../src/cerveau"
import {commandeApprenti, commandeMaitre, Controleur, REGLAGES_PAR_DEFAUT, type Lunettes} from "../src/controleur"

function fausseLunettes() {
  const dit: string[] = []
  const affiche: string[] = []
  const videos: string[] = []
  let arrets = 0
  const lunettes: Lunettes = {
    demarrerVideo: async (url) => void videos.push(url),
    arreterVideo: async () => void arrets++,
    dire: (t) => void dit.push(t),
    afficher: (titre, texte) => void affiche.push(`${titre} | ${texte}`),
  }
  return {lunettes, dit, affiche, videos, arrets: () => arrets}
}

const retour = (index: number, partiel: Record<string, unknown> = {}) => ({
  sessionId: "s1",
  termine: false,
  etape: {index, total: 3, titre: `Titre ${index + 1}`},
  verdict: null,
  afficher: `Consigne ${index + 1}`,
  dire: null,
  ignore: false,
  ...partiel,
})

/** Faux cerveau : routes programmées + flux d'événements alimenté par le test. */
function fauxCerveau(routes: Record<string, (corps: any) => unknown>) {
  const appels: string[] = []
  let pousser: (r: unknown) => void = () => {}
  const requete = (async (url: string, options: RequestInit = {}) => {
    const chemin = url.replace("http://cerveau.test/api", "")
    const methode = options.method ?? "GET"
    appels.push(`${methode} ${chemin}`)
    if (chemin.endsWith("/evenements")) {
      const flux = new ReadableStream<Uint8Array>({
        start(c) {
          pousser = (r) => c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(r)}\n\n`))
        },
      })
      return new Response(flux)
    }
    const cle = `${methode} ${chemin.replace(/\/(s1|c1)\b/, "/:id")}`
    const route = routes[cle]
    if (!route) return new Response(JSON.stringify({erreur: `route ${cle}`}), {status: 404})
    return Response.json(route(options.body ? JSON.parse(String(options.body)) : undefined))
  }) as unknown as typeof fetch
  return {cerveau: new Cerveau("http://cerveau.test/", "k", requete), appels, pousser: (r: unknown) => pousser(r)}
}

const attendre = (ms = 5) => new Promise((r) => setTimeout(r, ms))

describe("commandes vocales", () => {
  test("apprenti : phrases courtes seulement", () => {
    expect(commandeApprenti("Suivant !")).toBe("suivant")
    expect(commandeApprenti("tu peux répéter")).toBe("repeter")
    expect(commandeApprenti("Pause")).toBe("pause")
    expect(commandeApprenti("je prends le suivant dans la corbeille là")).toBeNull()
  })
  test("maître : étape suivante et fin", () => {
    expect(commandeMaitre("Étape suivante")).toBe("etape")
    expect(commandeMaitre("c'est terminé")).toBe("terminer")
    expect(commandeMaitre("je rabats la pâte vers moi en appuyant avec la paume")).toBeNull()
  })
})

describe("mode apprenti", () => {
  test("ouvre une session, lance la vidéo en direct et dit les corrections du flux", async () => {
    const {lunettes, dit, affiche, videos} = fausseLunettes()
    const f = fauxCerveau({
      "GET /lecons": () => [{id: "L1", titre: "Baguette", metier: "Boulangerie", statut: "prete"}],
      "POST /sessions": () => retour(0, {dire: "Étape 1"}),
      "POST /sessions/:id/direct": () => ({rtmpUrl: "rtmp://cerveau.test:1935/live/abc"}),
    })
    const c = new Controleur(lunettes, f.cerveau, REGLAGES_PAR_DEFAUT, () => {})
    await c.demarrer()
    await attendre()
    expect(videos).toEqual(["rtmp://cerveau.test:1935/live/abc"])

    // Le flux renvoie d'abord l'état courant (déjà dit), puis une correction.
    f.pousser(retour(0, {dire: "Étape 1"}))
    f.pousser(retour(0, {verdict: "correction", afficher: "Roule plus long", dire: "Roule plus long"}))
    await attendre()
    expect(dit).toEqual(["Étape 1", "Roule plus long"])
    expect(affiche.at(-1)).toBe("Étape 1/3 : Titre 1 | Roule plus long")
    expect(f.appels).toContain("POST /sessions")
  })

  test("pause puis reprise : même session, vidéo relancée", async () => {
    const {lunettes, dit, videos, arrets} = fausseLunettes()
    const f = fauxCerveau({
      "POST /sessions": () => retour(0),
      "GET /sessions/:id": () => retour(1),
      "POST /sessions/:id/direct": () => ({rtmpUrl: "rtmp://x/live/1"}),
      "DELETE /sessions/:id/direct": () => ({ok: true}),
    })
    const c = new Controleur(lunettes, f.cerveau, {...REGLAGES_PAR_DEFAUT, leconId: "L1"}, () => {})
    await c.demarrer()
    await c.boutonCourt() // pause
    expect(arrets()).toBe(1)
    expect(f.appels).toContain("DELETE /sessions/s1/direct")
    await c.boutonCourt() // reprise
    expect(f.appels.filter((a) => a === "POST /sessions")).toHaveLength(1)
    expect(videos).toHaveLength(2)
    expect(dit).toContain("On reprend. Titre 2.")
  })

  test("s'arrête quand la leçon est terminée", async () => {
    const {lunettes, arrets} = fausseLunettes()
    const f = fauxCerveau({
      "POST /sessions": () => retour(2),
      "POST /sessions/:id/direct": () => ({rtmpUrl: "rtmp://x/live/1"}),
      "DELETE /sessions/:id/direct": () => ({ok: true}),
    })
    const c = new Controleur(lunettes, f.cerveau, {...REGLAGES_PAR_DEFAUT, leconId: "L1"}, () => {})
    await c.demarrer()
    await attendre()
    f.pousser(retour(2, {termine: true, dire: "Bravo, terminé"}))
    await attendre(20)
    expect(c.actif).toBe(false)
    expect(arrets()).toBe(1)
  })

  test("sans leçon prête, prévient au lieu de démarrer", async () => {
    const {lunettes, dit} = fausseLunettes()
    const f = fauxCerveau({"GET /lecons": () => []})
    const c = new Controleur(lunettes, f.cerveau, REGLAGES_PAR_DEFAUT, () => {})
    await c.demarrer()
    expect(c.actif).toBe(false)
    expect(dit.at(-1)).toContain("cerveau")
  })
})

describe("mode maître", () => {
  test("filme en direct, envoie la voix, marque les étapes et termine", async () => {
    const {lunettes, dit, videos, arrets} = fausseLunettes()
    const f = fauxCerveau({
      "POST /captures": () => ({captureId: "c1"}),
      "POST /captures/:id/direct": () => ({rtmpUrl: "rtmp://x/live/m"}),
      "POST /captures/:id/parole": () => ({}),
      "POST /captures/:id/etape": () => ({}),
      "POST /captures/:id/terminer": () => ({}),
    })
    const reglages = {...REGLAGES_PAR_DEFAUT, mode: "maitre" as const, titreDemo: "Croissant", metierDemo: "Boulangerie"}
    const c = new Controleur(lunettes, f.cerveau, reglages, () => {})
    await c.boutonCourt()
    await c.entendu("Je rabats la pâte vers moi")
    await c.entendu("Étape suivante")
    await c.entendu("C'est terminé")
    expect(videos).toEqual(["rtmp://x/live/m"])
    expect(f.appels).toEqual([
      "POST /captures",
      "POST /captures/c1/direct",
      "POST /captures/c1/parole",
      "POST /captures/c1/etape",
      "POST /captures/c1/terminer",
    ])
    expect(arrets()).toBe(1)
    expect(dit.at(-1)).toContain("en préparation")
  })
})

// ---------------------------------------------------------------------------
// Intégration : le vrai cerveau, un faux Claude, et des « lunettes » qui envoient une vraie vidéo
// en direct (RTMP) avec ffmpeg.
// ---------------------------------------------------------------------------

describe("intégration avec le cerveau", () => {
  const racine = path.resolve(import.meta.dir, "../../cerveau")
  const ffmpeg = path.join(racine, "node_modules/ffmpeg-static/ffmpeg")
  const dossier = mkdtempSync(path.join(tmpdir(), "mentra-integration-"))
  let cerveauProcessus: ChildProcess
  let fauxClaude: ReturnType<typeof Bun.serve>
  const portCerveau = 18787
  let analyses = 0

  beforeAll(async () => {
    fauxClaude = Bun.serve({
      port: 0,
      async fetch(req) {
        const corps = (await req.json()) as {system: string}
        const texte = String(corps.system).includes("Tu prépares une leçon")
          ? JSON.stringify({
              etapes: [
                {titre: "Pesée", consigne: "Pèse la farine.", debut_s: 0, fin_s: 3, points_de_controle: [], erreurs_frequentes: [], criteres_de_reussite: []},
                {titre: "Façonnage", consigne: "Roule la pâte.", debut_s: 3, fin_s: 6, points_de_controle: [], erreurs_frequentes: [], criteres_de_reussite: []},
              ],
            })
          : (analyses++, JSON.stringify({verdict: "correction", message: "Garde les mains à plat.", points_valides: []}))
        const message = {
          id: "m", type: "message", role: "assistant", model: "x", content: [{type: "text", text: texte}],
          stop_reason: "end_turn", stop_sequence: null, usage: {input_tokens: 1, output_tokens: 1},
        }
        if (req.headers.get("accept") === "text/event-stream" || texte.includes("etapes")) {
          const ev = (nom: string, d: unknown) => `event: ${nom}\ndata: ${JSON.stringify(d)}\n\n`
          return new Response(
            ev("message_start", {type: "message_start", message: {...message, content: [], stop_reason: null}}) +
              ev("content_block_start", {type: "content_block_start", index: 0, content_block: {type: "text", text: ""}}) +
              ev("content_block_delta", {type: "content_block_delta", index: 0, delta: {type: "text_delta", text: texte}}) +
              ev("content_block_stop", {type: "content_block_stop", index: 0}) +
              ev("message_delta", {type: "message_delta", delta: {stop_reason: "end_turn", stop_sequence: null}, usage: {output_tokens: 1}}) +
              ev("message_stop", {type: "message_stop"}),
            {headers: {"content-type": "text/event-stream"}},
          )
        }
        return Response.json(message)
      },
    })
    cerveauProcessus = spawn("node", ["src/server.ts"], {
      cwd: racine,
      env: {
        ...process.env,
        PORT: String(portCerveau),
        DOSSIER_DONNEES: path.join(dossier, "donnees"),
        ANTHROPIC_API_KEY: "test",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${fauxClaude.port}`,
        PORTS_RTMP: "19370-19379",
        CLE_ACCES: "",
      },
      stdio: "ignore",
    })
    for (let i = 0; i < 50; i++) {
      if (await fetch(`http://127.0.0.1:${portCerveau}/api/lecons`).then((r) => r.ok, () => false)) return
      await attendre(100)
    }
    throw new Error("le cerveau n'a pas démarré")
  })

  afterAll(() => {
    cerveauProcessus?.kill()
    fauxClaude?.stop(true)
    rmSync(dossier, {recursive: true, force: true})
  })

  /** Lunettes simulées : « filmer » = pousser une vidéo de test en RTMP avec ffmpeg. */
  function lunettesSimulees(secondes: number) {
    const dit: string[] = []
    let envoi: ChildProcess | null = null
    let fini: Promise<void> = Promise.resolve()
    const lunettes: Lunettes = {
      async demarrerVideo(rtmpUrl) {
        await attendre(500) // le temps que le cerveau se mette à l'écoute
        envoi = spawn(ffmpeg, [
          "-hide_banner", "-loglevel", "error", "-re",
          "-f", "lavfi", "-i", `testsrc=duration=${secondes}:size=640x360:rate=15`,
          "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-g", "15", "-f", "flv", rtmpUrl,
        ])
        fini = new Promise((r) => envoi!.on("close", () => r()))
      },
      async arreterVideo() {
        envoi?.kill("SIGINT")
        await fini
      },
      dire: (t) => void dit.push(t),
      afficher: () => {},
    }
    return {lunettes, dit, fin: () => fini}
  }

  test(
    "le maître filme en direct, la leçon est prête, puis l'apprenti est corrigé en direct",
    async () => {
      const cerveau = new Cerveau(`http://127.0.0.1:${portCerveau}`, "")

      // 1. Le maître filme 6 secondes et termine.
      const maitre = lunettesSimulees(6)
      const cm = new Controleur(maitre.lunettes, cerveau, {...REGLAGES_PAR_DEFAUT, mode: "maitre", titreDemo: "Baguette", metierDemo: "Boulangerie"}, () => {})
      await cm.demarrer()
      await maitre.fin()
      await cm.entendu("terminé")
      let lecons = await cerveau.lecons()
      for (let i = 0; i < 120 && lecons[0]?.statut !== "prete"; i++) {
        await attendre(250)
        lecons = await cerveau.lecons()
      }
      expect(lecons[0]?.statut).toBe("prete")

      // 2. L'apprenti suit la leçon : sa vidéo en direct est analysée en continu.
      const apprenti = lunettesSimulees(8)
      const ca = new Controleur(apprenti.lunettes, cerveau, {...REGLAGES_PAR_DEFAUT, leconId: lecons[0].id}, () => {})
      await ca.demarrer()
      for (let i = 0; i < 100 && !apprenti.dit.includes("Garde les mains à plat."); i++) await attendre(100)
      expect(apprenti.dit[0]).toBe("Étape 1 : Pesée. Pèse la farine.")
      expect(apprenti.dit).toContain("Garde les mains à plat.")
      expect(analyses).toBeGreaterThan(0)
      await ca.arreter()
    },
    60_000,
  )
})
