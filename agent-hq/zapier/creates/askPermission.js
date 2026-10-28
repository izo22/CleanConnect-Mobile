'use strict';

const { baseUrl, toCents, isTrue } = require('../utils');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${baseUrl(bundle)}/api/v1/check`,
    method: 'POST',
    body: {
      action: input.action,
      amount_cents: toCents(input.amount),
      summary: input.summary,
      context: input.context || undefined,
      target: input.target || undefined,
      sensitive: isTrue(input.sensitive, false),
      // Kept by Orvanta and handed back with the decision, so the
      // "Decision Made" Zap can perform the action without looking anything up.
      payload: input.data || undefined,
      // Read by the AI check before the action goes out.
      input: input.text_received || undefined,
      output: input.text_to_send || undefined,
    },
  });
  const result = response.data;

  // Default: only let the next steps run when the action is allowed right now.
  // A request waiting for approval continues in the "Decision Made" Zap.
  if (!result.allowed && isTrue(input.stop_unless_allowed, true)) {
    const why = result.decision === 'needs_approval'
      ? `Waiting for approval in Orvanta (request #${result.approval_id}): ${result.reason}`
      : `Refused by Orvanta: ${result.reason}`;
    throw new z.errors.HaltedError(why);
  }
  return result;
};

module.exports = {
  key: 'ask_permission',
  noun: 'Permission',
  display: {
    label: 'Ask Permission',
    description:
      'Asks Orvanta whether a sensitive action may run now. Following steps run only if it is allowed; otherwise the request waits for a human decision in Orvanta.',
  },
  operation: {
    perform,
    inputFields: [
      {
        key: 'action',
        label: 'Action',
        required: true,
        helpText: 'What the Zap is about to do, e.g. `stripe.refund`, `email.send`, `quote.send`. Your Orvanta guardrails match on this name.',
      },
      {
        key: 'summary',
        label: 'Summary',
        required: true,
        helpText: 'The sentence the approver reads, e.g. `Refund $340 to Harbor Café`.',
      },
      { key: 'amount', label: 'Amount', type: 'number', required: false, helpText: 'In your currency, e.g. `340.00`. Used by amount thresholds.' },
      { key: 'context', label: 'Details for the Approver', type: 'text', required: false },
      { key: 'target', label: 'Customer or Recipient', required: false },
      {
        key: 'text_received',
        label: 'Text Received',
        type: 'text',
        required: false,
        helpText: 'What the Zap is answering, e.g. the customer\'s e-mail. Lets the AI check spot answers that contradict it.',
      },
      {
        key: 'text_to_send',
        label: 'Text About to Be Sent',
        type: 'text',
        required: false,
        helpText: 'The reply, quote or message the next step will send. Orvanta\'s AI reads it first; anything doubtful waits for your approval.',
      },
      {
        key: 'data',
        label: 'Data to Keep for the Approved Action',
        dict: true,
        required: false,
        helpText: 'Values the action will need once approved (order ID, customer e-mail, amount…). They come back in the **Decision Made** trigger.',
      },
      {
        key: 'sensitive',
        label: 'Sensitive Action',
        type: 'boolean',
        default: 'false',
        required: false,
        helpText: 'Agents at trust level 1 ask a human for every sensitive action.',
      },
      {
        key: 'stop_unless_allowed',
        label: 'Stop the Zap Unless Allowed',
        type: 'boolean',
        default: 'true',
        required: false,
        helpText: 'Recommended. If set to false, the Zap continues and you decide with a Filter step using the `allowed` field.',
      },
    ],
    sample: {
      decision: 'allow',
      allowed: true,
      needs_approval: false,
    },
    outputFields: [
      { key: 'decision', label: 'Decision (allow, deny, needs_approval)' },
      { key: 'allowed', label: 'Allowed', type: 'boolean' },
      { key: 'needs_approval', label: 'Needs Approval', type: 'boolean' },
      { key: 'reason', label: 'Reason' },
      { key: 'approval_id', label: 'Approval Request ID', type: 'integer' },
    ],
  },
};
