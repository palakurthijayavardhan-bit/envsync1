import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, compare, generateExample, isSecret, checkType, parseEnv, parseCompose, parseK8s, fingerprint } from '../src/core.js';
import { envs, schema } from '../data/demo.js';
test('detects missing variables', () => {
  const r = validate(envs, schema);
  assert.ok(r.issues.some(i => i.key === 'API_KEY' && i.env === 'production' && i.code === 'missing' && i.severity === 'critical'));
  assert.ok(r.issues.some(i => i.key === 'REDIS_URL' && i.env === 'staging'));
  assert.equal(r.blocked, true);
});
test('type validation', () => {
  assert.equal(checkType('number', 'hello'), false); assert.equal(checkType('number', '3000'), true);
  assert.equal(checkType('boolean', 'true'), true); assert.equal(checkType('boolean', 'yes'), false);
  assert.equal(checkType('url', 'redis://x:6379'), true); assert.equal(checkType('url', 'nope'), false);
  assert.ok(validate(envs, schema).issues.some(i => i.code === 'invalid' && i.message === 'PORT must be a number'));
});
test('comparison hides secrets', () => {
  const rows = compare(envs, schema), json = JSON.stringify(rows);
  assert.equal(rows.find(r => r.key === 'API_KEY').values.production, 'Missing');
  assert.equal(rows.find(r => r.key === 'API_KEY').values.local, '[SECRET PRESENT]');
  assert.ok(!json.includes('local-demo-key') && !json.includes('shared-jwt-value'));
  assert.equal(rows.find(r => r.key === 'DEBUG').values.local, 'true');
});
test('secret detection + reuse via fingerprint', () => {
  for (const k of ['API_KEY', 'DB_PASSWORD', 'AUTH_TOKEN', 'PRIVATE_KEY', 'DATABASE_URL']) assert.ok(isSecret(k));
  assert.equal(isSecret('PORT'), false); assert.equal(isSecret('API_KEY', { API_KEY: { secret: false } }), false);
  assert.equal(fingerprint('a'), fingerprint('a'));
  assert.ok(validate(envs, schema).issues.some(i => i.code === 'secret-reuse' && i.key === 'JWT_SECRET'));
  const r = validate({ local: { NOTE: 'sk_live_abcdef' } }, {}); assert.ok(r.issues.some(i => i.code === 'plaintext-secret'));
});
test('.env.example generation has no values', () => {
  const out = generateExample(envs, schema);
  assert.ok(out.includes('DATABASE_URL=\n') && out.includes('REDIS_URL=\n'));
  assert.ok(out.split('\n').filter(Boolean).every(l => l.endsWith('=')));
});
test('parsers: env, compose, k8s (secrets redacted)', () => {
  assert.deepEqual(parseEnv('A=1\n# c\nB="x y"'), { A: '1', B: 'x y' });
  assert.deepEqual(parseCompose('services:\n  web:\n    environment:\n      - DATABASE_URL\n      - PORT=3000\n    image: x'), { DATABASE_URL: '<inherited>', PORT: '3000' });
  const k = parseK8s('kind: Secret\ndata:\n  API_KEY: c2VjcmV0\n---\nkind: ConfigMap\ndata:\n  PORT: "8080"');
  assert.deepEqual(k, { API_KEY: '<redacted>', PORT: '8080' });
});
