import { TraceLensStep } from '../../types/trace';
import { StepTypeBadge, StatusBadge } from '../common/Badge';
import { formatDuration, formatTokens } from '../../lib/formatters';
import { AlertCircle, Zap, AlertOctagon } from 'lucide-react';

interface StepItemProps {
  step: TraceLensStep;
  isSelected: boolean;
  totalRunDurationMs?: number;
  isHonestyFlagged?: boolean;
  onSelect: () => void;
}

export function StepItem({ step, isSelected, totalRunDurationMs, isHonestyFlagged, onSelect }: StepItemProps) {
  const percentage = totalRunDurationMs !== undefined && totalRunDurationMs > 0
    ? Math.min(100, Math.max(1, Math.round((step.durationMs / totalRunDurationMs) * 100)))
    : 0;

  return (
    <div
      data-testid={`step-item-${step.stepId}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? isHonestyFlagged
            ? 'bg-studio-850 border-rose-500 shadow-md shadow-rose-950/40'
            : 'bg-studio-850 border-cyan-500/70 shadow-md shadow-cyan-950/30'
          : isHonestyFlagged
          ? 'bg-studio-900/50 border-rose-900/60 hover:border-rose-700 hover:bg-studio-850/50'
          : 'bg-studio-900/40 border-studio-800 hover:border-studio-700 hover:bg-studio-850/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-mono text-xs font-bold w-5 ${isSelected ? (isHonestyFlagged ? 'text-rose-400' : 'text-cyan-400') : 'text-studio-500'}`}>
            #{step.stepIndex + 1}
          </span>
          <StepTypeBadge type={step.type} />
          <span className={`text-xs font-semibold truncate ${isSelected ? 'text-studio-100' : 'text-studio-200'}`}>
            {step.name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isHonestyFlagged && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-300 bg-rose-950/80 border border-rose-800 px-1.5 py-0.5 rounded">
              <AlertOctagon className="w-2.5 h-2.5 text-rose-400" />
              <span className="hidden sm:inline">Audit Flag</span>
            </span>
          )}
          {step.tokens && step.tokens.totalTokens > 0 && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-studio-400 bg-studio-950 px-1.5 py-0.5 rounded border border-studio-800">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              {formatTokens(step.tokens.totalTokens)}
            </span>
          )}
          <StatusBadge status={step.status} size="sm" />
        </div>
      </div>

      {/* Latency Bar visualization */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-studio-400">
          <span className="flex items-center gap-1">
            {step.status === 'failed' && (
              <span className="text-rose-400 flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" />
                {step.error?.code || 'Failed'}
              </span>
            )}
          </span>
          <span className="text-studio-300 font-medium">{totalRunDurationMs === undefined ? 'Unknown duration' : `${formatDuration(step.durationMs)} (${percentage}%)`}</span>
        </div>
        <div className="w-full bg-studio-950 h-1.5 rounded-full overflow-hidden border border-studio-800/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              step.status === 'failed'
                ? 'bg-rose-500'
                : isSelected
                ? isHonestyFlagged ? 'bg-rose-400' : 'bg-cyan-400'
                : 'bg-studio-600 group-hover:bg-cyan-500/80'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
