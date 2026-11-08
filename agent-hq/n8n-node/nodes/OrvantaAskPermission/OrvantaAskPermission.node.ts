import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHookFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { askOrvanta, baseUrlOf, toCents } from '../shared';

/**
 * Asks Orvanta before a risky step. Three answers:
 * - allowed: the item leaves by the "Approved" output right away;
 * - needs approval: the execution waits until someone clicks Approve or Decline in Orvanta,
 *   which calls the execution's resume URL; the item then leaves by "Approved" or "Declined";
 * - refused (agent paused, out of budget…): the item leaves by "Declined" right away.
 */
export class OrvantaAskPermission implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Orvanta Ask Permission',
		name: 'orvantaAskPermission',
		icon: { light: 'file:orvanta.svg', dark: 'file:orvanta.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["action"]}}',
		description:
			'Ask a human before a risky step. Waits for a one-click approval in Orvanta when your rules require it.',
		defaults: { name: 'Orvanta Ask Permission' },
		// Not offered as an AI tool: waiting for a human decision pauses the whole execution,
		// which a tool call cannot do. Use it as a regular step before the risky one.
		usableAsTool: undefined,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main, NodeConnectionTypes.Main],
		outputNames: ['Approved', 'Declined'],
		credentials: [{ name: 'orvantaApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '',
				restartWebhook: true,
			},
		],
		properties: [
			{
				displayName:
					'Put this node right before the step to protect (send email, refund, payment…). Connect that step to <b>Approved</b>. When your approval is needed, the workflow waits here until you click Approve or Decline in Orvanta.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'quote.send',
				description:
					'What the next step is about to do, e.g. quote.send, stripe.refund, email.send. Your Orvanta guardrails match on this name.',
			},
			{
				displayName: 'Summary',
				name: 'summary',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Send a $18,400 quote to Dana Brooks',
				description: 'The sentence the approver reads in Orvanta',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'number',
				default: 0,
				typeOptions: { numberPrecision: 2 },
				description: 'In your currency, e.g. 18400 for $18,400. Used by amount rules such as "Over $5,000, I approve". Leave 0 if the action has no amount.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Always Ask Me',
						name: 'alwaysAsk',
						type: 'boolean',
						default: false,
						description: 'Whether to wait for a human decision every time, whatever the rules say',
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
						displayName: 'Maximum Wait (Hours)',
						name: 'maxWaitHours',
						type: 'number',
						default: 24,
						typeOptions: { minValue: 1, maxValue: 720 },
						description: 'If nobody decides in time, the item leaves by Declined',
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
							'The reply, quote or message the next step will send. Orvanta\'s AI check reads it first and holds anything doubtful for your approval.',
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
		],
	};

	/**
	 * The only webhook is the execution's resume URL (restartWebhook), which n8n creates
	 * for each waiting execution. Nothing is registered on Orvanta's side when the
	 * workflow is activated: Orvanta receives the resume URL with each request.
	 */
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('orvantaApi');
		const baseUrl = baseUrlOf(credentials.url as string);
		const approved: INodeExecutionData[] = [];
		const declined: INodeExecutionData[] = [];
		let waiting: { item: INodeExecutionData; answer: IDataObject } | undefined;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const amount = this.getNodeParameter('amount', i, 0) as number;
			const details =
				(options.context as string) ||
				Object.entries(item.json)
					.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
					.join(' · ');

			const body: IDataObject = {
				action: this.getNodeParameter('action', i) as string,
				summary: (this.getNodeParameter('summary', i) as string).slice(0, 300),
				context: details.slice(0, 3000) || undefined,
				amount_cents: toCents(amount),
				target: (options.target as string) || undefined,
				sensitive: options.sensitive === true || undefined,
				require_approval: options.alwaysAsk === true || undefined,
				input: (options.input as string) || undefined,
				output: (options.output as string) || undefined,
				// Orvanta keeps the item and hands it back with the decision, so the next
				// step receives the same data after a wait.
				payload: item.json,
			};

			const needsWait = async () => {
				if (waiting || items.length > 1) {
					throw new NodeOperationError(
						this.getNode(),
						'Orvanta can wait for one approval at a time. Put a "Loop Over Items" node (batch size 1) before this node.',
						{ itemIndex: i },
					);
				}
				body.callback_url = this.evaluateExpression('{{ $execution.resumeUrl }}', i) as string;
			};

			// Ask once without a callback, unless an approval could be needed for a single item:
			// then the resume URL goes with the first request so nothing is asked twice.
			if (items.length === 1) await needsWait();
			const answer = await askOrvanta(this, baseUrl, body);
			const orvanta = {
				decision: answer.decision,
				reason: answer.reason,
				approval_id: answer.approval_id ?? null,
			};

			if (answer.decision === 'allow') {
				approved.push({ json: { ...item.json, orvanta }, binary: item.binary, pairedItem: { item: i } });
			} else if (answer.decision === 'needs_approval') {
				if (items.length > 1) await needsWait();
				waiting = { item, answer: orvanta };
			} else {
				declined.push({ json: { ...item.json, orvanta }, binary: item.binary, pairedItem: { item: i } });
			}
		}

		if (waiting) {
			const hours = ((this.getNodeParameter('options', 0, {}) as IDataObject).maxWaitHours as number) || 24;
			const waitTill = new Date(Date.now() + hours * 3600_000);
			// The extra option is read by recent n8n versions and ignored by older ones.
			await (this.putExecutionToWait as (d: Date, o?: IDataObject) => Promise<void>)(waitTill, {
				acceptsResumeRequest: true,
			});
			// What leaves the node if nobody decides before the time limit.
			return [
				[],
				[
					{
						json: { ...waiting.item.json, orvanta: { ...waiting.answer, decision: 'timed_out', reason: 'Nobody decided in time.' } },
						pairedItem: { item: 0 },
					},
				],
			];
		}
		return [approved, declined];
	}

	/** Orvanta calls the resume URL once someone decided. */
	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = (this.getBodyData() ?? {}) as IDataObject;
		const ok = body.approved === true || body.approved === 'true';
		const original = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as IDataObject;
		const item: INodeExecutionData = {
			json: {
				...original,
				orvanta: {
					decision: ok ? 'approved' : 'declined',
					approval_id: body.approval_id ?? null,
					decided_by: body.decided_by ?? null,
					decided_at: body.decided_at ?? null,
					// The text to send: the approver's corrected version if they edited it ("Edit & approve").
					output: body.output ?? null,
					edited: body.edited === true,
				},
			},
			pairedItem: { item: 0 },
		};
		return {
			webhookResponse: { received: true },
			workflowData: ok ? [[item], []] : [[], [item]],
		};
	}
}
