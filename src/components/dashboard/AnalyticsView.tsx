import { useMemo, useState } from 'react';
import { useTraceStore } from '../../store/traceStore';
import { computeStudioAnalytics } from '../../lib/analytics';
import { formatDuration, formatTokens } from '../../lib/formatters';
import { Activity, CheckCircle2, XCircle, Zap, Clock, AlertOctagon, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../common/Badge';
import { getRunSelectionFields, RunSelection, selectAnalyticsRuns } from '../../lib/runSelection';

export function AnalyticsView() {
  const { runs, selectRun, setActiveTab, setImportModalOpen } = useTraceStore();
  const [selection, setSelection] = useState<RunSelection>({});
  const selectedRuns = useMemo(() => selectAnalyticsRuns(runs, selection), [runs, selection]);
  const options = useMemo(() => ({
    source: [...new Set(runs.map(run => getRunSelectionFields(run).source))],
    model: [...new Set(runs.map(run => getRunSelectionFields(run).model))],
    tag: [...new Set(runs.flatMap(run => run.tags?.length ? run.tags : [null]))],
  }), [runs]);

  const analytics = useMemo(() => {
    return computeStudioAnalytics(selectedRuns);
  }, [selectedRuns]);

  const handleInspectStepRun = (runId: string) => {
    selectRun(runId);
    setActiveTab('explorer');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-studio-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          <span>Execution Performance Analytics</span>
        </h2>
        <p className="text-xs text-studio-400 mt-0.5">
          Calculated from {analytics.totalRuns} selected agent executions. Run status does not establish task acceptance or reliability. Mixed demos, tasks and providers are not a controlled research cohort.
        </p>
      </div>

      <section aria-label="Analytics run selection" className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 space-y-3">
        <p role="status" className="text-sm text-studio-200">{selectedRuns.length} selected / {runs.length} available runs</p>
        <p className="text-xs text-studio-400">Selection stays in this browser. Recognized synthetic examples are excluded by default. Source and model are reported by the imported trace.</p>
        <div className="flex flex-wrap items-end gap-3">
          {(['source', 'model', 'tag'] as const).map(field => (
            <label key={field} className="text-xs text-studio-300 flex flex-col gap-1">
              {field === 'source' ? 'Source' : field === 'model' ? 'Model' : 'Tag'}
              <select
                aria-label={`Analytics ${field}`}
                className="bg-studio-950 border border-studio-700 rounded px-2 py-2 max-w-full"
                value={selection[field] === undefined ? '' : JSON.stringify(selection[field])}
                onChange={event => setSelection(current => ({ ...current, [field]: event.target.value === '' ? undefined : JSON.parse(event.target.value) }))}
              >
                <option value="">All {field === 'source' ? 'sources' : field === 'model' ? 'models' : 'tags'}</option>
                {options[field].map(value => <option key={JSON.stringify(value)} value={JSON.stringify(value)}>
                  {value === null ? (field === 'source' ? 'TraceLens JSON (source unreported)' : field === 'model' ? 'Unknown model' : 'No tags') : field === 'source' ? `Source-reported: ${value}` : value}
                </option>)}
              </select>
            </label>
          ))}
          <label className="text-xs text-studio-300 flex items-center gap-2 py-2">
            <input type="checkbox" checked={!!selection.includeExamples} onChange={event => setSelection(current => ({ ...current, includeExamples: event.target.checked }))} />
            Include synthetic examples
          </label>
          <button className="text-xs text-cyan-300 border border-studio-700 rounded px-3 py-2" onClick={() => setSelection({})}>Reset selection</button>
        </div>
        {selectedRuns.length === 0 && <div className="text-sm text-studio-300 space-y-2">
          <p>No runs selected. Reset filters, include synthetic examples, or import a trace to calculate analytics.</p>
          <button className="text-cyan-300 underline" onClick={() => setImportModalOpen(true)}>Import a trace</button>
        </div>}
      </section>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-studio-400 mb-2">
            <span className="text-xs font-medium">Total Runs</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-studio-100">{analytics.totalRuns}</div>
            <div className="text-[11px] text-studio-500 mt-1 flex items-center gap-1">
              <span>{analytics.successCount} reported successful</span> · 
              <span className="text-rose-400">{analytics.failureCount} failed</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-studio-400 mb-2">
            <span className="text-xs font-medium">Successful Run Status</span>
            {analytics.successRate >= 80 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-studio-100">{selectedRuns.length ? `${analytics.successRate}%` : 'Unknown'}</div>
            <div className="w-full bg-studio-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full ${analytics.successRate >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                style={{ width: `${analytics.successRate}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-studio-400 mb-2">
            <span className="text-xs font-medium">Total Tokens</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-studio-100">{selectedRuns.length ? formatTokens(analytics.totalTokens) : 'Unknown'}</div>
            <div className="text-[11px] text-studio-500 mt-1">Prompt & completion</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-studio-400 mb-2">
            <span className="text-xs font-medium">Avg Execution Time</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-studio-100">{!selectedRuns.length || analytics.avgDurationMs === undefined ? 'Unknown' : formatDuration(analytics.avgDurationMs)}</div>
            <div className="text-[11px] text-studio-500 mt-1">Wall-clock latency</div>
          </div>
        </div>
      </div>

      {/* 2-Column Section: Bottlenecks & Failure Categorization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Longest Steps */}
        <div className="p-5 rounded-xl border border-studio-800 bg-studio-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-studio-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Execution Bottlenecks (Longest Steps)</span>
            </h3>
            <span className="text-[11px] font-mono text-studio-500">Ranked by latency</span>
          </div>

          {analytics.longestSteps.length === 0 ? (
            <p className="text-xs text-studio-500 py-4 text-center">No steps with complete timing evidence</p>
          ) : (
            <div className="space-y-2.5">
              {analytics.longestSteps.map((step, idx) => (
                <div
                  key={`${step.runId}-${step.stepId}-${idx}`}
                  onClick={() => handleInspectStepRun(step.runId)}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-studio-800/80 bg-studio-950/60 hover:bg-studio-850 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="font-mono text-xs font-bold text-studio-500 w-4">#{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-studio-200 truncate">{step.stepName}</div>
                      <div className="text-[10px] text-studio-400 truncate">{step.runName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={step.status} size="sm" />
                    <span className="font-mono text-xs font-semibold text-studio-200 bg-studio-900 px-2 py-0.5 rounded border border-studio-800">
                      {formatDuration(step.durationMs)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Failure Breakdown */}
        <div className="p-5 rounded-xl border border-studio-800 bg-studio-900/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-studio-200 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Failure Causes & Error Codes</span>
            </h3>
            <span className="text-[11px] font-mono text-studio-500">Grouped by code</span>
          </div>

          {Object.keys(analytics.failureTypes).length === 0 ? (
            <div className="p-8 text-center text-studio-500 text-xs">
              <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500/50 mb-1" />
              {selectedRuns.length ? 'No failures recorded across selected traces' : 'No selected traces to inspect for failures'}
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(analytics.failureTypes).map(([category, count]) => (
                <div
                  key={category}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-rose-950/50 bg-rose-950/10 text-xs"
                >
                  <span className="font-mono text-rose-300 font-medium truncate pr-2">{category}</span>
                  <span className="px-2 py-0.5 font-mono font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {count} {count === 1 ? 'incident' : 'incidents'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
