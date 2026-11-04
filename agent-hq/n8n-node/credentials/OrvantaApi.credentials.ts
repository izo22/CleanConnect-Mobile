import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class OrvantaApi implements ICredentialType {
	name = 'orvantaApi';

	displayName = 'Orvanta API';

	icon: Icon = { light: 'file:orvanta.svg', dark: 'file:orvanta.dark.svg' };

	documentationUrl = 'https://orvantahq.io/how-it-works';

	properties: INodeProperties[] = [
		{
			displayName: 'Orvanta URL',
			name: 'url',
			type: 'string',
			default: 'https://app.orvantahq.io',
			placeholder: 'https://app.orvantahq.io',
			description: 'The address of your Orvanta app',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'In Orvanta, open My AI team, pick the agent this workflow is (or add one, source n8n), and copy its key. It starts with ahq_.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.url.replace(/\\/+$/, "")}}',
			url: '/api/v1/config',
			method: 'GET',
		},
	};
}
