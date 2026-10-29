import { useState } from 'react';
import { ReportPreview } from './ReportPreview';
import { formatRunDuration, getAcceptance, getRunDuration, getRunStatusLabel, isSyntheticDemo } from '../../lib/runEvidence';
import { useTraceStore } from '../../store/traceStore';
import { GitCompare, Clock, Zap, Layers, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../common/Badge';
import { formatDuration, formatTokens } from '../../lib/formatters';

export function ComparisonView() {
  const [reportOpen, setReportOpen] = useState(false);
  const {
    runs,
    activeRun,
    comparisonRun,
    comparisonResult,
    selectRun,
    setComparisonRunId
  } = useTraceStore();

  if (runs.length < 2) {
    return (
      <div className="p-12 text-center border border-dashed border-studio-800 rounded-xl bg-studio-900/30">
        <GitCompare className="w-10 h-10 mx-auto text-studio-600 mb-3" />
        <h3 className="text-sm font-semibold text-studio-200 mb-1">Need at least 2 runs to compare</h3>
        <p className="text-xs text-studio-400 max-w-sm mx-auto">
          Import another trace or use the demo datasets to perform regression analysis and side-by-side diffing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {comparisonResult && <button onClick={() => setReportOpen(true)} className="px-3 py-2 text-sm border border-studio-700 rounded-lg text-cyan-300">Preview Markdown report</button>}
      {reportOpen && comparisonResult && <ReportPreview comparison={comparisonResult} onClose={() => setReportOpen(false)} />} 
      {/* Run Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Run A (Baseline) */}
        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 space-y-2">
          <label className="text-xs font-mono uppercase text-studio-400 tracking-wider">
            Baseline Execution (Run A)
          </label>
          <select
            value={activeRun?.runId || ''}
            onChange={(e) => selectRun(e.target.value)}
            className="w-full p-2.5 text-xs bg-studio-950 border border-studio-800 rounded-lg text-studio-100 focus:outline-none focus:border-cyan-500"
          >
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.name} — {getRunStatusLabel(r)} ({formatRunDuration(r)})
              </option>
            ))}
          </select>
          {activeRun && (
            <div className="flex items-center gap-2 pt-1 text-xs">
              <StatusBadge status={activeRun.status} label={getRunStatusLabel(activeRun)} size="sm" />
              {isSyntheticDemo(activeRun) && <span className="text-amber-300 text-xs">Synthetic demo</span>}
              <span className="font-mono text-studio-300">{activeRun.model}</span>
              <span className="text-studio-500">·</span>
              <span className="font-mono text-studio-300">{activeRun.steps?.length || 0} steps</span>
            </div>
          )}
        </div>

        {/* Run B (Target) */}
        <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/60 space-y-2">
          <label className="text-xs font-mono uppercase text-studio-400 tracking-wider">
            Comparison Execution (Run B)
          </label>
          <select
            value={comparisonRun?.runId || ''}
            onChange={(e) => setComparisonRunId(e.target.value)}
            className="w-full p-2.5 text-xs bg-studio-950 border border-studio-800 rounded-lg text-studio-100 focus:outline-none focus:border-cyan-500"
          >
            {runs.map((r) => (
              <option key={r.runId} value={r.runId}>
                {r.name} — {getRunStatusLabel(r)} ({formatRunDuration(r)})
              </option>
            ))}
          </select>
          {comparisonRun && (
            <div className="flex items-center gap-2 pt-1 text-xs">
              <StatusBadge status={comparisonRun.status} label={getRunStatusLabel(comparisonRun)} size="sm" />
              {isSyntheticDemo(comparisonRun) && <span className="text-amber-300 text-xs">Synthetic demo</span>}
              <span className="font-mono text-studio-300">{comparisonRun.model}</span>
              <span className="text-studio-500">·</span>
              <span className="font-mono text-studio-300">{comparisonRun.steps?.length || 0} steps</span>
            </div>
          )}
        </div>
      </div>

      {comparisonResult && (
        <div className="text-xs text-studio-300 space-y-2">
          {[activeRun, comparisonRun].some(run => run && isSyntheticDemo(run)) && <p className="text-amber-300">Synthetic demo: the before sample deliberately includes a failed npm test command for comparison.</p>}
          <p>Alignment: {comparisonResult.alignment}{comparisonResult.alignment === 'sequence' ? ' (sequence position)' : comparisonResult.alignment === 'milestone' ? ' (latest evaluator observation per stable milestone ID)' : ''}</p>
          {comparisonResult.alignment === 'sequence' && <p>Sequence alignment is positional; differences do not establish a semantic regression.</p>}
          {[activeRun, comparisonRun].map((run, index) => run && <p key={`acceptance-${index}`}>Run {index === 0 ? 'A' : 'B'} acceptance: {getAcceptance(run)}</p>)}
          {[activeRun, comparisonRun].some(run => run && getRunDuration(run) === undefined) && <p>Timing evidence is missing; durations and duration deltas are unknown.</p>}
          {comparisonResult.comparisonWarning && <p role="alert" className="text-amber-300">{comparisonResult.comparisonWarning}</p>}
          {[activeRun, comparisonRun].map((run, index) => run?.metadata?.benchmark && (
            <p key={index}>Run {index === 0 ? 'A' : 'B'} evidence: {run.metadata.benchmark.evidenceKind}; mode: {run.metadata.benchmark.mode}; condition: {run.metadata.benchmark.condition}</p>
          ))}
          {comparisonResult.alignment === 'milestone' && <p>Milestone results show acceptance checks; run status may also reflect worker failures.</p>}
        </div>
      )}

      {/* Delta KPI Cards */}
      {comparisonResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Duration Delta */}
          <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/40">
            <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Wall-Clock Delta</span>
            </div>
            <div className={`text-lg font-bold font-mono ${
              comparisonResult.durationDeltaMs === undefined ? 'text-studio-200' : comparisonResult.durationDeltaMs > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {(comparisonResult.durationDeltaMs ?? 0) > 0 ? '+' : ''}
              {comparisonResult.durationDeltaMs === undefined ? 'Unknown' : formatDuration(comparisonResult.durationDeltaMs)}
            </div>
            <div className="text-[10px] text-studio-500 mt-0.5">
              Run A: {activeRun ? formatRunDuration(activeRun) : 'Unknown'} → Run B: {comparisonRun ? formatRunDuration(comparisonRun) : 'Unknown'}
            </div>
          </div>

          {/* Token Delta */}
          <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/40">
            <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Token Usage Delta</span>
            </div>
            <div className={`text-lg font-bold font-mono ${
              (comparisonResult.tokenDelta ?? 0) > 0 ? 'text-amber-400' : 'text-studio-200'
            }`}>
              {(comparisonResult.tokenDelta ?? 0) > 0 ? '+' : ''}
              {comparisonResult.tokenDelta === undefined ? 'Unknown' : formatTokens(comparisonResult.tokenDelta)}
            </div>
            <div className="text-[10px] text-studio-500 mt-0.5">
              Run A: {activeRun?.totalTokens ? formatTokens(activeRun.totalTokens.totalTokens) : 'Unknown'} → Run B: {comparisonRun?.totalTokens ? formatTokens(comparisonRun.totalTokens.totalTokens) : 'Unknown'}
            </div>
          </div>

          {/* Step Count Delta */}
          <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/40">
            <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Step Count Delta</span>
            </div>
            <div className="text-lg font-bold font-mono text-studio-100">
              {comparisonResult.stepCountDelta > 0 ? '+' : ''}
              {comparisonResult.stepCountDelta}
            </div>
            <div className="text-[10px] text-studio-500 mt-0.5">
              {activeRun?.steps?.length || 0} steps vs {comparisonRun?.steps?.length || 0} steps
            </div>
          </div>

          {/* Status Parity */}
          <div className="p-4 rounded-xl border border-studio-800 bg-studio-900/40">
            <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-studio-400" />
              <span>Status Parity (run status)</span>
            </div>
            <div className="text-base font-bold font-mono text-studio-100">
              {comparisonResult.statusChanged ? (
                <span className="text-rose-400">Status Changed</span>
              ) : (
                <span className="text-emerald-400">Identical Status</span>
              )}
            </div>
            <div className="text-[10px] text-studio-500 mt-0.5 capitalize">
              {activeRun && getRunStatusLabel(activeRun)} → {comparisonRun && getRunStatusLabel(comparisonRun)}
            </div>
          </div>
        </div>
      )}

      {/* Step Diff Table */}
      {comparisonResult && comparisonResult.alignment !== 'incompatible' && (
        <div className="rounded-xl border border-studio-800 bg-studio-900/40 overflow-hidden">
          <div className="px-4 py-3 bg-studio-950 border-b border-studio-800">
            <h3 className="text-xs font-semibold text-studio-200">
              {comparisonResult.alignment === 'milestone' ? 'Evaluator Milestone Comparison Matrix' : 'Aligned Step Comparison Matrix'} ({comparisonResult.stepDiffs.length} steps evaluated)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-studio-800 bg-studio-950/70 text-studio-400 font-mono text-[11px] uppercase">
                  <th className="py-2.5 px-4 w-12">#</th>
                  <th className="py-2.5 px-4">Step Name / Role</th>
                  <th className="py-2.5 px-4">Run A {comparisonResult.alignment === 'milestone' ? 'Evaluator' : 'Step'} Status</th>
                  <th className="py-2.5 px-4">Run B {comparisonResult.alignment === 'milestone' ? 'Evaluator' : 'Step'} Status</th>
                  <th className="py-2.5 px-4">Duration A</th>
                  <th className="py-2.5 px-4">Duration B</th>
                  <th className="py-2.5 px-4">Variance (B - A)</th>
                  <th className="py-2.5 px-4">Structural Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-studio-850">
                {comparisonResult.stepDiffs.map((diff) => {
                  const hasAnomaly = !diff.statusMatch || diff.hasStructureDifference;
                  return (
                    <tr
                      key={diff.index}
                      className={`hover:bg-studio-850/40 transition-colors ${
                        hasAnomaly ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-studio-500">
                        #{diff.index + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-studio-100 max-w-xs truncate">
                        {diff.name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {diff.statusA ? <StatusBadge status={diff.statusA} size="sm" /> : <span className="text-studio-600">—</span>}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {diff.statusB ? <StatusBadge status={diff.statusB} size="sm" /> : <span className="text-studio-600">—</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-studio-300">
                        {diff.durationA !== undefined ? formatDuration(diff.durationA) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-studio-300">
                        {diff.durationB !== undefined ? formatDuration(diff.durationB) : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        {diff.durationDiffMs !== undefined ? (
                          <span className={diff.durationDiffMs > 0 ? 'text-rose-400' : diff.durationDiffMs < 0 ? 'text-emerald-400' : 'text-studio-400'}>
                            {diff.durationDiffMs > 0 ? '+' : ''}{formatDuration(diff.durationDiffMs)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono text-studio-400">
                        {diff.notes.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {diff.notes.map((note, idx) => (
                              <span key={idx} className="text-amber-300/90">{note}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-emerald-500/80">Matched</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
