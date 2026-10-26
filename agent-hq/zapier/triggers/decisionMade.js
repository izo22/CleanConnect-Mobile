'use strict';

const { baseUrl, isTrue } = require('../utils');

const filterOf = (bundle) => ({
  approved: isTrue(bundle.inputData.only_approved, true) ? true : undefined,
  action: bundle.inputData.action || undefined,
});

const performSubscribe = async (z, bundle) => {
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/hooks`,
    method: 'POST',
    body: { event: 'decision', target_url: bundle.targetUrl, filter: filterOf(bundle) },
  });
  return response.data; // { id }
};

const performUnsubscribe = async (z, bundle) => {
  const response = await z.request({ url: `${baseUrl(bundle)}/api/v1/hooks/${bundle.subscribeData.id}`, method: 'DELETE' });
  return response.data;
};

// Agent HQ pushed the decision: hand it to the next steps as-is.
const perform = async (z, bundle) => [bundle.cleanedRequest];

// Used by Zapier for samples while building the Zap.
const performList = async (z, bundle) => {
  const f = filterOf(bundle);
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/decisions`,
    params: { only_approved: f.approved ? 'true' : 'false', ...(f.action ? { action: f.action } : {}) },
  });
  return response.data;
};

module.exports = {
  key: 'decision_made',
  noun: 'Decision',
  display: {
    label: 'Decision Made',
    description:
      'Triggers when someone approves (or refuses) in Agent HQ a request made with **Ask Permission**. Use it to perform the approved action.',
  },
  operation: {
    type: 'hook',
    perform,
    performList,
    performSubscribe,
    performUnsubscribe,
    inputFields: [
      {
        key: 'only_approved',
        label: 'Only Approved Requests',
        type: 'boolean',
        default: 'true',
        required: false,
        helpText: 'Leave on to run the action only when it was approved.',
      },
      {
        key: 'action',
        label: 'Only for This Action',
        required: false,
        helpText: 'Same name as in **Ask Permission**, e.g. `stripe.refund`. Empty = every action of this agent.',
      },
    ],
    sample: {
      id: 42,
      approval_id: 42,
      decision: 'approved',
      approved: true,
      decided_by: 'Julie',
      decided_at: '2026-10-26T15:04:00.000Z',
      title: 'Refund $340 to Harbor Café',
      action: 'stripe.refund',
      amount_cents: 34000,
      amount: 340,
      context: 'Damaged parcel, photos attached',
      payload: { order_id: '8812', customer_email: 'owner@harborcafe.com' },
    },
    outputFields: [
      { key: 'approval_id', label: 'Approval Request ID', type: 'integer' },
      { key: 'decision', label: 'Decision (approved, rejected)' },
      { key: 'approved', label: 'Approved', type: 'boolean' },
      { key: 'decided_by', label: 'Decided By' },
      { key: 'decided_at', label: 'Decided At', type: 'datetime' },
      { key: 'title', label: 'Summary' },
      { key: 'action', label: 'Action' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'context', label: 'Details' },
    ],
  },
};
