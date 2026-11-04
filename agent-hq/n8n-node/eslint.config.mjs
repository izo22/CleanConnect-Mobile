import n8n from 'eslint-plugin-n8n-nodes-base';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		files: ['credentials/**/*.ts'],
		languageOptions: { parser: tsParser },
		plugins: { 'n8n-nodes-base': n8n },
		rules: { ...n8n.configs.credentials.rules, 'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off' },
	},
	{
		files: ['nodes/**/*.ts'],
		languageOptions: { parser: tsParser },
		plugins: { 'n8n-nodes-base': n8n },
		// NodeConnectionTypes.Main is the current way; the older rule only knows the 'main' string.
		rules: { ...n8n.configs.nodes.rules, 'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off', 'n8n-nodes-base/node-class-description-outputs-wrong': 'off' },
	},
];
