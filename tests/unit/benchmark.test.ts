import { describe, expect, it } from 'vitest';
import { computeRunComparison } from '../../src/lib/analytics';
import { validateTraceLensJson } from '../../src/lib/validator';
import demoCoding from '../../fixtures/demo-coding-agent.json';
import demoTravel from '../../fixtures/demo-trip-planner-failure.json';
import demoSupport from '../../fixtures/demo-support-subagents.json';
import { TraceLensV1Trace, TraceLensStep } from '../../src/types/trace';

const benchmark = { experimentId: 'pilot', taskId: 'task', mode: 'single', condition: 'clean', repetition: 1, modelConfig: { model: 'test', effort: 'high', verified: false }, evidenceKind: 'real-agent', tokenTelemetry: 'unavailable' };
const milestone = (id: string, status: TraceLensStep['status'] = 'success'): TraceLensStep => ({ stepId: id, stepIndex: 0, name: id, type: 'system_event', status, startedAt: '2026-10-22T00:00:00Z', durationMs: 0, metadata: { evaluator: true, milestoneId: id }, ...(status === 'failed' ? { error: { message: 'not met' } } : {}) });
const run = (steps: TraceLensStep[]): TraceLensV1Trace => ({ schemaVersion: 'tracelens-v1', runId: 'a', name: 'Pilot', agentName: 'Agent', model: 'test', status: 'success', startedAt: '2026-10-22T00:00:00Z', totalDurationMs: 10, metadata: { benchmark }, steps });

describe('benchmark comparison', () => {
  it('aligns evaluator milestones by stable ID, using the last observation and union of IDs', () => {
    const a = run([milestone('build'), milestone('final', 'failed'), milestone('final')]);
    const b = run([milestone('final'), { ...milestone('communication'), metadata: { milestoneId: 'build', evaluator: false } }, milestone('build'), milestone('extra')]);
    const result = computeRunComparison(a, b);
    expect(result.alignment).toBe('milestone');
    expect(result.stepDiffs.map(s => s.name)).toEqual(['build', 'final', 'extra']);
    expect(result.stepDiffs[1].statusA).toBe('success');
    expect(result.stepDiffs[0].statusMatch).toBe(true);
    expect(result.stepDiffs[2].statusA).toBeUndefined();
  });
  it('preserves sequence comparison for old traces and unknown token totals', () => {
    const a = { ...run([milestone('a')]), metadata: undefined };
    expect(computeRunComparison(a, a).alignment).toBe('sequence');
    expect(computeRunComparison(a, a).tokenDelta).toBeUndefined();
    const b = { ...a, totalTokens: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } };
    expect(computeRunComparison(a, b).tokenDelta).toBeUndefined();
    expect(computeRunComparison(b, b).tokenDelta).toBe(0);
    const malformed = { ...b, totalTokens: { ...b.totalTokens, totalTokens: null } } as unknown as TraceLensV1Trace;
    expect(computeRunComparison(malformed, b).tokenDelta).toBeUndefined();
    expect(computeRunComparison(b, malformed).tokenDelta).toBeUndefined();
  });
  it.each([undefined, { benchmark: {} }, { benchmark: { ...benchmark, taskId: 'other' } }, { benchmark: { ...benchmark, experimentId: 'other' } }])('refuses positional alignment with incompatible benchmark metadata %j', metadata => {
    const result = computeRunComparison(run([milestone('a')]), { ...run([milestone('a')]), metadata });
    expect(result.alignment).toBe('incompatible');
    expect(result.comparisonWarning).toBeTruthy();
    expect(result.stepDiffs).toEqual([]);
  });
});

describe('benchmark validation', () => {
  it.each([demoCoding, demoTravel, demoSupport])('keeps original demos valid', demo => {
    expect(validateTraceLensJson(demo).valid).toBe(true);
  });
  it('accepts distinctly labeled harness self-check evidence', () => {
    expect(validateTraceLensJson({ ...run([]), metadata: { benchmark: { ...benchmark, evidenceKind: 'harness-self-check' } } }).valid).toBe(true);
  });
  it('accepts complete metadata and arbitrary evaluator output', () => {
    expect(validateTraceLensJson(run([{ ...milestone('final'), output: { anything: [true] } }])).valid).toBe(true);
    expect(validateTraceLensJson({ ...run([]), metadata: { legacy: true } }).valid).toBe(true);
  });
  it.each([null, [], {}, { ...benchmark, repetition: 0 }, { ...benchmark, repetition: 1.5 }, { ...benchmark, mode: 'parallel' }, { ...benchmark, condition: 'unknown' }, { ...benchmark, evidenceKind: 'synthetic' }, { ...benchmark, tokenTelemetry: 'partial' }, { ...benchmark, experimentId: '' }, { ...benchmark, taskId: 1 }, { ...benchmark, modelConfig: { model: 'x', effort: 'x', verified: 'yes' } }, { ...benchmark, modelConfig: { model: '', verified: false } }])('rejects malformed benchmark %j', value => {
    expect(validateTraceLensJson({ ...run([]), metadata: { benchmark: value } }).valid).toBe(false);
  });
  it.each([{ milestoneId: '' }, { milestoneId: 4 }, { evaluator: 'true' }])('rejects malformed milestone metadata %j', metadata => {
    expect(validateTraceLensJson(run([{ ...milestone('a'), metadata }])).valid).toBe(false);
  });
});
