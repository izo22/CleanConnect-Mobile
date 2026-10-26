import { useState, type FormEvent } from "react";
import { api, useData } from "../api.ts";
import { ago } from "../format.ts";
import { ErrorBox, Skeleton, useAction, useToast } from "../components/ui.tsx";

interface Integration {
  id: number;
  name: string;
  base_url: string;
  api_key_hint: string;
  last_sync_at: number | null;
  last_error: string | null;
  agents: number;
}

const SCOPES = ["workflow:list", "workflow:read", "workflow:activate", "workflow:deactivate", "execution:list", "execution:read"];

export function Connections() {
  const { data, error, reload } = useData<Integration[]>("/api/integrations");
  const { run, busy } = useAction();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", base_url: "", api_key: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api<Integration & { sync: { workflows: number; imported: number } }>("/api/integrations", { method: "POST", body: form });
      toast(`Connecté : ${res.sync.workflows} workflow(s) importé(s) comme agents, ${res.sync.imported} exécution(s) lues.`);
      setForm({ name: "", base_url: "", api_key: "" });
      reload();
    } catch (err) {
      toast((err as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="page-head">
        <div className="titles">
          <h1 className="h1">Connexions</h1>
          <span className="sub">Branchez vos outils d'automatisation : Agent HQ lit vos workflows lui-même, sans que vous ayez à les modifier.</span>
        </div>
      </header>
      {error && <ErrorBox message={error.message} />}
      {!data && !error && <Skeleton count={1} />}
      {data && data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((i) => (
            <div key={i.id} className="card" style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
              <span className="avatar" style={{ width: 46, height: 46, background: "#FFE1D6", color: "#9A3412", fontSize: 13 }}>n8n</span>
              <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 3 }}>
                <strong style={{ fontSize: 15 }}>{i.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{i.base_url} · clé {i.api_key_hint} · {i.agents} workflow(s) suivis</span>
                {i.last_error ? (
                  <span style={{ fontSize: 13, color: "#B42318", fontWeight: 600 }}>Problème : {i.last_error}</span>
                ) : (
                  <span style={{ fontSize: 13, color: "#0E6B3F" }}>{i.last_sync_at ? `À jour · ${ago(i.last_sync_at)}` : "Jamais synchronisé"}</span>
                )}
              </div>
              <div className="actions">
                <button type="button" className="btn" disabled={busy !== null} onClick={() => run("s" + i.id, `/api/integrations/${i.id}/sync`).then(reload)}>Synchroniser</button>
                <button type="button" className="btn" disabled={busy !== null} onClick={() => run("d" + i.id, `/api/integrations/${i.id}`, undefined, "DELETE").then(reload)}>Déconnecter</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="card" aria-labelledby="zapier-h" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="avatar" style={{ width: 46, height: 46, background: "#FFE9DF", color: "#9A3412", fontSize: 12 }}>Zap</span>
          <h2 id="zapier-h" className="h2" style={{ fontSize: 22 }}>Zapier</h2>
        </div>
        <p className="sub" style={{ fontSize: 14 }}>
          Ajoutez l'application <b>Agent HQ</b> dans vos Zaps (lien d'invitation fourni par votre administrateur), puis connectez-la avec la <b>clé de l'agent</b> (fiche de l'agent → Connexion).
        </p>
        <div className="explain">
          <span><strong>Contrôler :</strong> étape « Ask Permission » avant l'action sensible + un Zap qui part de « Decision Made » pour l'exécuter après votre accord.</span>
          <span><strong>Voir :</strong> étape « Report Activity » en fin de Zap.</span>
          <span><strong>Arrêter :</strong> Zap « Agent Paused or Resumed » → Zapier Manager « Turn Zap On/Off ».</span>
          <span><strong>Limite :</strong> Zapier ne laisse pas Agent HQ lire vos Zaps lui-même tant que nous ne sommes pas partenaire ; seules les étapes Agent HQ ajoutées remontent.</span>
        </div>
      </section>

      <section className="card" aria-labelledby="add-n8n" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 id="add-n8n" className="h2" style={{ fontSize: 22 }}>Connecter un serveur n8n</h2>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#45424C" }}>
          <li>Dans n8n : <b>Settings → n8n API → Create an API key</b>.</li>
          <li>
            Donnez-lui uniquement ces droits :
            <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>{SCOPES.map((s) => <code key={s}>{s}</code>)}</span>
          </li>
          <li>Collez l'adresse de votre n8n et la clé ci-dessous.</li>
        </ol>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="two">
            <div className="field"><label htmlFor="n8n-url">Adresse de n8n</label><input id="n8n-url" required placeholder="https://n8n.mon-agence.fr" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} /></div>
            <div className="field"><label htmlFor="n8n-name">Nom (facultatif)</label><input id="n8n-name" placeholder="n8n production" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <div className="field"><label htmlFor="n8n-key">Clé API n8n</label><input id="n8n-key" required type="password" autoComplete="off" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} /></div>
          <button type="submit" className="btn primary big" style={{ alignSelf: "flex-start" }} disabled={saving}>{saving ? "Test de la connexion…" : "Tester et connecter"}</button>
        </form>
        <div className="explain">
          <span><strong>Ce que ça fait tout de suite :</strong> chaque workflow devient un agent ; ses réussites et ses échecs remontent toutes les 30 secondes ; « Mettre en pause » désactive le workflow dans n8n.</span>
          <span><strong>Pour aller plus loin :</strong> sur un workflow sensible, ajoutez le bloc « Demander l'autorisation » (bouton dans la fiche de l'agent) pour qu'il attende votre feu vert.</span>
          <span><strong>Limite :</strong> n8n ne transmet pas le coût des appels d'IA ; une exécution déjà en cours au moment de la pause va jusqu'au bout.</span>
        </div>
      </section>
    </>
  );
}
