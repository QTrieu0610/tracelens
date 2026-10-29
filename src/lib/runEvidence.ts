import { TraceLensV1Trace } from '../types/trace';
import { formatDuration } from './formatters';

export function getRunStatusLabel(run: TraceLensV1Trace): string {
  return ['codex-exec-jsonl', 'claude-code-stream-json', 'gemini-cli-stream-json', 'antigravity-stream-json'].some(source => source === run.metadata?.source)
    ? ({ success: 'CLI completed', failed: 'CLI failed', running: 'CLI running', cancelled: 'CLI cancelled' }[run.status])
    : run.status;
}

export function isSyntheticDemo(run: TraceLensV1Trace): boolean {
  if (run.metadata?.syntheticDemo === true || run.tags?.includes('demo')) return true;
  // Previously imported built-in examples lack a dedicated demo metadata field.
  return run.metadata?.source === 'codex-exec-jsonl' && /^codex-synthetic-(before|after)-[a-f0-9]+$/.test(run.runId);
}

export function getRunDuration(run: TraceLensV1Trace): number | undefined {
  const imported = run.metadata?.import as Record<string, unknown> | undefined;
  return imported?.timingKnown === false || !Number.isFinite(run.totalDurationMs) || run.totalDurationMs < 0 ? undefined : run.totalDurationMs;
}

export function formatRunDuration(run: TraceLensV1Trace): string {
  const duration = getRunDuration(run);
  return duration === undefined ? 'Unknown' : formatDuration(duration);
}

export function getAcceptance(run: TraceLensV1Trace): string {
  const checks = new Map<string, string>();
  for (const step of run.steps) {
    if (step.metadata?.evaluator === true && typeof step.metadata.milestoneId === 'string' && step.metadata.milestoneId.trim()) {
      checks.set(step.metadata.milestoneId, step.status);
    }
  }
  return checks.size ? `Evaluator reports ${[...checks.values()].filter(status => status === 'success').length}/${checks.size} checks passed`
    : 'Unverified (no evaluator evidence)';
}

export function getTelemetrySummary(run: TraceLensV1Trace): { complete: boolean | undefined; cachedInputTokens?: number; sourceDurationMs?: number; warnings: string[] } {
  const imported = run.metadata?.import as Record<string, unknown> | undefined;
  const declared = imported?.telemetryComplete;
  return {
    complete: typeof declared === 'boolean' ? declared : run.metadata?.benchmark?.tokenTelemetry === 'complete' ? true
      : run.metadata?.benchmark?.tokenTelemetry === 'unavailable' ? false : undefined,
    ...(typeof imported?.cachedInputTokens === 'number' && Number.isSafeInteger(imported.cachedInputTokens) && imported.cachedInputTokens >= 0 ? { cachedInputTokens: imported.cachedInputTokens } : {}),
    ...(typeof imported?.sourceDurationMs === 'number' && Number.isFinite(imported.sourceDurationMs) && imported.sourceDurationMs >= 0 ? { sourceDurationMs: imported.sourceDurationMs } : {}),
    warnings: Array.isArray(imported?.warnings) ? imported.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
  };
}
