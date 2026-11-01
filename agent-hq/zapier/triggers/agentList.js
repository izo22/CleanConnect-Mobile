'use strict';

const { baseUrl } = require('../utils');

// Feeds the "Agent" dropdown of every Orvanta step (workspace connections).
const perform = async (z, bundle) => {
  const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/agents` });
  return response.data;
};

module.exports = {
  key: 'agent_list',
  noun: 'Agent',
  display: { label: 'List Agents', description: 'The agents of your Orvanta workspace.', hidden: true },
  operation: {
    perform,
    sample: { id: 'zap-refunds', name: 'Refunds' },
    outputFields: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }],
  },
};
