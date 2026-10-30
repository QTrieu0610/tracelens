import { useEffect, useState } from 'react';
import { useTraceStore } from '../../store/traceStore';
import { parseTraceImport } from '../../lib/importTrace';
import { computeRunComparison } from '../../lib/analytics';

interface Evaluation { id: string; name: string; createdAt: string; synthetic: boolean }

export function LocalEvaluations() {
  const { importComparison } = useTraceStore();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  const [serviceError, setServiceError] = useState('');
  const [unreadable, setUnreadable] = useState(0);
  const [opening, setOpening] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let detected = available;
    const fetchResults = async () => {
      try {
        const response = await fetch('./api/evals', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Local evaluation service unavailable. Start the app with npm start, or import your result files.');
        const data = await response.json();
        if (data.service !== 'tracelens-local-v1' || !Array.isArray(data.evaluations)) throw new Error('Could not read local evaluation results.');
        if (stopped) return;
        const valid = data.evaluations.filter((entry: Evaluation) => entry && typeof entry.id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(entry.id) && typeof entry.name === 'string' && typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt)));
        detected = true; setAvailable(true); setEvaluations(valid); setUnreadable((data.unreadable || 0) + data.evaluations.length - valid.length); setServiceError('');
      } catch (e) {
        if (!stopped && detected) setServiceError((e as Error).message);
      } finally { if (!stopped) setLoading(false); }
    };
    setLoading(true);
    void fetchResults();
    const timer = window.setInterval(fetchResults, 5000);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); };
  }, [refresh]);

  const open = async (evaluation: Evaluation) => {
    setOpening(evaluation.id); setError('');
    try {
      const results = await Promise.all(['baseline', 'regressed'].map(async kind => {
        const response = await fetch(`./api/evals/${encodeURIComponent(evaluation.id)}/${kind}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not open these results. Refresh the list and retry; original files remain on disk.');
        const parsed = parseTraceImport(await response.text());
        if (!parsed.valid || !parsed.trace) throw new Error(`Invalid evaluation trace: ${parsed.errors.map(e => e.message).join(' ')}`);
        return parsed.trace;
      }));
      if (!results.every(r => r.metadata?.evaluation) || results[0].runId === results[1].runId || computeRunComparison(results[0], results[1]).alignment !== 'milestone') throw new Error('These results do not contain a compatible baseline and candidate. No results were imported.');
      importComparison(results[0], results[1]);
    } catch (e) { setError((e as Error).message); }
    finally { setOpening(''); }
  };

  return <section id="local-evaluations" aria-label="Local evaluations" className="rounded-xl border border-studio-700 bg-studio-900 p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-studio-100">Local evaluations</h2>
      <button onClick={() => setRefresh(n => n + 1)} disabled={loading} className="rounded border border-studio-700 px-3 py-2 text-xs text-studio-200 disabled:opacity-50">{loading ? 'Checking…' : 'Refresh evaluations'}</button>
    </div>
    <p className="text-xs text-studio-300">Run the evaluation demo in another terminal, then open its comparison here. New results appear automatically.</p>
    <pre className="overflow-x-auto rounded bg-studio-950 p-3 text-xs text-cyan-300"><code>npm run evals</code></pre>
    <p className="text-xs text-studio-400">20 synthetic cases · no model calls · Python 3.11+ required to run. The first run installs dependencies; viewing sample results needs no Python.</p>
    {!loading && !available && <p className="text-xs text-studio-300">Automatic discovery is available with npm start or the installed tracelens app. On a static site, import your evaluation JSON files.</p>}
    {available && !evaluations.length && <p className="text-xs text-studio-300">No completed evaluations yet. Run the command above, or try the sample comparison.</p>}
    {evaluations.slice(0, 20).map(evaluation => <div key={evaluation.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-studio-800 pt-3 text-xs">
      <div><p className="font-medium text-studio-200">{evaluation.name}</p><p className="text-studio-400">{new Date(evaluation.createdAt).toLocaleString()}{evaluation.synthetic ? ' · Synthetic demo' : ''}</p></div>
      <button onClick={() => open(evaluation)} disabled={!!opening} className="rounded border border-studio-600 px-3 py-2 text-cyan-300 disabled:opacity-50">{opening === evaluation.id ? 'Opening…' : 'Open comparison'}</button>
    </div>)}
    {evaluations.length > 20 && <p className="text-xs text-studio-400">Showing the 20 newest evaluations. All files remain on disk.</p>}
    {unreadable > 0 && <p className="text-xs text-amber-300">{unreadable} incomplete or unreadable evaluation folders were skipped. Original files remain on disk.</p>}
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
    {serviceError && <p role="alert" className="text-xs text-rose-300">{serviceError}</p>}
    <details className="text-xs text-studio-400"><summary className="cursor-pointer">Installed app or custom data directory?</summary><p className="mt-2">With the installed app, use <code>tracelens eval demo</code>. If the viewer uses --data-dir, pass the same option before eval demo. The browser reads results; it never starts Python or an agent.</p></details>
  </section>;
}
