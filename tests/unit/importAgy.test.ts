import { expect, it } from 'vitest';
import { parseTraceImport } from '../../src/lib/importTrace';
import { getTelemetrySummary } from '../../src/lib/runEvidence';

const init = { event: 'init', conversation_id: 'synthetic-agy', init: { tools: ['run_command'] } };
const update = (state: string, text_delta: string) => ({ event: 'step_update', step_update: { conversation_id: 'synthetic-agy', step_index: 1, step_type: 'agent_response', state, text_delta } });
const result = { event: 'result', result: { conversation_id: 'synthetic-agy', status: 'SUCCESS', response: 'TELEMETRY_OK\n', duration_seconds: 8.5, usage: { input_tokens: 100, output_tokens: 20, thinking_tokens: 15, cache_read_tokens: 30, total_tokens: 120 } } };
const parse = (...events: unknown[]) => parseTraceImport(events.map(event => JSON.stringify(event)).join('\n'), 'agy-smoke.jsonl');

it('imports AGY final usage once, preserving deltas and unknown timestamps', () => {
  const imported = parse(init, update('ACTIVE', 'TELEMETRY_'), update('DONE', 'OK\n'), result);
  expect(imported.valid).toBe(true);
  expect(imported.trace?.metadata?.source).toBe('antigravity-stream-json');
  expect(imported.trace?.status).toBe('success');
  expect(imported.trace?.steps).toHaveLength(1);
  expect(imported.trace?.steps[0].output).toBe('TELEMETRY_OK\n');
  expect(imported.trace?.totalTokens?.totalTokens).toBe(120);
  expect(imported.trace?.metadata?.import).toMatchObject({ cachedInputTokens: 30, reasoningOutputTokens: 15, sourceDurationMs: 8500, timingKnown: false });
  expect(getTelemetrySummary(imported.trace!).sourceDurationMs).toBe(8500);
});

it('does not treat the advertised tools list as executed tools', () => {
  expect(parse(init, result).trace?.steps.some(step => step.type === 'tool_call')).toBe(false);
  expect(parse(init, result).trace?.steps[0].output).toBe('TELEMETRY_OK\n');
});

it('keeps interrupted runs and missing terminal usage unknown', () => {
  const interrupted = parse(init, update('ACTIVE', 'Partial')).trace;
  expect(interrupted?.status).toBe('running');
  expect(interrupted?.totalTokens).toBeUndefined();
  expect(parse(init, { ...result, result: { ...result.result, usage: undefined } }).trace?.totalTokens).toBeUndefined();
});

it('does not sum repeated step usage and terminal usage', () => {
  const step = update('DONE', 'TELEMETRY_OK');
  expect(parse(init, { ...step, step_update: { ...step.step_update, usage: result.result.usage } }, result).trace?.totalTokens?.totalTokens).toBe(120);
});

it.each([-1, 1.2, null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid AGY token counts %s', input_tokens => {
  expect(parse(init, { ...result, result: { ...result.result, usage: { ...result.result.usage, input_tokens } } }).valid).toBe(false);
});

it('rejects mixed conversations, malformed steps and events after the terminal result', () => {
  expect(parse(init, { ...result, result: { ...result.result, conversation_id: 'other' } }).valid).toBe(false);
  expect(parse(init, { event: 'step_update', step_update: { step_index: -1 } }).valid).toBe(false);
  expect(parse(init, result, result).valid).toBe(false);
});

it('preserves unknown action steps as actions rather than assistant responses', () => {
  const step = update('DONE', 'Synthetic command output');
  const imported = parse(init, { ...step, step_update: { ...step.step_update, step_type: 'run_command' } }, result);
  expect(imported.valid).toBe(true);
  expect(imported.trace?.steps[0].type).toBe('tool_call');
});

it('preserves failed CLI results without claiming successful task acceptance', () => {
  const imported = parse(init, { ...result, result: { ...result.result, status: 'ERROR', response: 'Synthetic failure' } });
  expect(imported.valid).toBe(true);
  expect(imported.trace?.status).toBe('failed');
  expect(imported.trace?.steps.some(step => step.status === 'failed' && !!step.error)).toBe(true);
});

it('keeps AGY tool names, arguments, outputs and permission denial evidence', () => {
  const tool = { conversation_id: 'synthetic-agy', step_index: 2, step_type: 'tool', tool_name: 'run_command',
    tool_info: { name: 'run_command', parameters: { CommandLine: 'node --test addition.test.mjs' } } };
  const denied = { ...tool, state: 'ERROR', tool_info: { ...tool.tool_info, error: { type: 'TOOL_ERROR', message: 'permission check failed: command denied' } } };
  const imported = parse(init, { event: 'step_update', step_update: { ...tool, state: 'ACTIVE' } },
    { event: 'step_update', step_update: denied },
    { ...result, result: { ...result.result, response: '', denied_actions: [{ action: 'command', display_name: 'RunCommand' }] } });
  expect(imported.valid).toBe(true);
  expect(imported.trace?.status).toBe('success'); // Source CLI status is separate from failed tools.
  expect(imported.trace?.steps[0]).toMatchObject({ name: 'run_command', type: 'tool_call', status: 'failed',
    input: { CommandLine: 'node --test addition.test.mjs' }, error: { message: 'permission check failed: command denied' } });
  expect(getTelemetrySummary(imported.trace!).warnings.join(' ')).toMatch(/denied/i);
  expect(imported.trace?.metadata?.import.deniedActions).toEqual([{ action: 'command', display_name: 'RunCommand' }]);
  const completed = parse(init, { event: 'step_update', step_update: { ...tool, state: 'DONE', tool_info: { ...tool.tool_info, output: '1 failed; exit code 1' } } }, result);
  expect(completed.trace?.steps[0].output).toBe('1 failed; exit code 1');
});
