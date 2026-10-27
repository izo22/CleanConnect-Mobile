'use strict';

/**
 * Runs the Zapier app with Zapier's own test runtime (appTester) against a
 * live Orbyn server:
 *
 *   ALLOW_PRIVATE_HOOKS=true npm start          (in agent-hq/)
 *   AGENT_HQ_URL=http://localhost:8787 npm test (in agent-hq/zapier/)
 *
 * A small local server stands in for Zapier's webhook receiver, so the
 * REST-hook flow (subscribe → Orbyn pushes → trigger runs) is exercised
 * for real, end to end.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const HQ = (process.env.AGENT_HQ_URL || 'http://localhost:8787').replace(/\/$/, '');
const CATCHER_PORT = 9890;

let authData;
let agentId;
const received = [];
let catcher;

const admin = async (path, init = {}) => {
  const res = await fetch(HQ + path, {
    method: init.method || 'GET',
    headers: { 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (what, fn, ms = 10000) => {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(200)) {
    const v = fn();
    if (v) return v;
  }
  throw new Error(`timed out waiting for ${what}`);
};

before(async () => {
  catcher = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push({ path: req.url, body: JSON.parse(body || '{}') });
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"success"}');
    });
  });
  await new Promise((r) => catcher.listen(CATCHER_PORT, r));
  // A fresh agent at trust level 1, like a new refund Zap would be.
  const agent = await admin('/api/agents', { method: 'POST', body: { name: `Zap Refunds ${Date.now()}`, autonomy: 1, budget_cents: 100000 } });
  agentId = agent.id;
  authData = { base_url: HQ, api_key: agent.api_key };
  await admin('/api/rules/refunds', { method: 'PATCH', body: { enabled: true, params: { max_cents: 20000 } } });
});

after(() => catcher.close());

test('connection: the test call returns the agent and labels the connection', async () => {
  const result = await appTester(App.authentication.test, { authData });
  assert.ok(result.name.startsWith('Zap Refunds'));
  const label = App.authentication.connectionLabel(null, { inputData: result });
  assert.strictEqual(label, result.name);
});

test('connection: a wrong key is refused with a clear message', async () => {
  await assert.rejects(appTester(App.authentication.test, { authData: { base_url: HQ, api_key: 'wrong-key' } }), /Invalid agent key/);
});

test('Ask Permission: a small refund is allowed and the Zap continues', async () => {
  const result = await appTester(App.creates.ask_permission.operation.perform, {
    authData,
    inputData: { action: 'stripe.refund', amount: '45.00', summary: 'Refund $45 to Nguyen' },
  });
  assert.strictEqual(result.allowed, true);
});

let approvalId;
test('Ask Permission: above the threshold, the Zap is halted (nothing runs) and a request waits in Orbyn', async () => {
  await assert.rejects(
    appTester(App.creates.ask_permission.operation.perform, {
      authData,
      inputData: { action: 'stripe.refund', amount: '340', summary: 'Refund $340 to Harbor Café', data: { order_id: '8812', email: 'owner@harbor.cafe' } },
    }),
    (err) => err.name === 'HaltedError' && /Waiting for approval/.test(err.message),
  );
  const approvals = await admin('/api/approvals');
  const pending = approvals.pending.find((p) => p.title === 'Refund $340 to Harbor Café');
  assert.ok(pending, 'request visible in Orbyn');
  assert.deepStrictEqual(pending.payload, { order_id: '8812', email: 'owner@harbor.cafe' });
  approvalId = pending.id;
});

let decisionHook;
test('Decision Made: subscribing registers a hook; approving pushes the decision with the kept data', async () => {
  decisionHook = await appTester(App.triggers.decision_made.operation.performSubscribe, {
    authData,
    inputData: { only_approved: true, action: 'stripe.refund' },
    targetUrl: `http://localhost:${CATCHER_PORT}/decision`,
  });
  assert.ok(decisionHook.id);

  await admin(`/api/approvals/${approvalId}/decision`, { method: 'POST', body: { approve: true } });
  const hit = await waitFor('decision push', () => received.find((r) => r.path === '/decision' && r.body.approval_id === approvalId));
  assert.strictEqual(hit.body.approved, true);
  assert.strictEqual(hit.body.amount, 340);
  assert.deepStrictEqual(hit.body.payload, { order_id: '8812', email: 'owner@harbor.cafe' });

  // What the next steps of the Zap receive.
  const items = await appTester(App.triggers.decision_made.operation.perform, { authData, inputData: {}, cleanedRequest: hit.body });
  assert.strictEqual(items[0].payload.order_id, '8812');
});

test('Decision Made: a refused request does not start the "approved only" Zap', async () => {
  await assert.rejects(
    appTester(App.creates.ask_permission.operation.perform, { authData, inputData: { action: 'stripe.refund', amount: '280', summary: 'Refund $280 to Bean Co' } }),
    /Waiting for approval/,
  );
  const pending = (await admin('/api/approvals')).pending.find((p) => p.title === 'Refund $280 to Bean Co');
  const before = received.length;
  await admin(`/api/approvals/${pending.id}/decision`, { method: 'POST', body: { approve: false } });
  await sleep(1500);
  assert.strictEqual(received.slice(before).filter((r) => r.path === '/decision').length, 0);
});

test('Decision Made: sample data comes from the latest real decisions', async () => {
  const items = await appTester(App.triggers.decision_made.operation.performList, { authData, inputData: { only_approved: true } });
  assert.ok(items.length >= 1);
  assert.ok(items.every((i) => i.approved === true));
});

test('Agent Paused or Resumed: pausing in Orbyn notifies the Zap (emergency stop)', async () => {
  const hook = await appTester(App.triggers.agent_state_changed.operation.performSubscribe, {
    authData,
    inputData: { state: 'paused' },
    targetUrl: `http://localhost:${CATCHER_PORT}/state`,
  });
  await admin(`/api/agents/${agentId}/actions/pause`, { method: 'POST', body: {} });
  const hit = await waitFor('pause push', () => received.find((r) => r.path === '/state'));
  assert.strictEqual(hit.body.paused, true);
  assert.strictEqual(hit.body.state, 'paused');

  // Filter: resuming does not fire a "paused only" subscription.
  const before = received.length;
  await admin(`/api/agents/${agentId}/actions/resume`, { method: 'POST', body: {} });
  await sleep(1500);
  assert.strictEqual(received.length, before);

  await appTester(App.triggers.agent_state_changed.operation.performUnsubscribe, { authData, subscribeData: hook });
});

test('Ask Permission: a paused agent is refused', async () => {
  await admin(`/api/agents/${agentId}/actions/pause`, { method: 'POST', body: {} });
  await assert.rejects(
    appTester(App.creates.ask_permission.operation.perform, { authData, inputData: { action: 'stripe.refund', amount: '10', summary: 'Refund $10' } }),
    /Refused by Orbyn: Agent paused/,
  );
  await admin(`/api/agents/${agentId}/actions/resume`, { method: 'POST', body: {} });
});

test('Ask Permission: if Orbyn cannot be reached, the step fails so the action never runs', async () => {
  await assert.rejects(
    appTester(App.creates.ask_permission.operation.perform, {
      authData: { base_url: 'http://localhost:1', api_key: authData.api_key },
      inputData: { action: 'stripe.refund', amount: '77', summary: 'Refund $77' },
    }),
  );
});

test('Report Activity: successes and failures reach Orbyn and its alerts', async () => {
  const ok = await appTester(App.creates.report_activity.operation.perform, {
    authData,
    inputData: { action: 'zendesk.reply', status: 'success', input: 'Where is my order?', output: 'It shipped yesterday.', cost: '0.03', language: 'en' },
  });
  assert.strictEqual(ok.accepted, 1);
  for (let i = 0; i < 6; i++) {
    await appTester(App.creates.report_activity.operation.perform, {
      authData,
      inputData: { action: 'hubspot.update', status: 'failure', error_message: '401 Unauthorized: token expired' },
    });
  }
  const alerts = await admin('/api/alerts');
  const alert = alerts.open.find((a) => a.agent_id === agentId);
  assert.ok(alert, 'alert raised');
  assert.strictEqual(alert.kind, 'auth');
});

test('Unsubscribing removes the hook: no more pushes', async () => {
  await appTester(App.triggers.decision_made.operation.performUnsubscribe, { authData, subscribeData: decisionHook });
  await assert.rejects(appTester(App.triggers.decision_made.operation.performUnsubscribe, { authData, subscribeData: decisionHook }), /not found/);
});
