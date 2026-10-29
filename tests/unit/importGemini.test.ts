import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGeminiEvents } from '../../src/lib/importGemini';

const init = { type: 'init', session_id: 'synthetic', model: 'gemini-test' };
const result = { type: 'result', status: 'success', stats: { input_tokens: 12, output_tokens: 3, total_tokens: 15, cached: 2, input: 10, duration_ms: 100 } };
const parse = (events: Record<string, unknown>[]) => parseGeminiEvents(events, 'test.jsonl', JSON.stringify(events));

describe('Gemini CLI stream JSON import', () => {
  it('imports the synthetic fixture, preserving failed tools despite CLI success', () => {
    const content = readFileSync('public/examples/gemini-synthetic.jsonl', 'utf8');
    const imported = parseGeminiEvents(content.trim().split('\n').map(line => JSON.parse(line)), 'gemini-synthetic.jsonl', content);
    expect(imported.valid).toBe(true);
    expect(imported.trace?.status).toBe('success');
    expect(imported.trace?.steps.filter(step => step.type === 'tool_call').map(step => step.status)).toEqual(['success', 'failed']);
    expect(imported.trace?.totalTokens).toEqual({ promptTokens: 12, completionTokens: 3, totalTokens: 15 });
    expect(imported.trace?.metadata?.import).toMatchObject({ telemetryComplete: true, timingKnown: true, acceptance: 'unverified', cachedInputTokens: 2 });
    expect(imported.trace?.steps.find(step => step.type === 'tool_call')?.durationMs).toBe(1000);
  });
  it('keeps missing usage and timing unknown, and unfinished sessions running', () => {
    const trace = parse([init, { type: 'message', role: 'assistant', content: '<script>inert</script>', delta: true }]).trace!;
    expect(trace.status).toBe('running');
    expect(trace.totalTokens).toBeUndefined();
    expect(trace.startedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(trace.metadata?.import).toMatchObject({ timingKnown: false, telemetryComplete: false });
    expect(trace.steps[0].output).toBe('<script>inert</script>');
    expect(trace.steps[0].thought).toBeUndefined();
  });
  it('keeps warnings successful and terminal errors failed', () => {
    expect(parse([init, { type: 'error', severity: 'warning', message: 'retry' }, result]).trace?.steps[0].status).toBe('success');
    expect(parse([init, { type: 'result', status: 'error', error: { type: 'API', message: 'failed' } }]).trace?.status).toBe('failed');
  });
  it.each([
    [], [result], [init, init], [init, result, result], [init, result, { type: 'message', role: 'user', content: 'late' }],
    [init, { type: 'message', role: 'user', content: 'x', session_id: 'other' }],
    [init, { type: 'tool_result', tool_id: 'missing', status: 'success' }],
    [init, { type: 'tool_use', tool_id: 'a', tool_name: 'read', parameters: {} }, { type: 'tool_use', tool_id: 'a', tool_name: 'read', parameters: {} }],
    [init, { ...result, stats: { ...result.stats, total_tokens: 1 } }],
    [init, { ...result, stats: { ...result.stats, cached: 13 } }],
    [init, { ...result, stats: { ...result.stats, input_tokens: 1.5 } }],
    [init, { type: 'message', role: 'assistant', content: 1 }],
  ])('rejects malformed or mixed streams %#', (...events) => { expect(parse(events as Record<string, unknown>[]).valid).toBe(false); });
  it('rejects reversed timestamps', () => {
    expect(parse([{ ...init, timestamp: '2026-01-01T00:00:02Z' }, { ...result, timestamp: '2026-01-01T00:00:01Z' }]).valid).toBe(false);
  });
  it('uses stable IDs and does not double count per-model usage', () => {
    const events = [init, { ...result, stats: { ...result.stats, models: { test: result.stats } } }];
    expect(parse(events).trace?.totalTokens?.totalTokens).toBe(15);
    expect(parse(events).trace?.runId).toBe(parse(events).trace?.runId);
  });
  it('does not substitute final stats duration for missing event timing', () => {
    const trace = parse([{ ...init, timestamp: '2026-01-01T00:00:00Z' }, result]).trace!;
    expect(trace.totalDurationMs).toBe(0);
    expect(trace.startedAt).toBe('1970-01-01T00:00:00.000Z');
    expect(trace.metadata?.import).toMatchObject({ timingKnown: false, telemetryComplete: true });
    expect(trace.steps.every(step => step.startedAt === trace.startedAt)).toBe(true);
  });
  it('rejects repeated tool results and invalid model statistics', () => {
    const use = { type: 'tool_use', tool_name: 'read', tool_id: 'a', parameters: {} };
    const done = { type: 'tool_result', tool_id: 'a', status: 'success', output: 'done' };
    expect(parse([init, use, done, done]).valid).toBe(false);
    expect(parse([init, { ...result, stats: { ...result.stats, models: { bad: { ...result.stats, total_tokens: 1 } } } }]).valid).toBe(false);
  });
  it('retains provider totals including extra categories without inventing comparable usage', () => {
    const stats = { ...result.stats, total_tokens: 20 };
    const imported = parse([init, { ...result, stats: { ...stats, models: { test: stats } } }]);
    expect(imported.valid).toBe(true);
    expect(imported.trace?.totalTokens).toBeUndefined();
    expect(imported.trace?.metadata?.import).toMatchObject({ telemetryComplete: false, providerTotalTokens: 20 });
    expect((imported.trace?.metadata?.import as { warnings: string[] }).warnings.join(' ')).toMatch(/provider total.*differs/i);
  });
  it('warns when final result arrives with an unfinished tool', () => {
    const trace = parse([init, { type: 'tool_use', tool_name: 'read', tool_id: 'a', parameters: {} }, result]).trace!;
    expect(trace.steps[0].status).toBe('running');
    expect((trace.metadata?.import as { warnings: string[] }).warnings.join(' ')).toMatch(/tool.*missing.*result/i);
  });
});
