import { describe, expect, it } from 'vitest';
import { parseTraceImport } from '../../src/lib/importTrace';

const lines = (...events: unknown[]) => events.map(e => JSON.stringify(e)).join('\n');
const start = [{ type: 'thread.started', thread_id: 'thread-one' }, { type: 'turn.started' }];
const complete = { type: 'turn.completed', usage: { input_tokens: 17000, cached_input_tokens: 12000, output_tokens: 281, reasoning_output_tokens: 200 } };

describe('Codex exec import', () => {
  it('explains how to fix Gemini single JSON input instead of showing unrelated schema errors', () => {
    const result = parseTraceImport(JSON.stringify({ response: 'Synthetic response', stats: {} }));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('--output-format stream-json');
  });
  it('uses a valid fallback name for a filename containing only an extension', () => {
    const result = parseTraceImport(lines(...start, complete), '.jsonl');
    expect(result.trace?.name).toBe('Codex run');
  });
  it('accepts mixed timestamp coverage while leaving all timing unknown', () => {
    const result = parseTraceImport(lines(...start,
      { type: 'item.completed', timestamp: '2026-10-23T10:00:00Z', item: { id: 'a', type: 'agent_message', text: 'Timed' } },
      { type: 'item.completed', item: { id: 'b', type: 'agent_message', text: 'Untimed' } }, complete));
    expect(result.valid).toBe(true);
    expect(result.trace?.metadata?.import).toMatchObject({ timingKnown: false });
    expect(result.trace?.steps.every(step => step.startedAt === '1970-01-01T00:00:00.000Z')).toBe(true);
  });
  it('applies the import limit to pasted content before parsing', () => {
    expect(parseTraceImport(' '.repeat(10 * 1024 * 1024 + 1)).errors[0].message).toContain('10 MB');
  });
  it('imports usage without double counting cached/reasoning subsets and preserves unknown timing', () => {
    const result = parseTraceImport(lines(...start, { type: 'item.completed', item: { id: 'a', type: 'agent_message', text: 'Done' } }, complete), 'my-run.jsonl');
    expect(result.valid).toBe(true);
    expect(result.trace?.totalTokens?.totalTokens).toBe(17281);
    expect(result.trace?.metadata?.import).toMatchObject({ timingKnown: false, acceptance: 'unverified', cachedInputTokens: 12000, reasoningOutputTokens: 200, telemetryComplete: true });
    expect(result.trace?.steps[0]).toMatchObject({ type: 'system_event', output: 'Done' });
    expect(result.trace?.totalDurationMs).toBe(0);
  });
  it('merges item updates and records failed commands even when the turn completes', () => {
    const item = { id: 'cmd', type: 'command_execution', command: 'npm test' };
    const result = parseTraceImport(lines(...start, { type: 'item.started', item }, { type: 'item.updated', item: { ...item, aggregated_output: 'progress' } }, { type: 'item.completed', item: { ...item, exit_code: 1, aggregated_output: 'failed' } }, complete));
    expect(result.trace?.steps).toHaveLength(1);
    expect(result.trace?.steps[0]).toMatchObject({ status: 'failed', output: 'failed', error: { message: expect.stringContaining('1') } });
    expect(result.trace?.status).toBe('success');
  });
  it('keeps truncated and missing telemetry unknown', () => {
    expect(parseTraceImport(lines(...start)).trace?.totalTokens).toBeUndefined();
    const result = parseTraceImport(lines(...start, { type: 'turn.completed' }));
    expect(result.trace?.totalTokens).toBeUndefined();
    expect(result.trace?.metadata?.import).toMatchObject({ telemetryComplete: false });
  });
  it.each([null, -1, 1.2, Number.MAX_SAFE_INTEGER + 1])('rejects invalid usage %s', value => {
    expect(parseTraceImport(lines(...start, { ...complete, usage: { input_tokens: value, output_tokens: 1 } })).valid).toBe(false);
  });
  it('reports malformed lines and unsupported rollout envelopes', () => {
    expect(parseTraceImport(lines(...start) + '\n{').errors[0].path).toBe('line 3');
    expect(parseTraceImport(lines({ type: 'session_meta', payload: {} })).errors[0].message).toContain('Unsupported');
    expect(parseTraceImport(lines({ type: 'thread.started', thread_id: 'a' })).valid).toBe(true);
  });
  it('rejects multiple threads and invalid lifecycle', () => {
    expect(parseTraceImport(lines(...start, { type: 'thread.started', thread_id: 'b' })).valid).toBe(false);
    expect(parseTraceImport(lines(complete)).valid).toBe(false);
    expect(parseTraceImport(lines(...start, { type: 'turn.started' })).valid).toBe(false);
  });
  it('retains observed usage without asserting a total on an unfinished later turn', () => {
    const result = parseTraceImport(lines(...start, complete, { type: 'turn.started' }));
    expect(result.trace?.totalTokens).toBeUndefined();
    expect(result.trace?.metadata?.import).toMatchObject({ observedTokens: { totalTokens: 17281 }, telemetryComplete: false });
  });
  it('uses stable content-sensitive IDs and warns about forward-compatible events', () => {
    const raw = lines(...start, complete);
    expect(parseTraceImport(raw).trace?.runId).toBe(parseTraceImport(raw).trace?.runId);
    const changed = parseTraceImport(raw + '\n' + lines({ type: 'future.event' }));
    expect(changed.trace?.runId).not.toBe(parseTraceImport(raw).trace?.runId);
    expect((changed.trace?.metadata?.import as { warnings: string[] }).warnings).not.toHaveLength(0);
  });
  it('only reports timing when every event has a valid timestamp', () => {
    const events = [...start, complete].map((event, i) => ({ ...event, timestamp: `2026-10-23T10:00:0${i}.000Z` }));
    expect(parseTraceImport(lines(...events)).trace?.totalDurationMs).toBe(2000);
    expect(parseTraceImport(lines(...events)).trace?.metadata?.import).toMatchObject({ timingKnown: true });
    expect(parseTraceImport(lines(...events, { type: 'future.event' })).trace?.metadata?.import).toMatchObject({ timingKnown: false });
  });
  it('retains existing TraceLens validation and imports a failed CLI turn', () => {
    const result = parseTraceImport(lines(...start, { type: 'turn.failed', error: { message: 'Network unavailable' } }));
    expect(result.trace?.status).toBe('failed');
    expect(result.trace?.steps[0].error?.message).toBe('Network unavailable');
    expect(parseTraceImport(JSON.stringify(result.trace)).trace).toEqual(result.trace);
  });
  it('preserves output from updates when completion omits output', () => {
    const item = { id: 'cmd', type: 'command_execution', command: 'npm test' };
    const result = parseTraceImport(lines(...start, { type: 'item.updated', item: { ...item, aggregated_output: 'passed' } }, { type: 'item.completed', item: { ...item, exit_code: 0 } }, complete));
    expect(result.trace?.steps[0].output).toBe('passed');
  });
  it('does not invent cached usage when the provider omits the breakdown', () => {
    const result = parseTraceImport(lines(...start, { type: 'turn.completed', usage: { input_tokens: 5, output_tokens: 1 } }));
    expect((result.trace?.metadata?.import as Record<string, unknown>).cachedInputTokens).toBeUndefined();
    expect(result.trace?.totalTokens?.totalTokens).toBe(6);
  });
});
