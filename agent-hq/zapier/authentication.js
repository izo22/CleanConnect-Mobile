'use strict';

const { baseUrl } = require('./utils');

// One Zapier connection = one Orbyn agent (its connection key).
module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'base_url',
      label: 'Orbyn Address',
      required: true,
      type: 'string',
      helpText: 'The address you use to open Orbyn, for example `https://hq.your-company.com`.',
    },
    {
      key: 'api_key',
      label: 'Agent Connection Key',
      required: true,
      type: 'password',
      helpText:
        'In Orbyn, open the agent that this Zap represents, then **Connection → Show the connection key**. Each agent has its own key.',
    },
  ],
  test: async (z, bundle) => {
    const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/config` });
    return response.data;
  },
  // bundle.inputData holds what the test returned: the agent's name.
  connectionLabel: (z, bundle) => bundle.inputData.name,
};
