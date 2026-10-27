'use strict';

const { baseUrl } = require('../utils');

const filterOf = (bundle) => ({ state: bundle.inputData.state && bundle.inputData.state !== 'any' ? bundle.inputData.state : undefined });

const performSubscribe = async (z, bundle) => {
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/hooks`,
    method: 'POST',
    body: { event: 'agent_state', target_url: bundle.targetUrl, filter: filterOf(bundle) },
  });
  return response.data;
};

const performUnsubscribe = async (z, bundle) => {
  const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/hooks/${bundle.subscribeData.id}`, method: 'DELETE' });
  return response.data;
};

const perform = async (z, bundle) => [bundle.cleanedRequest];

const performList = async (z, bundle) => {
  const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/agent-state` });
  return response.data;
};

module.exports = {
  key: 'agent_state_changed',
  noun: 'Agent State',
  display: {
    label: 'Agent Paused or Resumed',
    description:
      'Triggers when the agent is paused or resumed in Orbyn (by a person or a guardrail). Pair it with **Zapier Manager → Turn Zap On/Off** to stop the real Zap.',
  },
  operation: {
    type: 'hook',
    perform,
    performList,
    performSubscribe,
    performUnsubscribe,
    inputFields: [
      { key: 'state', label: 'When the Agent Is', required: false, choices: { paused: 'Paused', running: 'Resumed', any: 'Paused or resumed' }, default: 'any' },
    ],
    sample: {
      id: 'refunds-agent-1793041954601',
      agent_id: 'refunds-agent',
      agent_name: 'Refunds',
      paused: true,
      state: 'paused',
      reason: 'paused by Julie',
      changed_at: '2026-10-26T15:04:00.000Z',
    },
    outputFields: [
      { key: 'agent_name', label: 'Agent Name' },
      { key: 'paused', label: 'Paused', type: 'boolean' },
      { key: 'state', label: 'State (paused, running)' },
      { key: 'reason', label: 'Reason' },
      { key: 'changed_at', label: 'Changed At', type: 'datetime' },
    ],
  },
};
