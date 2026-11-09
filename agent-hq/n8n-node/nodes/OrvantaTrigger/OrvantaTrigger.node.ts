import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { callOrvanta } from '../shared';

/**
 * Starts a workflow when something happens in Orvanta:
 * - a human approved or declined a request made with Orvanta → Ask Permission;
 * - an agent was paused or resumed.
 * The subscription is registered on Orvanta when the workflow is activated, and removed when it is deactivated.
 */
export class OrvantaTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Orvanta Trigger',
		name: 'orvantaTrigger',
		icon: { light: 'file:orvanta.svg', dark: 'file:orvanta.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a human decides on a request, or when an agent is paused or resumed',
		defaults: { name: 'Orvanta Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'orvantaApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Decision Made',
						value: 'decision',
						description: 'Someone approved or declined a request (Orvanta → Ask Permission)',
					},
					{
						name: 'Agent Paused or Resumed',
						value: 'agent_state',
						description: 'The agent was paused (by a person or a guardrail) or started again',
					},
				],
				default: 'decision',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add filter',
				default: {},
				displayOptions: { show: { event: ['decision'] } },
				options: [
					{
						displayName: 'Action',
						name: 'action',
						type: 'string',
						default: '',
						placeholder: 'quote.send',
						description: 'Only decisions about this action',
					},
					{
						displayName: 'Only Approved',
						name: 'onlyApproved',
						type: 'boolean',
						default: false,
						description: 'Whether to start only when the request was approved',
					},
				],
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				return data.hookId !== undefined;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const event = this.getNodeParameter('event') as string;
				const filters = event === 'decision' ? (this.getNodeParameter('filters', {}) as IDataObject) : {};
				const filter: IDataObject = {};
				if (filters.action) filter.action = filters.action as string;
				if (filters.onlyApproved === true) filter.approved = true;
				const answer = await callOrvanta(this, 'POST', '/api/v1/hooks', {
					event,
					target_url: this.getNodeWebhookUrl('default') as string,
					filter: Object.keys(filter).length ? filter : undefined,
				});
				this.getWorkflowStaticData('node').hookId = answer.id as number;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.hookId !== undefined) {
					try {
						await callOrvanta(this, 'DELETE', `/api/v1/hooks/${data.hookId as number}`);
					} catch {
						// Already removed on Orvanta's side: nothing left to do.
					}
					delete data.hookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = (this.getBodyData() ?? {}) as IDataObject;
		if (this.getNodeParameter('event') === 'decision') {
			// The item that was sent with Ask Permission, plus the decision.
			const original = (body.payload && typeof body.payload === 'object' ? body.payload : {}) as IDataObject;
			return {
				workflowData: [
					this.helpers.returnJsonArray({
						...original,
						orvanta: {
							approval_id: body.approval_id ?? null,
							decision: body.approved === true ? 'approved' : 'declined',
							approved: body.approved === true,
							action: body.action ?? null,
							title: body.title ?? null,
							decided_by: body.decided_by ?? null,
							decided_at: body.decided_at ?? null,
							// The text to send: the approver's corrected version if they edited it.
							output: body.output ?? null,
							edited: body.edited === true,
							agent_name: body.agent_name ?? null,
						},
					}),
				],
			};
		}
		return { workflowData: [this.helpers.returnJsonArray(body)] };
	}
}
