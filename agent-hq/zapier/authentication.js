'use strict';

const { baseUrl } = require('./utils');

// One Zapier connection = one Orvanta agent (its connection key).
module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'base_url',
      label: 'Orvanta Address',
      required: true,
      type: 'string',
      helpText: 'The address you use to open Orvanta, for example `https://hq.your-company.com`.',
    },
    {
      key: 'api_key',
      label: 'Agent Connection Key',
      required: true,
      type: 'password',
      helpText:
        'In Orvanta, open the agent that this Zap represents, then **Connection → Show the connection key**. Each agent has its own key.',
    },
  ],
  test: async (z, bundle) => {
    const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/config` });
    return response.data;
  },
  // bundle.inputData holds what the test returned: the agent's name.
  connectionLabel: (z, bundle) => bundle.inputData.name,
};
