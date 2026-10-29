import type { RunComparisonResult, TraceLensV1Trace } from '../types/trace';
import { formatDuration } from './formatters';
import { formatRunDuration, getAcceptance, getRunStatusLabel, getTelemetrySummary, isSyntheticDemo } from './runEvidence';
import { auditRunHonesty } from './honestyAuditor';

function escapeMarkdown(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

export function buildComparisonReport(comparison: RunComparisonResult, options: { includeRunNames?: boolean } = {}): string {
  const { runA, runB } = comparison;
  const runLines = (run: TraceLensV1Trace, label: string) => {
    const telemetry = getTelemetrySummary(run);
    const honesty = auditRunHonesty(run);
    return [
      `### ${label}${options.includeRunNames ? `: ${escapeMarkdown(run.name)}` : ''}`,
      `- CLI / run status: ${getRunStatusLabel(run)}`,
      ...(isSyntheticDemo(run) ? ['- Source: Synthetic demo'] : []),
      `- Acceptance: ${getAcceptance(run)}`,
      `- Honesty audit: ${honesty.aggregateSummary || 'Unverified'}`,
      `- Duration: ${formatRunDuration(run)}`,
      ...(telemetry.sourceDurationMs !== undefined ? [`- Source-reported elapsed (separate from timestamp-derived timing): ${formatDuration(telemetry.sourceDurationMs)}`] : []),
      `- Tokens: ${run.totalTokens?.totalTokens ?? 'Unknown'}; telemetry: ${telemetry.complete === true ? 'complete' : telemetry.complete === false ? 'partial / unavailable' : 'unknown completeness'}`,
      `- Cached input tokens: ${telemetry.cachedInputTokens ?? 'Unknown'}`,
      `- Steps: ${run.steps.length}`,
    ].join('\n');
  };
  return [
    '# TraceLens comparison', '', runLines(runA, 'Run A'), '', runLines(runB, 'Run B'), '',
    '## Comparison',
    `- Alignment: ${comparison.alignment}`,
    `- Duration delta (B - A): ${comparison.durationDeltaMs === undefined ? 'Unknown' : formatDuration(comparison.durationDeltaMs)}`,
    `- Token delta (B - A): ${comparison.tokenDelta ?? 'Unknown'}`,
    `- Step count delta (B - A): ${comparison.stepCountDelta}`,
    '', '## Limitations',
    ...(comparison.alignment === 'sequence' ? ['- Sequence alignment is positional; differences do not establish a semantic regression.'] : []),
    ...(comparison.alignment === 'incompatible' ? ['- Benchmark metadata is incompatible. No steps are aligned.'] : []),
    ...(comparison.alignment === 'milestone' ? ['- Milestone alignment uses the latest evaluator observation for each stable milestone ID.'] : []),
    '- CLI completion does not establish task acceptance. Evaluator observations are not independently verified.',
    '- Unknown duration means timing evidence is missing. Partial or unknown token telemetry cannot establish total usage.',
    '- These observations do not establish causality or monetary cost.',
    '- Different CLI providers may report tokens differently. A token delta alone does not establish model quality or a fair experimental comparison.',
    '- Raw trace content, commands, prompts, paths, identifiers, errors and step names are excluded by default. Optional run names may contain sensitive information.',
    '',
  ].join('\n');
}
