import { describe, expect, it } from 'vitest';
import { computeRunComparison, computeStudioAnalytics } from '../../src/lib/analytics';
import { formatRunDuration, getAcceptance, getRunDuration, getRunStatusLabel, getTelemetrySummary, isSyntheticDemo } from '../../src/lib/runEvidence';
import demo from '../../fixtures/demo-coding-agent.json';
import { TraceLensV1Trace } from '../../src/types/trace';

const run = { ...demo, metadata: { source: 'codex-exec-jsonl', import: { timingKnown: false, telemetryComplete: true, acceptance: 'unverified', cachedInputTokens: 7, warnings: ['No timestamps'] } } } as TraceLensV1Trace;

describe('run evidence', () => {
  it('labels CLI completion separately from command success and recognizes already stored examples', () => {
    expect(getRunStatusLabel({ ...run, metadata: { source: { toString: null, valueOf: null } } })).toBe('success');
    expect(getRunStatusLabel(run)).toBe('CLI completed');
    expect(getRunStatusLabel({ ...run, status: 'failed' })).toBe('CLI failed');
    expect(getRunStatusLabel(demo as TraceLensV1Trace)).toBe('success');
    expect(isSyntheticDemo({ ...run, runId: 'codex-synthetic-before-a123bc' })).toBe(true);
    expect(isSyntheticDemo(run)).toBe(true);
    expect(isSyntheticDemo({ ...run, tags: [] })).toBe(false);
    for (const source of ['claude-code-stream-json', 'gemini-cli-stream-json']) {
      expect(getRunStatusLabel({ ...run, metadata: { source } })).toBe('CLI completed');
    }
  });
  it('does not invent elapsed time, averages or timing deltas from untimestamped imports', () => {
    expect(getRunDuration(run)).toBeUndefined();
    expect(formatRunDuration(run)).toBe('Unknown');
    expect(computeRunComparison(run, run).durationDeltaMs).toBeUndefined();
    expect(computeRunComparison(run, run).stepDiffs[0].durationA).toBeUndefined();
    expect(computeStudioAnalytics([run]).avgDurationMs).toBeUndefined();
    expect(computeStudioAnalytics([run]).longestSteps).toEqual([]);
  });
  it('keeps legacy run timing and separates CLI completion from evaluator evidence', () => {
    expect(getRunDuration(demo as TraceLensV1Trace)).toBe(demo.totalDurationMs);
    expect(getAcceptance(run)).toMatch(/unverified/i);
    expect(getTelemetrySummary(run)).toEqual({ complete: true, cachedInputTokens: 7, warnings: ['No timestamps'] });
  });
  it('uses the latest reported evaluator result per milestone without treating claims as attestations', () => {
    const step = run.steps[0];
    const observed: TraceLensV1Trace = { ...run, steps: [
      { ...step, status: 'failed', metadata: { evaluator: true, milestoneId: 'check' } },
      { ...step, status: 'success', metadata: { evaluator: true, milestoneId: 'check' } },
    ] };
    expect(getAcceptance(observed)).toBe('Evaluator reports 1/1 checks passed');
  });
});
