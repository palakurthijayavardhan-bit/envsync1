import { useCallback, useEffect, useState, type ReactNode } from 'react';

type Issue = { env: string; key: string; severity: 'critical' | 'warning'; code: string; message: string };
type Result = { issues: Issue[]; envStatus: Record<string, { status: string; critical: number; warnings: number }>;
  stats: { total: number; valid: number; missing: number; invalid: number; securityWarnings: number; mismatches: number }; blocked: boolean; health: number };
type Row = { key: string; secret: boolean; values: Record<string, string>; status: string };
type EnvData = { environments: Record<string, Record<string, { secret: boolean; present?: boolean; fingerprint?: string | null; value?: string }>>;
  schema: Record<string, { required?: boolean; type?: string; secret?: boolean }> };

const ENVS = ['local', 'staging', 'production'];
const TABS = ['Dashboard', 'Comparison', 'Schema', 'Report', 'Security', 'Settings'];
const post = <T,>(p: string) => fetch('/api/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.json() as Promise<T>);
const get = <T,>(p: string) => fetch('/api/' + p).then(r => r.json() as Promise<T>);

const tone = (s: string) => ({ valid: 'bg-green-500/15 text-green-400', warning: 'bg-amber-500/15 text-amber-400' } as Record<string, string>)[s.toLowerCase()] ?? 'bg-red-500/15 text-red-400';
const Badge = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(s)}`}>{s}</span>;
const Panel = ({ title, children }: { title?: string; children: ReactNode }) => (
  <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">{title && <h2 className="mb-3 font-semibold">{title}</h2>}{children}</div>);
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-x-auto"><table className="w-full text-left text-sm">
    <thead className="text-gray-400"><tr>{head.map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-[#30363d]">{r.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{c}</td>)}</tr>)}</tbody></table></div>);
const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 text-sm text-gray-400">{label}<div className="mt-1 text-2xl font-bold text-gray-100">{value}</div></div>);

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const [res, setRes] = useState<Result>(); const [rows, setRows] = useState<Row[]>([]);
  const [env, setEnv] = useState<EnvData>(); const [report, setReport] = useState('');
  const [out, setOut] = useState<{ title: string; body: string }>();

  const run = useCallback(async () => {
    const [v, c, e, r] = await Promise.all([post<Result>('validate'), post<{ rows: Row[] }>('compare'), get<EnvData>('environments'), get<{ text: string }>('report')]);
    setRes(v); setRows(c.rows); setEnv(e); setReport(r.text);
  }, []);
  useEffect(() => { run(); }, [run]);

  const gen = async () => setOut({ title: '.env.example', body: (await post<{ content: string }>('generate-env-example')).content });
  const push = async () => { const r = await post<{ blocked: boolean; reasons: string[] }>('prepush');
    setOut({ title: 'EnvSync Validation', body: r.blocked ? r.reasons.map(x => '❌ ' + x).join('\n') + '\n\nPush blocked.' : '✓ Push allowed' }); };

  if (!res || !env) return <div className="p-8 text-gray-400">Loading EnvSync…</div>;
  const s = res.stats;
  return (
    <div className="min-h-screen bg-[#0d1117] text-sm text-gray-200">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#30363d] px-5 py-3">
        <h1 className="flex-1 text-lg font-bold">Env<span className="text-green-400">Sync</span></h1>
        <button onClick={gen} className="rounded-md bg-[#30363d] px-3 py-2 font-semibold">Generate .env.example</button>
        <button onClick={run} className="rounded-md bg-green-700 px-3 py-2 font-semibold text-white">▶ Run Validation</button>
      </header>
      <nav className="flex flex-wrap gap-1 border-b border-[#30363d] px-5 py-2">
        {TABS.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 ${tab === t ? 'bg-[#161b22] text-white' : 'text-gray-400'}`}>{t}</button>)}
      </nav>
      <main className="mx-auto max-w-5xl space-y-4 p-5">
        {tab === 'Dashboard' && <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{ENVS.map(e => <Stat key={e} label={e} value={<Badge s={res.envStatus[e].status} />} />)}</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total variables" value={s.total} /><Stat label="Missing" value={s.missing} /><Stat label="Invalid" value={s.invalid} />
            <Stat label="Security warnings" value={s.securityWarnings} /><Stat label="Health" value={res.health + '%'} /></div>
          <Panel title="Issues">{res.issues.length ? res.issues.map((i, n) => (
            <div key={n} className="flex items-center gap-2 border-t border-[#30363d] py-2 first:border-0">
              <span>{i.severity === 'critical' ? '❌' : '⚠'}</span><b>{i.key}</b><span className="flex-1 text-gray-400">{i.message}</span>
              <Badge s={i.severity === 'critical' ? 'Error' : 'Warning'} /></div>)) : '✓ No issues'}</Panel>
          <button onClick={push} className="rounded-md bg-red-700 px-3 py-2 font-semibold text-white">Simulate git push</button></>}
        {tab === 'Comparison' && <Panel title="Environment comparison"><Table head={['Variable', 'Local', 'Staging', 'Production', 'Status']}
          rows={rows.map(r => [<b>{r.key}</b>, ...ENVS.map(e => r.values[e] === 'Missing' ? <Badge s="Missing" /> : r.values[e]), <Badge s={r.status} />])} /></Panel>}
        {tab === 'Schema' && <Panel title="Configuration schema"><Table head={['Variable', 'Required', 'Type', 'Secret']}
          rows={Object.entries(env.schema).map(([k, d]) => [k, String(d.required), d.type ?? '', String(d.secret)])} /></Panel>}
        {tab === 'Report' && <Panel title="Validation report"><pre className="overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3">{report}</pre></Panel>}
        {tab === 'Security' && <Panel title="Secrets (values never leave the server)"><Table head={['Variable', ...ENVS]}
          rows={Object.keys(env.schema).filter(k => env.schema[k].secret).map(k => [k, ...ENVS.map(e => { const x = env.environments[e][k];
            return x?.present ? `🔒 present · fp:${x.fingerprint}` : <Badge s="Missing" />; })])} />
          <p className="mt-3 text-gray-400">Identical fingerprints in two environments reveal secret reuse without revealing the secret.</p></Panel>}
        {tab === 'Settings' && <Panel title="Settings"><ul className="list-disc space-y-1 pl-5 text-gray-400">
          <li>API binds to 127.0.0.1 only; responses are sent with Cache-Control: no-store.</li>
          <li>POST any route with {'{ envs, schema }'} to validate your own data.</li><li>Use the CLI in CI so raw values never leave the machine.</li></ul></Panel>}
        {out && <Panel title={out.title}><pre className="overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3">{out.body}</pre></Panel>}
      </main>
    </div>);
}
