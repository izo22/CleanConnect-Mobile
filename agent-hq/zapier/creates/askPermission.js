'use strict';

const { baseUrl, agentField, toCents, isTrue } = require('../utils');

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

  // "Wait": the Zap pauses here and Orvanta wakes it up with the decision
  // (performResume). Steps saved before this choice existed keep the old
  // behaviour (stop, and a "Decision Made" Zap does the action), so a Zap
  // never does the action twice.
  if (result.decision === 'needs_approval' && input.when_approval_needed === 'wait') {
    const callbackUrl = z.generateCallbackUrl();
    await z.request({
      url: `${baseUrl(bundle)}/api/v1/approvals/${result.approval_id}/callback`,
      method: 'POST',
      body: { callback_url: callbackUrl },
    });
    return { ...result, waiting: true };
  }

  // Otherwise only let the next steps run when the action is allowed right now.
  if (!result.allowed && isTrue(input.stop_unless_allowed, true)) {
    const why = result.decision === 'needs_approval'
      ? `Waiting for approval in Orvanta (request #${result.approval_id}): ${result.reason}`
      : `Refused by Orvanta: ${result.reason}`;
    throw new z.errors.HaltedError(why);
  }
  return result;
};

// Orvanta called back: someone decided.
const performResume = async (z, bundle) => {
  const d = bundle.cleanedRequest || {};
  const approved = d.approved === true || d.approved === 'true';
  if (!approved && isTrue(bundle.inputData.stop_unless_allowed, true)) {
    throw new z.errors.HaltedError(`Declined in Orvanta${d.decided_by ? ` by ${d.decided_by}` : ''}: the action was not done.`);
  }
  return {
    ...bundle.outputData,
    decision: approved ? 'approved' : 'rejected',
    allowed: approved,
    approved,
    needs_approval: false,
    waiting: false,
    decided_by: d.decided_by || null,
    decided_at: d.decided_at || null,
  };
};

module.exports = {
  key: 'ask_permission',
  noun: 'Permission',
  display: {
    label: 'Ask Permission',
    description:
      'Asks Orvanta before a sensitive action. Allowed: the Zap goes on. Needs approval: the Zap waits until you click Approve or Decline in Orvanta, then goes on (or stops).',
  },
  operation: {
    perform,
    performResume,
    inputFields: [
      agentField(true),
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
        helpText: 'Only for “Stop this Zap”: values the action will need once approved (order ID, customer e-mail…). They come back in the **Decision Made** trigger.',
      },
      {
        key: 'sensitive',
        label: 'Sensitive Action',
        type: 'boolean',
        default: 'false',
        required: false,
        helpText: 'Agents set to “I approve what\'s sensitive” in Orvanta ask you for every sensitive action.',
      },
      {
        key: 'when_approval_needed',
        label: 'When Your Approval Is Needed',
        required: false,
        choices: {
          wait: 'Wait for the decision, then go on (recommended)',
          stop: 'Stop this Zap (another Zap starts from “Decision Made”)',
        },
        default: 'wait',
        helpText: 'Wait: the Zap pauses here (up to 30 days) and continues as soon as you click Approve in Orvanta. Declined: the Zap stops.',
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
      { key: 'approved', label: 'Approved by a Human', type: 'boolean' },
      { key: 'decided_by', label: 'Decided By' },
    ],
  },
};
