import React from 'react';
import { useTraceStore } from '../../store/traceStore';
import { StatusBadge, StepTypeBadge } from '../common/Badge';
import { formatDuration } from '../../lib/formatters';
import { getRunDuration } from '../../lib/runEvidence';
import { StepInspector } from '../explorer/StepInspector';
import { Network, ArrowDown, CornerDownRight, AlertCircle } from 'lucide-react';

export function WorkflowGraph() {
  const { activeRun, activeStep, selectStep } = useTraceStore();

  if (!activeRun) {
    return (
      <div className="p-8 text-center text-studio-500">
        No execution trace selected.
      </div>
    );
  }

  const steps = activeRun.steps || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-studio-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>Workflow State & Transition Graph</span>
          </h2>
          <p className="text-xs text-studio-400 mt-0.5">
            Execution sequence with parent-child markers. Arrows show display order, not inferred dependencies.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Workflow Diagram Column */}
        <div className="lg:col-span-7 p-6 rounded-xl border border-studio-800 bg-studio-900/40 min-h-[550px] overflow-auto">
          <div className="flex flex-col items-center max-w-md mx-auto space-y-3">
            {steps.map((step, idx) => {
              const isSelected = activeStep?.stepId === step.stepId;
              const isChild = Boolean(step.parentId);

              return (
                <React.Fragment key={step.stepId}>
                  {/* Transition arrow connector */}
                  {idx > 0 && (
                    <div className="flex flex-col items-center my-0.5">
                      <div className="w-0.5 h-4 bg-studio-700" />
                      <ArrowDown className="w-3.5 h-3.5 text-studio-500 -mt-1" />
                    </div>
                  )}

                  {/* Step Node */}
                  <div
                    onClick={() => selectStep(step.stepId)}
                    className={`w-full p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isChild ? 'ml-6 border-l-4 border-l-purple-500' : ''
                    } ${
                      isSelected
                        ? 'bg-studio-850 border-cyan-500 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                        : step.status === 'failed'
                        ? 'bg-rose-950/10 border-rose-500/50 hover:border-rose-400'
                        : 'bg-studio-950 border-studio-800 hover:border-studio-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {isChild && (
                          <CornerDownRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                        )}
                        <span className="font-mono text-xs font-bold text-studio-400">
                          #{step.stepIndex + 1}
                        </span>
                        <StepTypeBadge type={step.type} />
                      </div>
                      <StatusBadge status={step.status} size="sm" />
                    </div>

                    <div className="text-xs font-semibold text-studio-100 truncate">
                      {step.name}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-studio-400 mt-2 pt-2 border-t border-studio-850/60">
                      <span>Latency</span>
                      <span className="text-studio-200 font-medium">
                        {getRunDuration(activeRun) === undefined ? 'Unknown' : formatDuration(step.durationMs)}
                      </span>
                    </div>

                    {step.status === 'failed' && (
                      <div className="mt-2 text-[11px] text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{step.error?.code || step.error?.message}</span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Inspector Column */}
        <div className="lg:col-span-5 sticky top-20">
          <StepInspector
            step={activeStep}
            totalRunDurationMs={getRunDuration(activeRun)}
          />
        </div>
      </div>
    </div>
  );
}
