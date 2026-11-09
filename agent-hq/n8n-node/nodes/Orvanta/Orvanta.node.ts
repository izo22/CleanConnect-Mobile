import {
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { callOrvanta, toCents } from '../shared';

/**
 * One node, three operations:
 * - Ask Permission: asks Orvanta before a risky step and returns its answer right away
 *   (allow, needs_approval or deny) in the item, to branch on with an If node.
 *   When a human decision is needed, the Orvanta Trigger node starts a workflow once someone decides.
 * - Get Decision: reads the current state of an approval request (for polling).
 * - Report Activity: tells Orvanta what the workflow did, or that it failed.
 */
export class Orvanta implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Orvanta',
		name: 'orvanta',
		icon: { light: 'file:orvanta.svg', dark: 'file:orvanta.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Ask permission before risky actions, read decisions and report activity to Orvanta',
		defaults: { name: 'Orvanta' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'orvantaApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Ask Permission',
						value: 'askPermission',
						action: 'Ask permission before an action',
						description: 'Check an action against your Orvanta rules: allowed, needs approval or refused',
					},
					{
						name: 'Get Decision',
						value: 'getDecision',
						action: 'Get the decision on an approval request',
						description: 'Read whether an approval request was approved, declined or is still pending',
					},
					{
						name: 'Report Activity',
						value: 'reportActivity',
						action: 'Report activity',
						description: 'Tell Orvanta what the workflow just did, or that it failed',
					},
				],
				default: 'askPermission',
			},

			// ---------- Ask Permission ----------
			{
				displayName: 'Action',
				name: 'action',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'quote.send',
				displayOptions: { show: { operation: ['askPermission'] } },
				description:
					'What the next step is about to do, e.g. quote.send, stripe.refund, email.send. Your Orvanta rules match on this name.',
			},
			{
				displayName: 'Summary',
				name: 'summary',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Send a $18,400 quote to Dana Brooks',
				displayOptions: { show: { operation: ['askPermission'] } },
				description: 'The sentence the approver reads in Orvanta',
			},
			{
				displayName: 'Options',
				name: 'askOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['askPermission'] } },
				options: [
					{
						displayName: 'Always Ask Me',
						name: 'alwaysAsk',
						type: 'boolean',
						default: false,
						description: 'Whether a human must decide every time, whatever the rules say',
					},
					{
						displayName: 'Amount',
						name: 'amount',
						type: 'number',
						default: 0,
						typeOptions: { numberPrecision: 2 },
						description: 'In your currency, e.g. 18400 for $18,400. Used by amount rules such as "Over $5,000, I approve".',
					},
					{
						displayName: 'Customer or Recipient',
						name: 'target',
						type: 'string',
						default: '',
						description: 'Who the action is for, e.g. the customer email',
					},
					{
						displayName: 'Details for the Approver',
						name: 'context',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description: 'Extra lines shown with the request. Leave empty to show the fields of the current item.',
					},
					{
						displayName: 'Sensitive Action',
						name: 'sensitive',
						type: 'boolean',
						default: false,
						description:
							'Whether this action is sensitive. Agents set to "I approve what\'s sensitive" ask for every sensitive action.',
					},
					{
						displayName: 'Text About to Be Sent',
						name: 'output',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description:
							'The reply, quote or message the next step will send. Orvanta\'s AI check reads it first and holds anything doubtful for approval.',
					},
					{
						displayName: 'Text Received',
						name: 'input',
						type: 'string',
						typeOptions: { rows: 3 },
						default: '',
						description: 'What the workflow is answering, e.g. the customer\'s email. Helps the AI check spot contradictions.',
					},
				],
			},

			// ---------- Get Decision ----------
			{
				displayName: 'Approval ID',
				name: 'approvalId',
				type: 'number',
				required: true,
				default: 0,
				displayOptions: { show: { operation: ['getDecision'] } },
				description: 'The approval_id returned by Ask Permission',
			},

			// ---------- Report Activity ----------
			{
				displayName: 'Action',
				name: 'activityAction',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'email.send',
				displayOptions: { show: { operation: ['reportActivity'] } },
				description: 'What was done, e.g. zendesk.reply, hubspot.update, quote.send',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Success', value: 'success' },
					{ name: 'Failure', value: 'failure' },
				],
				default: 'success',
				displayOptions: { show: { operation: ['reportActivity'] } },
			},
			{
				displayName: 'Error Message',
				name: 'errorMessage',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['reportActivity'], status: ['failure'] } },
				description: 'What went wrong, in a few words',
			},
			{
				displayName: 'Options',
				name: 'activityOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['reportActivity'] } },
				options: [
					{ displayName: 'Cost', name: 'cost', type: 'number', default: 0, typeOptions: { numberPrecision: 4 }, description: 'AI cost of this task in your currency, e.g. 0.04' },
					{ displayName: 'Customer or Record', name: 'target', type: 'string', default: '' },
					{ displayName: 'Language', name: 'language', type: 'string', default: '', placeholder: 'en', description: 'Two-letter code of the answer' },
					{ displayName: 'What the Agent Answered or Did', name: 'output', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'Needed for the AI review' },
					{ displayName: 'What the Agent Received', name: 'input', type: 'string', typeOptions: { rows: 3 }, default: '', description: 'For example the customer message. Needed for the AI review.' },
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;
			const item = items[i];

			if (operation === 'askPermission') {
				const options = this.getNodeParameter('askOptions', i, {}) as IDataObject;
				const details =
					(options.context as string) ||
					Object.entries(item.json)
						.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
						.join(' · ');
				const answer = await callOrvanta(this, 'POST', '/api/v1/check', {
					action: this.getNodeParameter('action', i) as string,
					summary: (this.getNodeParameter('summary', i) as string).slice(0, 300),
					context: details.slice(0, 3000) || undefined,
					amount_cents: toCents(options.amount),
					target: (options.target as string) || undefined,
					sensitive: options.sensitive === true || undefined,
					require_approval: options.alwaysAsk === true || undefined,
					input: (options.input as string) || undefined,
					output: (options.output as string) || undefined,
					// Orvanta keeps the item and hands it back with the decision (Orvanta Trigger),
					// so the workflow that continues after a human decision has the same data.
					payload: item.json,
				});
				out.push({
					json: {
						...item.json,
						orvanta: {
							decision: answer.decision,
							allowed: answer.decision === 'allow',
							needs_approval: answer.decision === 'needs_approval',
							reason: answer.reason ?? null,
							approval_id: answer.approval_id ?? null,
						},
					},
					binary: item.binary,
					pairedItem: { item: i },
				});
			} else if (operation === 'getDecision') {
				const id = Math.trunc(Number(this.getNodeParameter('approvalId', i)));
				const answer = await callOrvanta(this, 'GET', `/api/v1/approvals/${id}`);
				out.push({
					json: {
						...item.json,
						orvanta: {
							approval_id: answer.id ?? id,
							status: answer.status,
							approved: answer.status === 'approved',
							decided_by: answer.decided_by ?? null,
							decided_at: answer.decided_at ? new Date(answer.decided_at as number).toISOString() : null,
							// The approver's corrected text when they edited it before approving.
							output: answer.output ?? null,
							edited: answer.edited === true,
						},
					},
					binary: item.binary,
					pairedItem: { item: i },
				});
			} else {
				const failed = this.getNodeParameter('status', i) === 'failure';
				const options = this.getNodeParameter('activityOptions', i, {}) as IDataObject;
				const answer = await callOrvanta(this, 'POST', '/api/v1/events', {
					kind: failed ? 'error' : 'task',
					success: !failed,
					action: this.getNodeParameter('activityAction', i) as string,
					target: (options.target as string) || undefined,
					cost_cents: toCents(options.cost),
					language: (options.language as string) || undefined,
					input: (options.input as string) || undefined,
					output: (options.output as string) || undefined,
					error_message: failed ? (this.getNodeParameter('errorMessage', i, '') as string) || 'Failure reported by n8n' : undefined,
				});
				const control = (answer.control ?? {}) as IDataObject;
				out.push({
					json: { accepted: answer.accepted ?? null, paused: control.paused === true, pause_reason: control.pause_reason ?? null },
					pairedItem: { item: i },
				});
			}
		}
		return [out];
	}
}
