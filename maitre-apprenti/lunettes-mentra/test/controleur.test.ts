import {describe, expect, test} from "bun:test"
import {commandeApprenti, commandeMaitre, Controleur, type Lunettes} from "../src/background/controleur"
import {REGLAGES_PAR_DEFAUT, type Etat, type Reglages} from "../src/shared/channels"

function retour(index: number, partiel: Record<string, unknown> = {}) {
  return {
    sessionId: "s1",
    termine: false,
    etape: {index, total: 3, titre: `Titre ${index + 1}`},
    afficher: `Consigne ${index + 1}`,
    dire: null,
    ignore: false,
    ...partiel,
  }
}

/** Faux cerveau : répond selon la route, et note chaque appel. */
function fauxCerveau(reponses: Record<string, (corps: any) => unknown>) {
  const appels: {methode: string; chemin: string; corps: any; cle: string}[] = []
  const requete = (async (url: string, options: RequestInit) => {
    const chemin = url.replace("https://cerveau.test/api", "")
    const corps = options.body ? JSON.parse(String(options.body)) : undefined
    appels.push({methode: options.method ?? "GET", chemin, corps, cle: (options.headers as any)["x-cle"]})
    const cle = `${options.method} ${chemin.replace(/\/s1\b|\/c1\b/, "/:id")}`
    const reponse = reponses[cle]
    if (!reponse) return new Response(JSON.stringify({erreur: `route ${cle}`}), {status: 404})
    return new Response(JSON.stringify(reponse(corps)), {status: 200})
  }) as unknown as typeof fetch
  return {requete, appels}
}

function fausseLunettes() {
  const dit: string[] = []
  const affiche: string[] = []
  let photos = 0
  const lunettes: Lunettes = {
    prendrePhoto: async () => `https://photos.test/${++photos}.jpg`,
    dire: (t) => void dit.push(t),
    afficher: (titre, texte) => void affiche.push(`${titre} | ${texte}`),
  }
  return {lunettes, dit, affiche}
}

const REGLAGES: Reglages = {...REGLAGES_PAR_DEFAUT, urlCerveau: "https://cerveau.test/", cle: "k", leconId: "L1"}

/** `attendre` contrôlé par le test : chaque tour de boucle attend qu'on le libère. */
function horlogeManuelle() {
  const enAttente: (() => void)[] = []
  return {
    attendre: () => new Promise<void>((ok) => enAttente.push(ok)),
    async tour() {
      while (enAttente.length === 0) await new Promise((r) => setTimeout(r, 1))
      enAttente.shift()!()
      await new Promise((r) => setTimeout(r, 1))
    },
  }
}

describe("commandes vocales", () => {
  test("apprenti : phrases courtes seulement", () => {
    expect(commandeApprenti("Suivant !")).toBe("suivant")
    expect(commandeApprenti("étape suivante")).toBe("suivant")
    expect(commandeApprenti("Précédent")).toBe("precedent")
    expect(commandeApprenti("tu peux répéter")).toBe("repeter")
    expect(commandeApprenti("Pause")).toBe("pause")
    expect(commandeApprenti("je prends le suivant dans la corbeille là")).toBeNull()
    expect(commandeApprenti("bonjour")).toBeNull()
  })

  test("maître : étape suivante et fin", () => {
    expect(commandeMaitre("Étape suivante")).toBe("etape")
    expect(commandeMaitre("c'est terminé")).toBe("terminer")
    expect(commandeMaitre("je rabats la pâte vers moi en appuyant avec la paume")).toBeNull()
  })
})

describe("mode apprenti", () => {
  test("ouvre une session, envoie les photos et dit les corrections", async () => {
    const {lunettes, dit, affiche} = fausseLunettes()
    const {requete, appels} = fauxCerveau({
      "POST /sessions": () => retour(0, {dire: "Étape 1"}),
      "POST /sessions/:id/image": () => retour(0, {afficher: "Ajoute de l'eau", dire: "Ajoute de l'eau"}),
    })
    const horloge = horlogeManuelle()
    const etats: Etat[] = []
    const c = new Controleur(lunettes, REGLAGES, (e) => etats.push(e), requete, horloge.attendre)

    await c.demarrer()
    await horloge.tour()

    expect(appels[0]).toMatchObject({methode: "POST", chemin: "/sessions", corps: {leconId: "L1"}, cle: "k"})
    expect(appels[1]).toMatchObject({chemin: "/sessions/s1/image", corps: {imageUrl: "https://photos.test/1.jpg"}})
    // (La boucle a pu repartir pour un tour de plus : on regarde les deux premiers messages.)
    expect(dit.slice(0, 2)).toEqual(["Étape 1", "Ajoute de l'eau"])
    expect(affiche.at(-1)).toBe("Étape 1/3 : Titre 1 | Ajoute de l'eau")
    expect(etats.at(-1)?.actif).toBe(true)
    c.arreter()
  })

  test("reprend la même session après une pause", async () => {
    const {lunettes, dit} = fausseLunettes()
    const {requete, appels} = fauxCerveau({
      "POST /sessions": () => retour(0),
      "GET /sessions/:id": () => retour(1),
      "POST /sessions/:id/image": () => retour(1),
    })
    const horloge = horlogeManuelle()
    const c = new Controleur(lunettes, REGLAGES, () => {}, requete, horloge.attendre)
    await c.demarrer()
    c.arreter()
    await c.demarrer()
    expect(appels.filter((a) => a.chemin === "/sessions")).toHaveLength(1)
    expect(dit.at(-1)).toBe("On reprend. Titre 2.")
    c.arreter()
  })

  test("une erreur du cerveau est dite une seule fois, la boucle continue", async () => {
    const {lunettes, dit} = fausseLunettes()
    const {requete, appels} = fauxCerveau({"POST /sessions": () => retour(0)})
    const horloge = horlogeManuelle()
    const c = new Controleur(lunettes, REGLAGES, () => {}, requete, horloge.attendre)
    await c.demarrer()
    await horloge.tour()
    await horloge.tour()
    expect(appels.filter((a) => a.chemin.endsWith("/image"))).toHaveLength(3)
    expect(dit.filter((t) => t.includes("cerveau"))).toHaveLength(1)
    expect(c.etatActuel.erreur).toContain("route")
    c.arreter()
  })

  test("s'arrête quand la leçon est terminée", async () => {
    const {lunettes} = fausseLunettes()
    const {requete} = fauxCerveau({
      "POST /sessions": () => retour(2),
      "POST /sessions/:id/image": () => retour(2, {termine: true, afficher: "Bravo", dire: "Bravo"}),
    })
    const horloge = horlogeManuelle()
    const c = new Controleur(lunettes, REGLAGES, () => {}, requete, horloge.attendre)
    await c.demarrer()
    await new Promise((r) => setTimeout(r, 5))
    expect(c.actif).toBe(false)
    expect(c.etatActuel.etape).toBe("Leçon terminée")
  })

  test("sans adresse du cerveau, ne démarre pas", async () => {
    const {lunettes} = fausseLunettes()
    const c = new Controleur(lunettes, {...REGLAGES, urlCerveau: ""}, () => {})
    await c.demarrer()
    expect(c.actif).toBe(false)
    expect(c.etatActuel.erreur).toContain("adresse")
  })
})

describe("mode maître", () => {
  test("envoie photos et paroles, marque les étapes et termine", async () => {
    const {lunettes, dit} = fausseLunettes()
    const {requete, appels} = fauxCerveau({
      "POST /captures": () => ({captureId: "c1"}),
      "POST /captures/:id/image": () => ({}),
      "POST /captures/:id/parole": () => ({}),
      "POST /captures/:id/etape": () => ({}),
      "POST /captures/:id/terminer": () => ({}),
    })
    const horloge = horlogeManuelle()
    const reglages: Reglages = {...REGLAGES, mode: "maitre", titreDemo: "Croissant", metierDemo: "Boulangerie"}
    const c = new Controleur(lunettes, reglages, () => {}, requete, horloge.attendre)

    await c.demarrer()
    await horloge.tour()
    await c.entendu("Je rabats la pâte vers moi")
    await c.entendu("Étape suivante")
    await c.boutonLong()

    const chemins = appels.map((a) => a.chemin)
    expect(appels[0].corps).toEqual({titre: "Croissant", metier: "Boulangerie"})
    expect(chemins).toContain("/captures/c1/image")
    expect(appels.find((a) => a.chemin.endsWith("/parole"))?.corps).toEqual({texte: "Je rabats la pâte vers moi"})
    expect(chemins).toContain("/captures/c1/etape")
    expect(chemins.at(-1)).toBe("/captures/c1/terminer")
    expect(c.actif).toBe(false)
    expect(dit.at(-1)).toContain("en préparation")
  })
})
