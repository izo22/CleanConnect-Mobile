import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { tr } from "./i18n.ts";

export type {
  ActivityRow,
  AgentDetail,
  AgentSummary,
  AlertView,
  AlertsView,
  ApprovalView,
  ApprovalsView,
  ExchangeView,
  Overview,
  QualityView,
  RuleView,
} from "../../server/queries.ts";
export type { EarlyAccessView } from "../../server/early-access.ts";

const WORKSPACE_KEY = "agent-hq.workspace";

const read = (k: string) => {
  try { return localStorage.getItem(k) ?? ""; } catch { return ""; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
};

/** The person signs in with a cookie; the browser remembers which workspace they were looking at. */
export const session = {
  get workspace() { return read(WORKSPACE_KEY); },
  set workspace(v: string) { write(WORKSPACE_KEY, v); },
};

export type Role = "owner" | "member" | "viewer";
export interface WorkspaceRef { id: string; name: string; role: Role }
export interface Me {
  mode: "accounts" | "open";
  user: { id: number; name: string; email: string; is_admin: boolean; has_password: boolean };
  workspaces: WorkspaceRef[];
  early_access: number;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  if (session.workspace) headers["x-workspace"] = session.workspace;
  const res = await fetch(path, { method: init?.method ?? "GET", headers, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? tr("The server is not responding.", "Le serveur ne répond pas."));
  return data as T;
}

/** Bumped every time the server says something changed. */
export const LiveContext = createContext<{ version: number; connected: boolean }>({ version: 0, connected: false });

export function useLiveUpdates(enabled: boolean) {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener("change", () => setVersion((v) => v + 1));
    return () => es.close();
  }, [enabled]);
  return { version, connected };
}

/** Loads a resource and reloads it whenever the server pushes a change. */
export function useData<T>(path: string | null) {
  const { version } = useContext(LiveContext);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [local, setLocal] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (!path) { setData(null); return; }
    const mine = ++seq.current;
    api<T>(path)
      .then((d) => { if (mine === seq.current) { setData(d); setError(null); } })
      .catch((e: ApiError) => { if (mine === seq.current) setError(e); });
  }, [path, version, local]);
  const reload = useCallback(() => setLocal((n) => n + 1), []);
  return { data, error, reload };
}
