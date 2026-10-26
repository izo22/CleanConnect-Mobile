'use strict';

const { baseUrl, toCents } = require('../utils');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const failed = input.status === 'failure';
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/events`,
    method: 'POST',
    body: {
      kind: failed ? 'error' : 'task',
      success: !failed,
      action: input.action || undefined,
      target: input.target || undefined,
      cost_cents: toCents(input.cost),
      language: input.language || undefined,
      input: input.input || undefined,
      output: input.output || undefined,
      error_message: failed ? input.error_message || 'Failure reported by the Zap' : undefined,
    },
  });
  const control = response.data.control || {};
  return { accepted: response.data.accepted, paused: !!control.paused, pause_reason: control.pause_reason || null };
};

module.exports = {
  key: 'report_activity',
  noun: 'Activity',
  display: {
    label: 'Report Activity',
    description:
      'Tells Agent HQ what the agent just did (success or failure, cost, answer). Feeds the dashboard, the incident alerts and the AI review.',
  },
  operation: {
    perform,
    inputFields: [
      { key: 'action', label: 'Action', required: true, helpText: 'e.g. `zendesk.reply`, `hubspot.update`.' },
      { key: 'status', label: 'Status', required: true, choices: { success: 'Success', failure: 'Failure' }, default: 'success' },
      { key: 'error_message', label: 'Error Message', required: false, helpText: 'Only for failures.' },
      { key: 'target', label: 'Customer or Record', required: false },
      { key: 'input', label: 'What the Agent Received', type: 'text', required: false, helpText: 'e.g. the customer message. Needed for the AI review.' },
      { key: 'output', label: 'What the Agent Answered or Did', type: 'text', required: false, helpText: 'Needed for the AI review.' },
      { key: 'cost', label: 'Cost', type: 'number', required: false, helpText: 'AI cost of this task in your currency, e.g. `0.04`.' },
      { key: 'language', label: 'Language', required: false, helpText: 'Two-letter code of the answer, e.g. `en`, `fr`.' },
    ],
    sample: { accepted: 1, paused: false, pause_reason: null },
    outputFields: [
      { key: 'accepted', label: 'Accepted', type: 'integer' },
      { key: 'paused', label: 'Agent Is Paused', type: 'boolean' },
      { key: 'pause_reason', label: 'Pause Reason' },
    ],
  },
};
