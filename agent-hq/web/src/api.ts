import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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

const TOKEN_KEY = "agent-hq.token";
const NAME_KEY = "agent-hq.name";

const read = (k: string) => {
  try { return localStorage.getItem(k) ?? ""; } catch { return ""; }
};
const write = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* private mode */ }
};

export const session = {
  get token() { return read(TOKEN_KEY); },
  set token(v: string) { write(TOKEN_KEY, v); },
  get name() { return read(NAME_KEY); },
  set name(v: string) { write(NAME_KEY, v); },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["content-type"] = "application/json";
  if (session.token) headers["x-admin-token"] = session.token;
  if (session.name) headers["x-user-name"] = encodeURIComponent(session.name);
  const res = await fetch(path, { method: init?.method ?? "GET", headers, body: init?.body !== undefined ? JSON.stringify(init.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "Le serveur ne répond pas.");
  return data as T;
}

/** Bumped every time the server says something changed. */
export const LiveContext = createContext<{ version: number; connected: boolean }>({ version: 0, connected: false });

export function useLiveUpdates(enabled: boolean) {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const url = "/api/stream" + (session.token ? `?token=${encodeURIComponent(session.token)}` : "");
    const es = new EventSource(url);
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
