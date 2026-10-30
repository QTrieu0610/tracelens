import { describe, expect, it } from 'vitest';
import { computeRunComparison } from '../../src/lib/analytics';
import { validateTraceLensJson } from '../../src/lib/validator';
import type { TraceLensV1Trace } from '../../src/types/trace';

function run(revision = 'v1'): TraceLensV1Trace {
  return {
    schemaVersion: 'tracelens-v1', runId: 'eval', name: 'Evaluation', agentName: 'test', model: 'deterministic',
    status: 'success', startedAt: '2026-10-30T00:00:00Z', totalDurationMs: 10,
    metadata: { evaluation: { datasetId: 'forms', datasetRevision: revision } },
    steps: ['case-a/output', 'case-a/trajectory'].map((id, stepIndex) => ({
      stepId: id, stepIndex, type: 'system_event', name: id, status: 'success',
      startedAt: '2026-10-30T00:00:00Z', durationMs: 0, metadata: { evaluator: true, milestoneId: id },
    })),
  };
}

describe('evaluation comparison', () => {
  it('aligns criteria by stable case ID even when tools shift and assertions reorder', () => {
    const a = run();
    const b = run();
    b.steps.reverse();
    b.steps[0] = { ...b.steps[0], status: 'failed', error: { message: 'Filled before validation' } };
    const result = computeRunComparison(a, b);
    expect(result.alignment).toBe('milestone');
    expect(result.stepDiffs.map(s => [s.name, s.statusA, s.statusB])).toEqual([
      ['case-a/output', 'success', 'success'], ['case-a/trajectory', 'success', 'failed'],
    ]);
  });

  it.each(['v2', ''])('refuses a different or invalid dataset revision %j', revision => {
    const result = computeRunComparison(run(), run(revision));
    expect(result.alignment).toBe('incompatible');
    expect(result.stepDiffs).toEqual([]);
  });

  it('refuses mixing evaluation and positional runs', () => {
    expect(computeRunComparison(run(), { ...run(), metadata: undefined }).alignment).toBe('incompatible');
  });

  it.each([null, [], {}, { datasetId: 'forms', datasetRevision: '' }, { datasetId: 1, datasetRevision: 'v1' }])('rejects malformed evaluation identity %j', evaluation => {
    expect(validateTraceLensJson({ ...run(), metadata: { evaluation } }).valid).toBe(false);
  });

  it('accepts evaluation evidence without benchmark metadata', () => {
    expect(validateTraceLensJson(run()).valid).toBe(true);
  });

  it('summarizes newly failed checks and missing evidence separately with exact step IDs', () => {
    const a = run(), b = run();
    b.steps[0] = { ...b.steps[0], stepId: 'candidate-output', status: 'failed', error: { message: 'Wrong output' } };
    b.steps.pop();
    const result = computeRunComparison(a, b);
    expect(result.evaluationSummary).toEqual({ baselinePassed: 2, baselineTotal: 2, candidatePassed: 0, candidateTotal: 1, regressions: 1, improvements: 0, missing: 1, added: 0 });
    expect(result.stepDiffs[0].stepIdB).toBe('candidate-output');
    expect(result.stepDiffs[1].stepIdB).toBeUndefined();
    expect(result.stepDiffs[1].stepIdA).toBe('case-a/trajectory');
  });
});
