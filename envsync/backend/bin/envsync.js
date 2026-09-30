#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv, parseSchema, validate, formatReport, generateExample, ENVS } from '../src/core.js';
import * as demo from '../data/demo.js';
const [cmd = 'check', ...args] = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : '.envsync';
let envs, schema;
if (args.includes('--demo')) ({ envs, schema } = demo);
else {
  const rd = n => existsSync(join(dir, n)) ? readFileSync(join(dir, n), 'utf8') : '';
  envs = Object.fromEntries(ENVS.map(e => [e, parseEnv(rd(`${e}.env`))])); schema = parseSchema(rd('schema.yml'));
}
const r = validate(envs, schema);   // reports contain variable names only, never values
if (cmd === 'example') process.stdout.write(generateExample(envs, schema));
else if (cmd === 'report') console.log(formatReport(r));
else if (cmd === 'check') {
  console.log('EnvSync Validation\n');
  r.issues.filter(i => i.severity === 'critical').forEach(i => console.log('❌ ' + i.message));
  r.issues.filter(i => i.severity !== 'critical').forEach(i => console.log('⚠ ' + i.message));
  if (r.blocked) { console.log('\nPush blocked.'); process.exit(1); }
  console.log('\n✓ Validation passed.');
} else { console.log('Usage: envsync [check|report|example] [--demo] [--dir .envsync]'); process.exit(2); }
