import {useEffect, useState} from "react"
import {REGLAGES_PAR_DEFAUT, type Etat, type Reglages} from "../shared/channels"

interface ResumeLecon {
  id: string
  titre: string
  metier: string
  statut: "en_preparation" | "prete" | "erreur"
}

export function App() {
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_PAR_DEFAUT)
  const [etat, setEtat] = useState<Etat | null>(null)
  const [lecons, setLecons] = useState<ResumeLecon[]>([])
  const [erreurLecons, setErreurLecons] = useState<string | null>(null)
  const [enregistre, setEnregistre] = useState(true)

  useEffect(() => {
    const desabonnerReglages = mentra.on("reglages", (r) => {
      setReglages(r)
      setEnregistre(true)
    })
    const desabonnerEtat = mentra.on("etat", setEtat)
    return () => {
      desabonnerReglages()
      desabonnerEtat()
    }
  }, [])

  // Liste des leçons prêtes, lue directement sur le cerveau.
  useEffect(() => {
    if (!reglages.urlCerveau) return
    const base = reglages.urlCerveau.replace(/\/+$/, "")
    fetch(`${base}/api/lecons`, {headers: {"x-cle": reglages.cle}})
      .then(async (r) => {
        const corps = await r.json()
        if (!r.ok) throw new Error(corps.erreur ?? `Erreur ${r.status}`)
        return corps as ResumeLecon[]
      })
      .then((liste) => {
        setLecons(liste.filter((l) => l.statut === "prete"))
        setErreurLecons(null)
      })
      .catch((e: Error) => setErreurLecons(`Cerveau injoignable : ${e.message}`))
  }, [reglages.urlCerveau, reglages.cle])

  const modifier = (partiel: Partial<Reglages>) => {
    setReglages((r) => ({...r, ...partiel}))
    setEnregistre(false)
  }

  return (
    <div className="app">
      <h1>Maître &amp; Apprenti</h1>

      <section className="carte">
        <label>
          Adresse du cerveau
          <input
            value={reglages.urlCerveau}
            placeholder="https://mon-serveur.fr"
            inputMode="url"
            onChange={(e) => modifier({urlCerveau: e.target.value.trim()})}
          />
        </label>
        <label>
          Clé d'accès <small>(si le serveur en demande une)</small>
          <input type="password" value={reglages.cle} onChange={(e) => modifier({cle: e.target.value})} />
        </label>

        <div className="choix">
          <button
            className={reglages.mode === "apprenti" ? "actif" : ""}
            onClick={() => modifier({mode: "apprenti"})}>
            Je suis apprenti
          </button>
          <button
            className={reglages.mode === "maitre" ? "actif" : ""}
            onClick={() => modifier({mode: "maitre"})}>
            Je suis le maître
          </button>
        </div>

        {reglages.mode === "apprenti" ? (
          <label>
            Leçon
            <select value={reglages.leconId} onChange={(e) => modifier({leconId: e.target.value})}>
              <option value="">— Choisir —</option>
              {lecons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.titre} ({l.metier})
                </option>
              ))}
            </select>
            {erreurLecons && <small className="erreur">{erreurLecons}</small>}
          </label>
        ) : (
          <>
            <label>
              Titre de la démonstration
              <input
                value={reglages.titreDemo}
                placeholder="Croissant au beurre"
                onChange={(e) => modifier({titreDemo: e.target.value})}
              />
            </label>
            <label>
              Métier
              <input
                value={reglages.metierDemo}
                placeholder="Boulangerie"
                onChange={(e) => modifier({metierDemo: e.target.value})}
              />
            </label>
          </>
        )}

        <button className="principal" disabled={enregistre} onClick={() => mentra.send("reglages:enregistrer", reglages)}>
          {enregistre ? "Réglages enregistrés" : "Enregistrer les réglages"}
        </button>
      </section>

      <section className="carte">
        <div className="ligne">
          <strong>{etat?.actif ? "En cours" : "À l'arrêt"}</strong>
          {etat?.actif ? (
            <button onClick={() => mentra.send("arreter", {})}>Pause</button>
          ) : (
            <button className="principal" disabled={!enregistre} onClick={() => mentra.send("demarrer", {})}>
              Démarrer
            </button>
          )}
        </div>
        {etat?.etape && <p className="etape">{etat.etape}</p>}
        {etat?.message && <p>{etat.message}</p>}
        {etat?.erreur && <p className="erreur">{etat.erreur}</p>}

        {reglages.mode === "apprenti" && etat?.actif && (
          <div className="choix">
            <button onClick={() => mentra.send("commande", {commande: "precedent"})}>← Précédent</button>
            <button onClick={() => mentra.send("commande", {commande: "repeter"})}>Répéter</button>
            <button onClick={() => mentra.send("commande", {commande: "suivant"})}>Suivant →</button>
          </div>
        )}
      </section>

      <section className="aide">
        {reglages.mode === "apprenti" ? (
          <p>
            Sur les lunettes : appui court = démarrer / pause, appui long = étape suivante. À la voix : « suivant »,
            « précédent », « répète », « recommence », « pause ».
          </p>
        ) : (
          <p>
            Explique tes gestes à voix haute pendant que tu travailles. Appui court ou « étape suivante » pour marquer
            une nouvelle étape, appui long ou « terminé » à la fin.
          </p>
        )}
      </section>
    </div>
  )
}
