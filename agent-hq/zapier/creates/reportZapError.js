'use strict';

const { baseUrl, agentField } = require('../utils');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/events`,
    method: 'POST',
    body: {
      kind: 'error',
      success: false,
      action: input.step || undefined,
      error_message: input.error_message || 'The Zap failed',
      meta: input.zap_link ? { link: input.zap_link } : undefined,
    },
  });
  const control = response.data.control || {};
  return { accepted: response.data.accepted, paused: !!control.paused, pause_reason: control.pause_reason || null };
};

module.exports = {
  key: 'report_zap_error',
  noun: 'Zap Error',
  display: {
    label: 'Report a Zap Error',
    description:
      'Tells Orvanta that a Zap failed. Set it up once after **Zapier Manager → New Zap Error** to watch every Zap of your account, even those without Orvanta steps.',
  },
  operation: {
    perform,
    inputFields: [
      agentField(true),
      { key: 'error_message', label: 'Error Message', required: true, helpText: 'What went wrong, e.g. Zapier Manager\'s error message.' },
      { key: 'step', label: 'Failed Step', required: false, helpText: 'e.g. `Gmail · Send Email`.' },
      { key: 'zap_link', label: 'Link to the Zap Run', required: false },
    ],
    sample: { accepted: 1, paused: false, pause_reason: null },
    outputFields: [
      { key: 'accepted', label: 'Accepted', type: 'integer' },
      { key: 'paused', label: 'Agent Is Paused', type: 'boolean' },
      { key: 'pause_reason', label: 'Pause Reason' },
    ],
  },
};
