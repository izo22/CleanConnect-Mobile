'use strict';

const { baseUrl } = require('./utils');

// One Zapier connection for the whole workspace (its Zapier key), or for one agent (its own key).
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
      label: 'Connection Key',
      required: true,
      type: 'password',
      helpText:
        'In Orvanta: **Connections → Zapier → Copy the key**. One key for all your Zaps; each Orvanta step then says which agent the Zap is. (An agent\'s own key also works.)',
    },
  ],
  test: async (z, bundle) => {
    const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/config` });
    return response.data;
  },
  // bundle.inputData holds what the test returned: the workspace's or the agent's name.
  connectionLabel: (z, bundle) => bundle.inputData.name,
};
