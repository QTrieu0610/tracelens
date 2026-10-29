import React, { useState } from 'react';
import { TraceLensStep, HonestyDiscrepancy } from '../../types/trace';
import { StatusBadge, StepTypeBadge } from '../common/Badge';
import { formatDuration, formatTimestamp, formatTokens } from '../../lib/formatters';
import { JsonViewer } from '../common/JsonViewer';
import { 
  Info, 
  Brain, 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertTriangle, 
  Code,
  Clock,
  Zap,
  Tag,
  AlertOctagon
} from 'lucide-react';

interface StepInspectorProps {
  step: TraceLensStep | null;
  totalRunDurationMs?: number;
  discrepancy?: HonestyDiscrepancy | null;
}

type InspectorTab = 'overview' | 'thought' | 'input' | 'output' | 'error' | 'json';

export function StepInspector({ step, totalRunDurationMs, discrepancy }: StepInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');

  if (!step) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-studio-500">
        <Info className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">Select any execution step to inspect its details, inputs, thoughts, and outputs</p>
      </div>
    );
  }

  const latencyPercentage = totalRunDurationMs !== undefined && totalRunDurationMs > 0
    ? Math.min(100, Math.max(1, Math.round((step.durationMs / totalRunDurationMs) * 100))) 
    : 0;

  const hasThought = Boolean(step.thought);
  const hasInput = step.input !== undefined && step.input !== null;
  const hasOutput = step.output !== undefined && step.output !== null;
  const hasError = Boolean(step.error);

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode; badge?: boolean; alert?: boolean }> = [
    { id: 'overview', label: 'Overview', icon: <Info className="w-3.5 h-3.5" /> },
    ...(hasThought ? [{ id: 'thought' as InspectorTab, label: 'Thought', icon: <Brain className="w-3.5 h-3.5" />, badge: true }] : []),
    ...(hasInput ? [{ id: 'input' as InspectorTab, label: 'Input', icon: <ArrowDownLeft className="w-3.5 h-3.5" /> }] : []),
    ...(hasOutput ? [{ id: 'output' as InspectorTab, label: 'Output', icon: <ArrowUpRight className="w-3.5 h-3.5" /> }] : []),
    ...(hasError ? [{ id: 'error' as InspectorTab, label: 'Error', icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />, alert: true }] : []),
    { id: 'json', label: 'Raw JSON', icon: <Code className="w-3.5 h-3.5" /> },
  ];

  // If current active tab is not valid for this step, fallback to overview
  const currentTab = tabs.some(t => t.id === activeTab) ? activeTab : 'overview';

  return (
    <div className="h-full flex flex-col border border-studio-800 rounded-xl bg-studio-900/40 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-studio-800 bg-studio-950/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-studio-400">
              #{step.stepIndex + 1}
            </span>
            <StepTypeBadge type={step.type} />
            <StatusBadge status={step.status} size="sm" />
          </div>
          <span className="text-xs font-mono text-studio-400">
            ID: <code className="text-studio-200">{step.stepId}</code>
          </span>
        </div>
        <h3 className="text-sm font-semibold text-studio-100 break-words">
          {step.name}
        </h3>
      </div>

      {/* Honesty Discrepancy Alert Banner */}
      {discrepancy && (
        <div className="m-3 p-3 rounded-lg border border-rose-800/80 bg-rose-950/50 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertOctagon className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-rose-300 block">Flagged in Honesty Audit:</span>
            <p className="text-rose-200/90 leading-relaxed">{discrepancy.evidence}</p>
          </div>
        </div>
      )}

      {/* Navigation sub-tabs */}
      <div className="flex items-center overflow-x-auto border-b border-studio-800 bg-studio-950/40 px-2 py-1 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              currentTab === tab.id
                ? 'bg-studio-800 text-cyan-400 shadow-sm'
                : 'text-studio-400 hover:text-studio-200 hover:bg-studio-850'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.alert && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
          </button>
        ))}
      </div>

      {/* Tab Content Panel */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {currentTab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/60">
                <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Duration</span>
                </div>
                <div className="text-base font-bold font-mono text-studio-100">
                  {totalRunDurationMs === undefined ? 'Unknown' : formatDuration(step.durationMs)}
                </div>
                <div className="text-[10px] text-studio-400 mt-0.5">
                  {totalRunDurationMs === undefined ? 'Run timing unknown' : `${latencyPercentage}% of total run`}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/60">
                <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tokens</span>
                </div>
                <div className="text-base font-bold font-mono text-studio-100">
                  {formatTokens(step.tokens?.totalTokens)}
                </div>
                <div className="text-[10px] text-studio-400 mt-0.5">
                  {step.tokens ? `${step.tokens.promptTokens} in / ${step.tokens.completionTokens} out` : 'Not metered'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/60 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-studio-400 flex items-center gap-1 mb-1">
                  <Clock className="w-3.5 h-3.5 text-studio-400" />
                  <span>Start Time</span>
                </div>
                <div className="text-xs font-mono text-studio-200 truncate">
                  {formatTimestamp(step.startedAt)}
                </div>
                {step.completedAt && (
                  <div className="text-[10px] font-mono text-studio-400 truncate mt-0.5">
                    End: {formatTimestamp(step.completedAt)}
                  </div>
                )}
              </div>
            </div>

            {/* Error Preview if present */}
            {hasError && step.error && (
              <div className="p-3 rounded-lg border border-rose-800/60 bg-rose-950/20 text-rose-200">
                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{step.error.code || 'Execution Error'}</span>
                </div>
                <p className="text-xs font-mono break-words">{step.error.message}</p>
              </div>
            )}

            {/* Quick Preview of Thought/Input/Output */}
            {hasThought && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-studio-400 flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5 text-purple-400" /> Thought Snippet
                </span>
                <p className="text-xs text-studio-200 bg-studio-950/80 p-3 rounded-lg border border-studio-800 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {step.thought}
                </p>
              </div>
            )}

            {/* Metadata Preview if present */}
            {step.metadata && Object.keys(step.metadata).length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-studio-400 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" /> Metadata
                </span>
                <div className="bg-studio-950/80 p-2.5 rounded-lg border border-studio-800">
                  <JsonViewer data={step.metadata} />
                </div>
              </div>
            )}
          </div>
        )}

        {currentTab === 'thought' && hasThought && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-studio-300">Agent Reasoning / Internal Thought</span>
            <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/80 text-xs font-mono text-purple-200 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {step.thought}
            </div>
          </div>
        )}

        {currentTab === 'input' && hasInput && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-studio-300">Input Payload</span>
            <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/80">
              <JsonViewer data={step.input} />
            </div>
          </div>
        )}

        {currentTab === 'output' && hasOutput && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-studio-300">Output Result</span>
            <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/80">
              <JsonViewer data={step.output} />
            </div>
          </div>
        )}

        {currentTab === 'error' && hasError && (
          <div className="space-y-3">
            <span className="text-xs font-semibold text-rose-400">Error Details</span>
            <div className="p-3 rounded-lg border border-rose-800/60 bg-rose-950/30 space-y-2 text-xs font-mono text-rose-200">
              <div>
                <span className="text-rose-400 font-bold">Code: </span>
                <span>{step.error?.code || 'UNSPECIFIED'}</span>
              </div>
              <div>
                <span className="text-rose-400 font-bold">Message: </span>
                <p className="mt-1 break-words">{step.error?.message}</p>
              </div>
              {step.error?.stack && (
                <div>
                  <span className="text-rose-400 font-bold">Stack Trace: </span>
                  <pre className="mt-1 p-2 bg-studio-950 rounded border border-rose-900/40 text-[11px] overflow-x-auto text-rose-300 whitespace-pre-wrap">
                    {step.error.stack}
                  </pre>
                </div>
              )}
              {Boolean(step.error?.details) && (
                <div>
                  <span className="text-rose-400 font-bold">Additional Details: </span>
                  <div className="mt-1 p-2 bg-studio-950 rounded border border-rose-900/40">
                    <JsonViewer data={step.error?.details} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentTab === 'json' && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-studio-300">Full Raw Step JSON</span>
            <div className="p-3 rounded-lg border border-studio-800 bg-studio-950/80">
              <JsonViewer data={step} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
