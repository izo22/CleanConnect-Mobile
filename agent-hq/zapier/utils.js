'use strict';

const baseUrl = (bundle) => String(bundle.authData.base_url || '').trim().replace(/\/+$/, '');

/** The workspace's Zapier key (one for every Zap), as opposed to one agent's own key. */
const isWorkspaceKey = (bundle) => String((bundle.authData || {}).api_key || '').trim().startsWith('ozk_');

/**
 * Every request to Orvanta carries the key. With the workspace key, it also
 * says which agent this Zap is (the step's "Agent" field): Orvanta creates
 * the agent the first time it sees a new name.
 */
const addAuth = (request, z, bundle) => {
  request.headers = request.headers || {};
  if (bundle.authData && bundle.authData.api_key) request.headers.Authorization = `Bearer ${String(bundle.authData.api_key).trim()}`;
  const agent = bundle.inputData && bundle.inputData.agent;
  if (agent && isWorkspaceKey(bundle)) request.headers['X-Agent'] = encodeURIComponent(String(agent));
  const zap = bundle.meta && bundle.meta.zap;
  if (zap && zap.id) request.headers['X-Zap-Id'] = String(zap.id);
  return request;
};

/** The "Agent" field, shown only for a workspace connection. */
const agentField = (required) => (z, bundle) =>
  isWorkspaceKey(bundle)
    ? [
        {
          key: 'agent',
          label: 'Agent',
          required,
          dynamic: 'agent_list.id.name',
          helpText: required
            ? 'Which agent this Zap is in Orvanta. Pick it, or type a new name (tip: the Zap\'s name): Orvanta creates it.'
            : 'Leave empty to cover every agent of your Orvanta workspace.',
        },
      ]
    : [];

/** Orvanta answers errors as { error: "message in plain words" }: show that message in Zapier. */
const handleErrors = (response, z) => {
  if (response.status >= 400) {
    let message = `Orvanta answered ${response.status}`;
    try {
      const body = typeof response.json === 'object' && response.json ? response.json : JSON.parse(response.content);
      if (body && body.error) message = `Orvanta: ${body.error}`;
    } catch (e) {
      // not JSON: keep the generic message
    }
    if (response.status === 401) throw new z.errors.ExpiredAuthError(message);
    throw new z.errors.Error(message, 'AgentHQError', response.status);
  }
  return response;
};

/** "340.50" or 340.5 → 34050 cents; empty → undefined. */
const toCents = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid amount: ${value}`);
  return Math.round(n * 100);
};

/** Zapier booleans may arrive as true/false or "true"/"false"/"yes"/"no". */
const isTrue = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || ['true', 'yes', '1'].includes(String(value).toLowerCase());
};

module.exports = { baseUrl, addAuth, agentField, isWorkspaceKey, handleErrors, toCents, isTrue };
