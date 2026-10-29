import { RunStatus, StepStatus, StepType } from '../../types/trace';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Terminal, Brain, MessageSquare, Network, ListOrdered, Bell } from 'lucide-react';

interface StatusBadgeProps {
  status: RunStatus | StepStatus;
  size?: 'sm' | 'md';
  label?: string;
}

export function StatusBadge({ status, size = 'md', label }: StatusBadgeProps) {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  switch (status) {
    case 'success':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
          <CheckCircle2 className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
          <span className={label ? undefined : 'capitalize'}>{label ?? status}</span>
        </span>
      );
    case 'failed':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 ${sizeClasses}`}>
          <XCircle className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
          <span className={label ? undefined : 'capitalize'}>{label ?? status}</span>
        </span>
      );
    case 'running':
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 ${sizeClasses}`}>
          <Clock className={`${isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} animate-spin`} />
          <span className={label ? undefined : 'capitalize'}>{label ?? status}</span>
        </span>
      );
    case 'cancelled':
    case 'skipped':
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-medium rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 ${sizeClasses}`}>
          <AlertTriangle className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
          <span className={label ? undefined : 'capitalize'}>{label ?? status}</span>
        </span>
      );
  }
}

interface StepTypeBadgeProps {
  type: StepType;
}

export function StepTypeBadge({ type }: StepTypeBadgeProps) {
  switch (type) {
    case 'user_input':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <MessageSquare className="w-3 h-3" />
          <span>user_input</span>
        </span>
      );
    case 'agent_thought':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
          <Brain className="w-3 h-3" />
          <span>thought</span>
        </span>
      );
    case 'tool_call':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Terminal className="w-3 h-3" />
          <span>tool_call</span>
        </span>
      );
    case 'subagent_invocation':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
          <Network className="w-3 h-3" />
          <span>subagent</span>
        </span>
      );
    case 'plan_step':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ListOrdered className="w-3 h-3" />
          <span>plan_step</span>
        </span>
      );
    case 'system_event':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
          <Bell className="w-3 h-3" />
          <span>event</span>
        </span>
      );
  }
}
