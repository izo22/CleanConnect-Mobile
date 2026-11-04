import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { baseUrlOf, toCents } = require('../dist/nodes/shared.js');

test('amounts become cents, and no amount stays empty', () => {
	assert.equal(toCents(18400), 1840000);
	assert.equal(toCents('340.5'), 34050);
	assert.equal(toCents(0), undefined);
	assert.equal(toCents(''), undefined);
	assert.equal(toCents('abc'), undefined);
});

test('the Orvanta address loses its trailing slashes', () => {
	assert.equal(baseUrlOf('https://app.orvantahq.io/'), 'https://app.orvantahq.io');
	assert.equal(baseUrlOf(' https://app.orvantahq.io '), 'https://app.orvantahq.io');
});

test('the package declares what n8n loads', () => {
	const pkg = require('../package.json');
	assert.ok(pkg.keywords.includes('n8n-community-node-package'));
	for (const f of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) assert.doesNotThrow(() => require(`../${f}`), f);
	assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'verified community nodes have no runtime dependencies');
});
