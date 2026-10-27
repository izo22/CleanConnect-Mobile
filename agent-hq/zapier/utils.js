'use strict';

const baseUrl = (bundle) => String(bundle.authData.base_url || '').trim().replace(/\/+$/, '');

/** Every request to Orvanta carries the agent key. */
const addAuth = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

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

module.exports = { baseUrl, addAuth, handleErrors, toCents, isTrue };
