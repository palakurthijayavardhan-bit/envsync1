import { createHash } from 'node:crypto';
export const ENVS = ['local', 'staging', 'production'];
const label = e => e[0].toUpperCase() + e.slice(1);
export const SECRET_RE = /(API_?KEY|SECRET|PASSWORD|TOKEN|PRIVATE_?KEY|DATABASE_URL)/i;
const PLAIN = /(sk_(live|test)_|AKIA[0-9A-Z]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY)/;
export const isSecret = (k, schema = {}) => schema[k]?.secret ?? SECRET_RE.test(k);
export const fingerprint = v => createHash('sha256').update(String(v)).digest('hex').slice(0, 8);

export function parseEnv(text) {
  const o = {};
  for (const l of text.split(/\r?\n/)) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return o;
}
export function parseSchema(text) {
  const s = {}; let k, m;
  for (const l of text.split(/\r?\n/)) {
    if ((m = l.match(/^([A-Za-z_]\w*):\s*$/))) { k = m[1]; s[k] = {}; }
    else if (k && (m = l.match(/^\s+(\w+):\s*(\S+)/))) s[k][m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : m[2];
  }
  return s;
}
export function checkType(type, v) {
  switch (type) {
    case 'number': return v.trim() !== '' && !Number.isNaN(Number(v));
    case 'boolean': return /^(true|false)$/i.test(v);
    case 'url': try { new URL(v); return true; } catch { return false; }
    default: return true;
  }
}
// Docker Compose: list (- KEY / - KEY=val) or map (KEY: val) under `environment:`. Bare keys = inherited.
export function parseCompose(text) {
  const o = {}; let inEnv = false, indent = 0;
  for (const l of text.split(/\r?\n/)) {
    const ind = l.match(/^\s*/)[0].length;
    if (/^\s*environment:\s*$/.test(l)) { inEnv = true; indent = ind; continue; }
    if (!inEnv || !l.trim()) continue;
    if (ind <= indent) { inEnv = false; continue; }
    const m = l.match(/^\s*-?\s*([A-Za-z_]\w*)\s*(?:[=:]\s*(.*))?$/);
    if (m) o[m[1]] = (m[2] || '').replace(/^["']|["']$/g, '') || '<inherited>';
  }
  return o;
}
// Kubernetes: ConfigMap data, Secret keys (values discarded immediately), container env names.
export function parseK8s(text) {
  const o = {};
  for (const doc of text.split(/^---\s*$/m)) {
    const kind = (doc.match(/^kind:\s*(\w+)/m) || [])[1]; let inData = false;
    for (const l of doc.split(/\r?\n/)) {
      if (/^(data|stringData):\s*$/.test(l)) { inData = true; continue; }
      if (/^\S/.test(l)) inData = false;
      let m;
      if (inData && (m = l.match(/^\s+([A-Za-z_]\w*):\s*(.*)$/))) o[m[1]] = kind === 'Secret' ? '<redacted>' : m[2].replace(/^["']|["']$/g, '');
      else if ((m = l.match(/^\s*-\s*name:\s*([A-Za-z_]\w*)\s*$/))) o[m[1]] ??= '<ref>';
    }
  }
  return o;
}

export function validate(envs, schema = {}) {
  const keys = [...new Set([...Object.keys(schema), ...ENVS.flatMap(e => Object.keys(envs[e] || {}))])].sort();
  const issues = [];
  const add = (env, key, severity, code, message) => issues.push({ env, key, severity, code, message });
  for (const k of keys) {
    const def = schema[k] || {}, secret = isSecret(k, schema);
    const present = ENVS.filter(e => envs[e]?.[k]);
    for (const e of ENVS) {
      const v = envs[e]?.[k];
      if (!v) { if (def.required || present.length) add(e, k, def.required ? 'critical' : 'warning', 'missing', `${k} missing in ${label(e)}`); continue; }
      if (def.type && !checkType(def.type, v)) add(e, k, 'critical', 'invalid', `${k} must be a ${def.type}`);
      if (!secret && PLAIN.test(v)) add(e, k, 'warning', 'plaintext-secret', `${k} looks like a plaintext secret; mark it secret: true`);
    }
    const [s, p] = [envs.staging?.[k], envs.production?.[k]];
    if (secret && s && p && fingerprint(s) === fingerprint(p)) add('production', k, 'warning', 'secret-reuse', `${k} is identical in Staging and Production (fingerprint match)`);
  }
  const envStatus = {};
  for (const e of ENVS) {
    const mine = issues.filter(i => i.env === e), critical = mine.filter(i => i.severity === 'critical').length, warnings = mine.length - critical;
    envStatus[e] = { status: critical ? 'error' : warnings ? 'warning' : 'valid', critical, warnings };
  }
  const bad = new Set(issues.map(i => i.key));
  const stats = { total: keys.length, valid: keys.length - bad.size,
    missing: issues.filter(i => i.code === 'missing').length, invalid: issues.filter(i => i.code === 'invalid').length,
    securityWarnings: issues.filter(i => ['plaintext-secret', 'secret-reuse'].includes(i.code)).length,
    mismatches: keys.filter(k => new Set(ENVS.map(e => envs[e]?.[k] ? 'y' : 'n')).size > 1).length };
  const blocked = issues.some(i => i.severity === 'critical');
  const health = Math.max(0, Math.round(100 - issues.reduce((n, i) => n + (i.severity === 'critical' ? 20 : 5), 0)));
  return { issues, envStatus, stats, blocked, health };
}

// Never returns raw secret values: secrets are shown as presence only.
export function compare(envs, schema = {}) {
  const { issues } = validate(envs, schema);
  const keys = [...new Set([...Object.keys(schema), ...ENVS.flatMap(e => Object.keys(envs[e] || {}))])].sort();
  return keys.map(key => {
    const secret = isSecret(key, schema), mine = issues.filter(i => i.key === key);
    const values = Object.fromEntries(ENVS.map(e => { const v = envs[e]?.[key]; return [e, !v ? 'Missing' : secret ? '[SECRET PRESENT]' : v]; }));
    return { key, secret, values, status: mine.some(i => i.severity === 'critical') ? 'Error' : mine.length ? 'Warning' : 'Valid' };
  });
}
export function generateExample(envs, schema = {}) {
  const keys = [...new Set([...Object.keys(schema), ...ENVS.flatMap(e => Object.keys(envs[e] || {}))])].sort();
  return keys.map(k => `${k}=`).join('\n') + '\n';
}
export function formatReport(r) {
  const tag = s => s.status === 'valid' ? '✓ Valid' : s.critical ? `❌ ${s.critical} critical error${s.critical > 1 ? 's' : ''}` : `⚠ ${s.warnings} warnings`;
  const L = ['ENVIRONMENT VALIDATION REPORT', ''];
  for (const e of ENVS) L.push(`${(label(e) + ':').padEnd(12)}${tag(r.envStatus[e])}`);
  L.push('', `Total Variables: ${r.stats.total}`, `Valid: ${r.stats.valid}`, `Missing: ${r.stats.missing}`, `Invalid: ${r.stats.invalid}`, `Security warnings: ${r.stats.securityWarnings}`, `Mismatched: ${r.stats.mismatches}`);
  const c = r.issues.filter(i => i.severity === 'critical'), w = r.issues.filter(i => i.severity !== 'critical');
  if (c.length) L.push('', 'Critical Issues:', ...c.map(i => `❌ ${i.message}`));
  if (w.length) L.push('', 'Warnings:', ...w.map(i => `⚠ ${i.message}`));
  return L.join('\n');
}
