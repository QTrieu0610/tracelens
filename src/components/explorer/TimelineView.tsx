import { useEffect, useMemo, useRef, useState } from 'react';
import { useTraceStore } from '../../store/traceStore';
import { StepItem } from './StepItem';
import { StepInspector } from './StepInspector';
import { formatDuration, formatTokens } from '../../lib/formatters';
import { formatRunDuration, getAcceptance, getRunDuration, getRunStatusLabel, getTelemetrySummary, isSyntheticDemo } from '../../lib/runEvidence';
import { Clock, Zap, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, AlertOctagon } from 'lucide-react';
import { filterSteps, indexSteps } from '../../lib/stepSearch';
import { StepStatus, StepType } from '../../types/trace';
import { StatusBadge } from '../common/Badge';
import { auditRunHonesty } from '../../lib/honestyAuditor';

export function TimelineView() {
  const { activeRun } = useTraceStore();
  return <RunTimeline key={activeRun?.runId} />;
}

function RunTimeline() {
  const { activeRun, activeStep, selectStep } = useTraceStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StepStatus | 'all'>('all');
  const [type, setType] = useState<StepType | 'all'>('all');
  const list = useRef<HTMLDivElement>(null);
  const focusSelection = useRef(false);
  const index = useMemo(() => indexSteps(activeRun?.steps ?? []), [activeRun]);
  const matches = useMemo(() => filterSteps(index, query, status, type), [index, query, status, type]);
  const selectedIndex = Math.max(0, matches.findIndex(step => step.stepId === activeStep?.stepId));
  const selected = matches[selectedIndex] ?? null;
  const page = Math.floor(selectedIndex / 100);
  const pages = Math.max(1, Math.ceil(matches.length / 100));
  const visible = matches.slice(page * 100, (page + 1) * 100);
  const failed = matches.filter(step => step.status === 'failed');
  const previousFailure = [...matches.slice(0, selectedIndex)].reverse().find(step => step.status === 'failed');
  const nextFailure = matches.slice(selectedIndex + 1).find(step => step.status === 'failed');

  const honestyAudit = useMemo(() => activeRun ? auditRunHonesty(activeRun) : null, [activeRun]);

  const flaggedStepIds = useMemo(() => {
    if (!honestyAudit?.discrepancies) return new Set<string>();
    return new Set(honestyAudit.discrepancies.map(d => d.stepId));
  }, [honestyAudit]);

  const activeStepDiscrepancy = useMemo(() => {
    if (!honestyAudit?.discrepancies || !selected) return null;
    return honestyAudit.discrepancies.find(d => d.stepId === selected.stepId) ?? null;
  }, [honestyAudit, selected]);

  useEffect(() => {
    if (selected && selected.stepId !== activeStep?.stepId) selectStep(selected.stepId);
  }, [selected, activeStep, selectStep]);

  useEffect(() => {
    const item = list.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    item?.scrollIntoView({ block: 'nearest' });
    if (focusSelection.current) {
      item?.focus({ preventScroll: true });
      focusSelection.current = false;
    }
  }, [selected]);

  const navigateStep = (direction: 'next' | 'prev') => {
    const target = matches[selectedIndex + (direction === 'next' ? 1 : -1)];
    if (target) {
      focusSelection.current = true;
      selectStep(target.stepId);
    }
  };

  const inspectFirstFailure = () => {
    const first = activeRun?.steps.find(step => step.status === 'failed');
    if (first) {
      setQuery(''); setStatus('all'); setType('all');
      selectStep(first.stepId);
    }
  };

  const jumpToDiscrepancyStep = (stepId: string) => {
    setQuery('');
    setStatus('all');
    setType('all');
    focusSelection.current = true;
    selectStep(stepId);
  };

  // Keyboard navigation listener (ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable || document.querySelector('dialog[open]')) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateStep('next');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateStep('prev');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateStep]);

  if (!activeRun) {
    return (
      <div className="p-8 text-center text-studio-500">
        No execution trace selected. Please select a run from the dashboard.
      </div>
    );
  }

  const steps = activeRun.steps || [];
  const failureCount = steps.filter(s => s.status === 'failed').length;
  const telemetry = getTelemetrySummary(activeRun);
  const duration = getRunDuration(activeRun);

  return (
    <div className="space-y-4">
      {/* Run Summary Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-studio-800 bg-studio-900/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={activeRun.status} label={getRunStatusLabel(activeRun)} />
            {isSyntheticDemo(activeRun) && <span className="text-xs text-amber-300">Synthetic demo</span>}
            <span className="font-mono text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
              {activeRun.agentName}
            </span>
            <span className="font-mono text-xs text-studio-400">
              {activeRun.model}
            </span>
          </div>
          <h2 className="text-base font-bold text-studio-100">{activeRun.name}</h2>
          {activeRun.description && (
            <p className="text-xs text-studio-400 mt-0.5">{activeRun.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono bg-studio-950 px-4 py-2 rounded-lg border border-studio-800">
          <div className="flex items-center gap-1.5 text-studio-200">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{formatRunDuration(activeRun)}</span>
          </div>
          <div className="w-px h-3.5 bg-studio-800" />
          <div className="flex items-center gap-1.5 text-studio-200">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatTokens(activeRun.totalTokens?.totalTokens)}</span>
          </div>
          <div className="w-px h-3.5 bg-studio-800" />
          <div className="text-studio-300">
            {steps.length} steps {failureCount > 0 && <span className="text-rose-400">({failureCount} failed)</span>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-studio-800 bg-studio-900/40 p-4 text-xs text-studio-300 space-y-2" aria-label="Run evidence">
        {failureCount > 0 && <div className="flex flex-wrap items-center gap-3">
          <strong className="text-rose-300">{failureCount} failed step{failureCount === 1 ? '' : 's'} recorded. CLI completion does not imply all commands passed.</strong>
          <button onClick={inspectFirstFailure} className="rounded border border-rose-700 px-3 py-2 text-rose-200 hover:bg-rose-950">Inspect first failed step</button>
        </div>}
        <p><strong>Acceptance:</strong> {getAcceptance(activeRun)}</p>
        {telemetry.sourceDurationMs !== undefined && <p>Source-reported elapsed: {formatDuration(telemetry.sourceDurationMs)}. This is separate from timestamp-derived timing.</p>}
        <p><strong>Source:</strong> {getRunStatusLabel(activeRun).startsWith('CLI ') ? `${activeRun.agentName} CLI log — status describes CLI execution, not task correctness` : 'TraceLens JSON — values reported by the source'}</p>
        <p><strong>Token telemetry:</strong> {telemetry.complete === true ? 'Complete reported turns' : telemetry.complete === false ? 'Incomplete — totals are unknown' : 'Source-reported totals; completeness not declared'}{telemetry.cachedInputTokens !== undefined && (activeRun.metadata?.source === 'antigravity-stream-json'
          ? `; cache reads reported by AGY: ${formatTokens(telemetry.cachedInputTokens)} (not added to total tokens)`
          : `; cached input: ${formatTokens(telemetry.cachedInputTokens)} (included in input tokens)`)}</p>
        {duration === undefined && <p>Timing is Unknown because the log has no complete timestamps. Event order is preserved.</p>}
        {telemetry.warnings.map((warning, index) => <p key={index} className="text-amber-300">{warning}</p>)}

        {/* Honesty & Reporting Integrity Audit */}
        {honestyAudit && honestyAudit.verdict !== 'UNVERIFIED' && (
          <div className="pt-2 border-t border-studio-800/80 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-studio-200">Honesty Audit:</span>
              {honestyAudit.verdict === 'HONEST_PASS' && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  <ShieldCheck className="w-3.5 h-3.5" /> Honest Pass (Grounded)
                </span>
              )}
              {honestyAudit.verdict === 'HONEST_FAIL_DISCLOSED' && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded">
                  <ShieldCheck className="w-3.5 h-3.5" /> Honest Failure Disclosure
                </span>
              )}
              {honestyAudit.verdict === 'FALSE_COMPLETION_CLAIM' && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-rose-300 font-bold bg-rose-950/70 border border-rose-700 px-2 py-0.5 rounded">
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" /> False Completion Claim (Defect)
                </span>
              )}
              {honestyAudit.verdict === 'UNSUPPORTED_METRIC_CLAIM' && (
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300 font-bold bg-amber-950/70 border border-amber-700 px-2 py-0.5 rounded">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Unsupported Metric Claim
                </span>
              )}
            </div>
            <p className="text-studio-400">{honestyAudit.summary}</p>
            
            {/* Click-to-Focus Discrepancies */}
            {honestyAudit.discrepancies.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {honestyAudit.discrepancies.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => jumpToDiscrepancyStep(d.stepId)}
                    className="w-full text-left group flex items-start justify-between gap-3 p-2.5 rounded-lg border border-rose-900/60 bg-rose-950/40 hover:bg-rose-900/30 hover:border-rose-700 transition-colors cursor-pointer text-xs"
                    title={`Click to inspect step #${d.stepIndex + 1} (${d.stepName})`}
                  >
                    <span className="text-rose-200/90 leading-relaxed font-normal">
                      {d.evidence}
                    </span>
                    <span className="flex-shrink-0 inline-flex items-center gap-1 font-mono text-[10px] text-rose-300 bg-rose-950 border border-rose-700/80 px-2 py-0.5 rounded group-hover:border-rose-500 group-hover:text-rose-100 transition-colors">
                      Jump to #{d.stepIndex + 1} &rarr;
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2-Pane Explorer: Timeline on left, Inspector on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Step list column */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-studio-400 font-medium">
            <span>Execution Sequence ({steps.length} steps)</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateStep('prev')}
                className="p-1 rounded hover:bg-studio-800 text-studio-400 hover:text-studio-100"
                title="Previous step (Up arrow)"
                disabled={selectedIndex === 0 || !selected}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigateStep('next')}
                className="p-1 rounded hover:bg-studio-800 text-studio-400 hover:text-studio-100"
                title="Next step (Down arrow)"
                disabled={selectedIndex >= matches.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <label className="w-full">Search steps
              <input type="search" value={query} onChange={event => { setQuery(event.target.value); selectStep(null); }} placeholder="Name, input, output, error" className="mt-1 w-full rounded border border-studio-700 bg-studio-950 p-2" />
            </label>
            <label>Status <select aria-label="Status" value={status} onChange={event => { setStatus(event.target.value as StepStatus | 'all'); selectStep(null); }} className="rounded border border-studio-700 bg-studio-950 p-2">
              <option value="all">All statuses</option>
              {(['success', 'failed', 'running', 'cancelled', 'skipped'] as const).map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
            <label>Type <select aria-label="Type" value={type} onChange={event => { setType(event.target.value as StepType | 'all'); selectStep(null); }} className="rounded border border-studio-700 bg-studio-950 p-2">
              <option value="all">All types</option>
              {(['user_input', 'agent_thought', 'tool_call', 'subagent_invocation', 'plan_step', 'system_event'] as const).map(value => <option key={value} value={value}>{value}</option>)}
            </select></label>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button disabled={!previousFailure} onClick={() => previousFailure && selectStep(previousFailure.stepId)} className="rounded border border-studio-700 p-2 disabled:opacity-40">Previous failed step</button>
            <button disabled={!nextFailure} onClick={() => nextFailure && selectStep(nextFailure.stepId)} className="rounded border border-studio-700 p-2 disabled:opacity-40">Next failed step</button>
            <span className="self-center text-studio-400">{failed.length} failures in results</span>
          </div>
          <p role="status" className="text-xs text-studio-400">{matches.length} of {steps.length} steps match; showing {matches.length ? page * 100 + 1 : 0} to {Math.min((page + 1) * 100, matches.length)}. Page {page + 1} of {pages}.</p>
          <div className="flex gap-2 text-xs">
            <button disabled={page === 0} onClick={() => selectStep(matches[(page - 1) * 100].stepId)} className="rounded border border-studio-700 p-2 disabled:opacity-40">Previous page</button>
            <button disabled={page + 1 >= pages} onClick={() => selectStep(matches[(page + 1) * 100].stepId)} className="rounded border border-studio-700 p-2 disabled:opacity-40">Next page</button>
          </div>
          {!matches.length && <p className="p-4 text-sm text-studio-400">No steps match these filters.</p>}
          <div ref={list} className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {visible.map((step) => (
              <StepItem
                key={step.stepId}
                step={step}
                isSelected={selected?.stepId === step.stepId}
                totalRunDurationMs={duration}
                isHonestyFlagged={flaggedStepIds.has(step.stepId)}
                onSelect={() => selectStep(step.stepId)}
              />
            ))}
          </div>
        </div>

        {/* Inspector Panel Column */}
        <div className="lg:col-span-7 sticky top-20">
          <StepInspector
            step={selected}
            totalRunDurationMs={duration}
            discrepancy={activeStepDiscrepancy}
          />
        </div>
      </div>
    </div>
  );
}
