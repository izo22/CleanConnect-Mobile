import {
	NodeConnectionTypes,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import { baseUrlOf, callOrvanta } from '../shared';

/** Tells Orvanta what the workflow just did: it feeds the dashboard, the alerts and the AI review. */
export class Orvanta implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Orvanta',
		name: 'orvanta',
		icon: 'file:orvanta.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["status"] === "failure" ? "Report a failure" : "Report activity"}}',
		description: 'Report what your workflow or AI agent did, so Orvanta can watch it and alert you',
		defaults: { name: 'Orvanta' },
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
						name: 'Report Activity',
						value: 'reportActivity',
						action: 'Report activity',
						description: 'Tell Orvanta what the workflow just did, or that it failed',
					},
				],
				default: 'reportActivity',
			},
			{
				displayName: 'Action',
				name: 'action',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'email.send',
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
			},
			{
				displayName: 'Error Message',
				name: 'errorMessage',
				type: 'string',
				default: '',
				displayOptions: { show: { status: ['failure'] } },
				description: 'What went wrong, in a few words',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
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
		const credentials = await this.getCredentials('orvantaApi');
		const baseUrl = baseUrlOf(credentials.url as string);
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			const failed = this.getNodeParameter('status', i) === 'failure';
			const options = this.getNodeParameter('options', i, {}) as IDataObject;
			const answer = await callOrvanta(this, baseUrl, '/api/v1/events', {
				kind: failed ? 'error' : 'task',
				success: !failed,
				action: this.getNodeParameter('action', i) as string,
				target: (options.target as string) || undefined,
				cost_cents: Number(options.cost) > 0 ? Number(options.cost) * 100 : undefined,
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
		return [out];
	}
}
