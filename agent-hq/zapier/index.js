'use strict';

const authentication = require('./authentication');
const { addAuth, handleErrors } = require('./utils');
const askPermission = require('./creates/askPermission');
const reportActivity = require('./creates/reportActivity');
const decisionMade = require('./triggers/decisionMade');
const agentStateChanged = require('./triggers/agentStateChanged');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication,
  beforeRequest: [addAuth],
  afterResponse: [handleErrors],

  triggers: {
    [decisionMade.key]: decisionMade,
    [agentStateChanged.key]: agentStateChanged,
  },
  creates: {
    [askPermission.key]: askPermission,
    [reportActivity.key]: reportActivity,
  },
  searches: {},
};
