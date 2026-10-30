import { useEffect, useState } from 'react';
import { useTraceStore } from '../../store/traceStore';
import { LocalCapture, parseLocalCapture } from '../../lib/localCapture';

export function LocalCaptures() {
  const { importTrace } = useTraceStore();
  const [available, setAvailable] = useState(false);
  const [runs, setRuns] = useState<LocalCapture[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');
  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    let detected = false;
    const refresh = async () => {
      try {
        const response = await fetch('./api/runs', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
          if (detected && !stopped) setError('Local capture service is unavailable. Imported runs remain saved in this browser.');
          return;
        }
        const data = await response.json();
        if (data.service !== 'tracelens-local-v1' || !Array.isArray(data.runs) || stopped) return;
        detected = true;
        setAvailable(true); setRuns(data.runs); setUnreadable(data.unreadable || 0);
      } catch {
        if (!stopped && detected) setError('Local capture service is unavailable. Imported runs remain saved in this browser.');
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); };
  }, []);

  const open = async (capture: LocalCapture) => {
    setOpening(capture.id); setError('');
    try {
      const response = await fetch(`./api/runs/${encodeURIComponent(capture.id)}/stdout`, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 413 ? 'Log exceeds the 10 MB viewer limit. The original file remains saved on disk.' : 'Could not read this log. The agent may still be writing it; retry when it finishes.');
      importTrace(parseLocalCapture(await response.text(), capture));
    } catch (e) { setError((e as Error).message); }
    finally { setOpening(''); }
  };

  if (!available) return null;
  return <section aria-label="Local agent captures" className="rounded-xl border border-studio-700 bg-studio-900 p-4 space-y-3">
    <h2 className="text-sm font-semibold text-studio-100">Local agent captures</h2>
    <p className="text-xs text-studio-300">Run an agent in your project terminal. Captures appear here automatically; choose Open trace to inspect one.</p>
    <details className="text-xs text-studio-400"><summary className="cursor-pointer">How to capture an agent run</summary>
      <p className="mt-2">From this source checkout:</p><pre className="overflow-x-auto rounded bg-studio-950 p-3 text-xs text-cyan-300"><code>npm run capture -- codex -- --sandbox read-only "Review this project"</code></pre>
      <p>With the installed app: <code>tracelens run codex -- --sandbox read-only "Review this project"</code></p>
      <p>Uses your installed agent and account. Raw logs stay on this computer and may contain secrets. Process completion does not verify task correctness.</p>
    </details>
    {!runs.length && <p className="text-xs text-studio-300">No captures yet. You can also import an existing log below.</p>}
    {runs.length > 20 && <p className="text-xs text-studio-400">Showing the 20 newest captures. All files remain saved on disk.</p>}
    {runs.slice(0, 20).map(run => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-studio-800 pt-3 text-xs">
      <div className="space-y-1">
        <p className="font-medium text-studio-200">{run.provider} · {new Date(run.startedAt).toLocaleString()}</p>
        <p className={run.status === 'failed' ? 'text-rose-300' : 'text-studio-400'}>{run.status === 'failed' ? `Process failed (exit ${run.exitCode ?? 'unknown'})` : run.status === 'running' ? 'In progress or interrupted' : 'Process finished · task correctness unverified'}</p>
        {run.error && <p className="text-rose-300 max-w-xl break-words">{run.error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <a href={`./api/runs/${encodeURIComponent(run.id)}/stderr`} target="_blank" rel="noreferrer" className="text-studio-300 underline">View stderr</a>
        <button onClick={() => open(run)} disabled={!!opening || !run.bytes || run.bytes > 10 * 1024 * 1024} className="rounded border border-studio-600 px-3 py-2 text-cyan-300 hover:bg-studio-800 disabled:opacity-50">{opening === run.id ? 'Opening…' : run.bytes > 10 * 1024 * 1024 ? 'Log exceeds 10 MB' : 'Open trace'}</button>
      </div>
    </div>)}
    {unreadable > 0 && <p className="text-xs text-amber-300">{unreadable} capture{unreadable === 1 ? '' : 's'} could not be read. Original files have been preserved.</p>}
    {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
  </section>;
}
