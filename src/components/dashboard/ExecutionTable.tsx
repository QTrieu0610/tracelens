import React from 'react';
import { Search, Trash2, ArrowRight, GitCompare, AlertTriangle, Layers, Calendar } from 'lucide-react';
import { useTraceStore, StatusFilter } from '../../store/traceStore';
import { StatusBadge } from '../common/Badge';
import { formatDateShort, formatTokens } from '../../lib/formatters';
import { formatRunDuration, getRunDuration, getRunStatusLabel, isSyntheticDemo } from '../../lib/runEvidence';
import { parseTraceImport } from '../../lib/importTrace';
import { LocalCaptures } from './LocalCaptures';
import { LocalEvaluations } from './LocalEvaluations';
import { supportsLocalDiscovery } from '../../lib/localService';

export function ExecutionTable() {
  const {
    runs,
    selectRun,
    deleteRunById,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    setActiveTab,
    setComparisonRunId,
    setImportModalOpen,
    importTrace,
    importComparison
  } = useTraceStore();
  const [exampleError, setExampleError] = React.useState('');
  const [loadingExamples, setLoadingExamples] = React.useState(false);
  const loadExamples = async (names: string[]) => {
    setLoadingExamples(true); setExampleError('');
    try {
      const examples = await Promise.all(names.map(async name => {
        const response = await fetch(`./examples/${name}`);
        if (!response.ok) throw new Error('Example file could not be loaded');
        const parsed = parseTraceImport(await response.text(), name);
        if (!parsed.valid || !parsed.trace) throw new Error('Example file could not be parsed');
        return { ...parsed.trace, metadata: { ...parsed.trace.metadata, syntheticDemo: true } };
      }));
      if (examples.length === 2) importComparison(examples[0], examples[1]);
      else importTrace(examples[0]);
    } catch { setExampleError('Could not load examples. Try importing the files from public/examples manually.'); }
    finally { setLoadingExamples(false); }
  };

  const filteredRuns = React.useMemo(() => {
    return runs.filter((run) => {
      // Status filter
      if (statusFilter !== 'all' && run.status !== statusFilter) {
        return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = run.name.toLowerCase().includes(query);
        const matchesAgent = run.agentName.toLowerCase().includes(query);
        const matchesModel = run.model.toLowerCase().includes(query);
        const matchesTag = run.tags?.some(t => t.toLowerCase().includes(query));
        return matchesName || matchesAgent || matchesModel || matchesTag;
      }
      return true;
    });
  }, [runs, searchTerm, statusFilter]);

  const handleInspect = (runId: string) => {
    selectRun(runId);
    setActiveTab('explorer');
  };

  const handleCompareWith = (runId: string) => {
    setComparisonRunId(runId);
    setActiveTab('comparison');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-800/50 bg-cyan-950/10 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-studio-100">Start with a sample, your logs, or an evaluation</h2>
        <p className="text-sm text-studio-300">See what the agent did, find failures and compare results. Your imported data stays in this browser.</p>
        <div className="grid gap-3 md:grid-cols-3 pt-2">
          <div className="rounded-lg border border-studio-700 p-3 space-y-2"><h3 className="text-sm font-semibold text-studio-100">1. Try a sample</h3><p className="text-xs text-studio-400">Start here to explore a comparison. No account, Python or API key needed.</p>
          <button onClick={() => loadExamples(['codex-before.jsonl', 'codex-after.jsonl'])} disabled={loadingExamples} className="rounded-lg px-3 py-2 bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500 disabled:opacity-50">{loadingExamples ? 'Loading examples…' : 'Try sanitized Codex examples'}</button>
          <button onClick={() => loadExamples(['pydantic-evals-baseline.json', 'pydantic-evals-regressed.json'])} disabled={loadingExamples} className="rounded-lg border border-studio-700 px-3 py-2 text-xs text-studio-200 hover:bg-studio-800 disabled:opacity-50">Try Pydantic Evals comparison</button>
          </div>
          <div className="rounded-lg border border-studio-700 p-3 space-y-2"><h3 className="text-sm font-semibold text-studio-100">2. Inspect your logs</h3><p className="text-xs text-studio-400">Open Codex, Claude Code, Gemini CLI, AGY or TraceLens JSON files. Find a failed step and inspect its output.</p>
          <button onClick={() => setImportModalOpen(true)} className="rounded-lg px-3 py-2 bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-500">Import your logs</button>
          </div>
          <div className="rounded-lg border border-studio-700 p-3 space-y-2"><h3 className="text-sm font-semibold text-studio-100">3. {supportsLocalDiscovery(window.location.hostname) ? 'Run an evaluation' : 'View evaluation results'}</h3><p className="text-xs text-studio-400">{supportsLocalDiscovery(window.location.hostname) ? 'Run 20 synthetic cases locally, then compare output correctness, tool order and call budgets.' : 'Import exported results to compare correctness, tool order and call budgets. Python runs in the local app.'}</p><a href="#local-evaluations" className="inline-block rounded-lg border border-studio-700 px-3 py-2 text-xs text-cyan-300">Show evaluation setup</a></div>
        </div>
        <details className="text-xs text-studio-400"><summary className="cursor-pointer py-2">More sample formats</summary><div className="flex flex-wrap gap-2">
          {['Claude Code', 'Gemini CLI'].map((name, i) => <button key={name} onClick={() => loadExamples([i === 0 ? 'claude-synthetic.jsonl' : 'gemini-synthetic.jsonl'])} disabled={loadingExamples} className="rounded-lg border border-studio-700 px-3 py-2 text-xs text-studio-200 hover:bg-studio-800 disabled:opacity-50">Try {name} example</button>)}
        </div></details>
        {exampleError && <p role="alert" className="text-xs text-rose-300">{exampleError}</p>}
      </div>
      <LocalEvaluations />
      <LocalCaptures />
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-studio-500" />
          <input
            data-testid="search-input"
            type="text"
            placeholder="Search by run name, agent, model, or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-studio-900 border border-studio-800 rounded-lg text-studio-100 placeholder:text-studio-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(['all', 'success', 'failed'] as StatusFilter[]).map((tab) => (
            <button
              key={tab}
              data-testid={`filter-${tab}`}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                statusFilter === tab
                  ? 'bg-studio-800 text-cyan-400 border border-studio-700'
                  : 'text-studio-400 hover:text-studio-200 hover:bg-studio-900'
              }`}
            >
              {tab === 'all' ? `All (${runs.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Runs Table */}
      {filteredRuns.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-studio-800 rounded-xl bg-studio-900/20">
          <Layers className="w-8 h-8 mx-auto text-studio-600 mb-2" />
          <p className="text-sm font-medium text-studio-300">No matching executions found</p>
          <p className="text-xs text-studio-500 mt-1">Try adjusting your filters or import a new trace</p>
          <button
            onClick={() => setImportModalOpen(true)}
            className="mt-4 px-3 py-1.5 text-xs font-medium bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
          >
            Import Trace JSON
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-studio-800 bg-studio-900/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-studio-800 bg-studio-950/80 text-studio-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Execution Name & Agent</th>
                <th className="py-3 px-4">Model</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Steps / Failures</th>
                <th className="py-3 px-4">Tokens</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-studio-850">
              {filteredRuns.map((run) => {
                const failureCount = run.steps?.filter(s => s.status === 'failed').length || 0;
                return (
                  <tr
                    key={run.runId}
                    data-testid={`run-row-${run.runId}`}
                    className="hover:bg-studio-850/50 transition-colors group cursor-pointer"
                    onClick={() => handleInspect(run.runId)}
                  >
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={run.status} label={getRunStatusLabel(run)} size="sm" />
                      {isSyntheticDemo(run) && <span className="block text-xs text-amber-300 mt-1">Synthetic demo</span>}
                    </td>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-semibold text-studio-100 truncate group-hover:text-cyan-400 transition-colors">
                        {run.name}
                      </div>
                      <div className="text-[11px] text-studio-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-cyan-300/80">{run.agentName}</span>
                        {run.tags && run.tags.length > 0 && (
                          <div className="flex gap-1">
                            {run.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.2 rounded bg-studio-800 text-studio-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-studio-300">
                      {run.model}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-studio-200">
                      {formatRunDuration(run)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      <span className="text-studio-200">{run.steps?.length || 0} steps</span>
                      {failureCount > 0 && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded text-[11px]">
                          <AlertTriangle className="w-3 h-3" />
                          {failureCount} fail
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-studio-400">
                      {formatTokens(run.totalTokens?.totalTokens)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-studio-400 flex items-center gap-1.5 mt-3">
                      <Calendar className="w-3.5 h-3.5 text-studio-500" />
                      <span>{getRunDuration(run) === undefined ? 'Unknown' : formatDateShort(run.startedAt)}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          data-testid={`inspect-run-${run.runId}`}
                          onClick={() => handleInspect(run.runId)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-studio-800 hover:bg-studio-700 text-studio-200 rounded-md transition-colors"
                          title="Inspect trace"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <button
                          data-testid={`compare-run-${run.runId}`}
                          onClick={() => handleCompareWith(run.runId)}
                          className="p-1.5 text-studio-400 hover:text-cyan-400 hover:bg-studio-800 rounded-md transition-colors"
                          title="Compare with another run"
                        >
                          <GitCompare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          data-testid={`delete-run-${run.runId}`}
                          onClick={() => deleteRunById(run.runId)}
                          className="p-1.5 text-studio-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                          title="Delete run"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
