import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseClaudeEvents } from '../../src/lib/importClaude';

const init = { type: 'system', subtype: 'init', session_id: 's', model: 'claude-test' };
const result = { type: 'result', subtype: 'success', session_id: 's', is_error: false, usage: { input_tokens: 10, cache_creation_input_tokens: 20, cache_read_input_tokens: 30, output_tokens: 4 }, result: 'Done' };
const parse = (...events: Record<string, unknown>[]) => parseClaudeEvents(events, 'sample.jsonl', events.map(e => JSON.stringify(e)).join('\n'));
const tool = { type: 'assistant', session_id: 's', message: { content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'npm test' } }] } };
const output = { type: 'user', session_id: 's', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: 'Tests failed', is_error: true }] } };

describe('Claude public output import', () => {
  it('correlates failed tools without treating CLI completion as task acceptance', () => {
    const imported = parse(init, tool, output, result);
    expect(imported.valid).toBe(true);
    expect(imported.trace).toMatchObject({ status: 'success', agentName: 'Claude Code', model: 'claude-test', totalTokens: { promptTokens: 60, completionTokens: 4, totalTokens: 64 }, totalDurationMs: 0 });
    expect(imported.trace?.metadata?.import).toMatchObject({ acceptance: 'unverified', timingKnown: false, telemetryComplete: true, cachedInputTokens: 30, cacheCreationInputTokens: 20 });
    expect(imported.trace?.steps[0]).toMatchObject({ type: 'tool_call', status: 'failed', input: { command: 'npm test' }, output: 'Tests failed', error: { message: 'Tests failed' } });
  });
  it('accepts standalone result and derives CLI failure from its subtype', () => {
    expect(parse({ ...result, subtype: 'error_max_turns', is_error: false }).trace?.status).toBe('failed');
    expect(parse({ ...result, is_error: true }).trace?.status).toBe('failed');
  });
  it('leaves usage and completion unknown without final telemetry', () => {
    const imported = parse(init, { type: 'assistant', message: { usage: { input_tokens: 999 }, content: [{ type: 'text', text: 'Hello' }, { type: 'thinking', thinking: 'private' }] } });
    expect(imported.trace?.status).toBe('running');
    expect(imported.trace?.totalTokens).toBeUndefined();
    expect(imported.trace?.metadata?.import).toMatchObject({ telemetryComplete: false });
    expect(imported.trace?.steps).toHaveLength(1);
    expect(imported.trace?.steps[0]).toMatchObject({ type: 'system_event', output: 'Hello' });
    expect(JSON.stringify(imported)).not.toContain('private');
    expect(parse({ ...result, usage: undefined }).trace?.totalTokens).toBeUndefined();
  });
  it.each([-1, 0.5, '4', Number.MAX_SAFE_INTEGER + 1])('rejects invalid final tokens %s', bad => {
    expect(parse({ ...result, usage: { ...result.usage, output_tokens: bad } }).valid).toBe(false);
  });
  it('rejects mixed sessions, repeated results and ambiguous tool associations', () => {
    for (const events of [[init, { ...result, session_id: 'other' }], [result, result], [init, tool, tool], [init, output], [init, tool, output, output], [result, init], [result, { type: 'future_event' }]]) expect(parse(...events).valid).toBe(false);
  });
  it('keeps incomplete usage unknown and checks safe summed totals', () => {
    expect(parse({ ...result, usage: { input_tokens: 10, output_tokens: 4 } }).trace?.totalTokens).toBeUndefined();
    expect(parse({ ...result, usage: { ...result.usage, input_tokens: Number.MAX_SAFE_INTEGER } }).valid).toBe(false);
  });
  it('uses stable content-sensitive IDs and unknown timing even with duration_ms', () => {
    expect(parse(result).trace?.runId).toBe(parse(result).trace?.runId);
    expect(parse(result).trace?.runId).not.toBe(parse({ ...result, result: 'Changed' }).trace?.runId);
    expect(parse({ ...result, duration_ms: 4000 }).trace?.totalDurationMs).toBe(0);
  });
  it('accepts nullable optional tool result fields from the SDK schema', () => {
    const imported = parse(init, tool, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't', content: null, is_error: null }] } }, { ...result, usage: null });
    expect(imported.valid).toBe(true);
    expect(imported.trace?.steps[0]).toMatchObject({ status: 'success', output: null });
    expect(imported.trace?.totalTokens).toBeUndefined();
  });
  it('imports the synthetic read then failing test example', () => {
    const content = readFileSync('public/examples/claude-synthetic.jsonl', 'utf8');
    const imported = parseClaudeEvents(content.trim().split('\n').map(line => JSON.parse(line)), 'example', content);
    expect(imported.valid).toBe(true);
    expect(imported.trace?.steps.filter(step => step.type === 'tool_call').map(step => step.status)).toEqual(['success', 'failed']);
    expect(imported.trace?.status).toBe('success');
  });
});
