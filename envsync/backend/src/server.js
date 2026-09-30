import express from 'express';
import { fileURLToPath } from 'node:url';
import { validate, compare, generateExample, formatReport, fingerprint, isSecret, ENVS } from './core.js';
import * as demo from '../data/demo.js';

const ctx = b => ({ envs: b?.envs || demo.envs, schema: b?.schema || demo.schema });
// Secrets leave the server only as presence + SHA-256 fingerprint prefix.
const redact = (envs, schema) => Object.fromEntries(ENVS.map(e => [e, Object.fromEntries(Object.entries(envs[e] || {}).map(([k, v]) =>
  [k, isSecret(k, schema) ? { secret: true, present: !!v, fingerprint: v ? fingerprint(v) : null } : { secret: false, value: v }]))]));

export const routes = {
  'GET /api/environments': () => { const { envs, schema } = ctx(); return { environments: redact(envs, schema), schema }; },
  'POST /api/validate': b => { const { envs, schema } = ctx(b); return validate(envs, schema); },
  'POST /api/compare': b => { const { envs, schema } = ctx(b); return { rows: compare(envs, schema) }; },
  'POST /api/generate-env-example': b => { const { envs, schema } = ctx(b); return { content: generateExample(envs, schema) }; },
  'GET /api/report': () => { const r = validate(demo.envs, demo.schema); return { ...r, text: formatReport(r) }; },
  'POST /api/prepush': b => { const { envs, schema } = ctx(b); const r = validate(envs, schema); return { blocked: r.blocked, reasons: r.issues.filter(i => i.severity === 'critical').map(i => i.message) }; },
};

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use('/api', (_q, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
for (const [key, handler] of Object.entries(routes)) {
  const [method, path] = key.split(' ');
  app[method.toLowerCase()](path, (req, res) => res.json(handler(req.body)));
}
app.use(express.static(fileURLToPath(new URL('../../frontend/dist', import.meta.url)))); // after `npm run build` in frontend
const port = process.env.PORT || 4000;
app.listen(port, '127.0.0.1', () => console.log(`EnvSync API: http://localhost:${port}`));
