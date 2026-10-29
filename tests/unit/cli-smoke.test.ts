import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../scripts/cli-smoke.mjs';
import { parseTraceImport } from '../../src/lib/importTrace';

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
const setup = () => { const folder = mkdtempSync(join(tmpdir(), 'tracelens-smoke-')); folders.push(folder); return folder; };
const events = [
  { type: 'thread.started', thread_id: 'synthetic-test' }, { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'a', type: 'agent_message', text: 'TELEMETRY_OK' } },
  { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } },
].map(event => JSON.stringify(event)).join('\n');

it('captures and verifies real subprocess output without claiming task acceptance', async () => {
  const outputDir = setup();
  const result = await runCli({ provider: 'codex', command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(events)})`] }, outputDir, parseTraceImport });
  expect(result.status).toBe('passed');
  expect(result.totalTokens).toBe(12);
  expect(result.acceptance).toBe('unverified');
  expect(readFileSync(join(outputDir, 'stdout.jsonl'), 'utf8')).toBe(events);
});

it('reports unavailable CLI without manufacturing telemetry', async () => {
  const result = await runCli({ provider: 'gemini', outputDir: setup(), parseTraceImport });
  expect(result.status).toBe('unavailable');
  expect(result.totalTokens).toBeUndefined();
});

it('verifies AGY terminal response without treating its advertised tools as actions', async () => {
  const raw = [
    { event: 'init', conversation_id: 'synthetic-agy', init: { tools: ['run_command'] } },
    { event: 'result', result: { conversation_id: 'synthetic-agy', status: 'SUCCESS', response: 'TELEMETRY_OK', usage: { input_tokens: 100, output_tokens: 20, thinking_tokens: 15, total_tokens: 120 } } },
  ].map(event => JSON.stringify(event)).join('\n');
  const result = await runCli({ provider: 'agy', command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(raw)})`] }, outputDir: setup(), parseTraceImport });
  expect(result.status).toBe('passed');
  expect(result.totalTokens).toBe(120);
});

it('checks Gemini assistant deltas without including the echoed user prompt', async () => {
  const raw = [
    { type: 'init', session_id: 'synthetic-gemini-smoke', model: 'synthetic-model' },
    { type: 'message', role: 'user', content: 'Reply exactly TELEMETRY_OK.' },
    { type: 'message', role: 'assistant', content: 'TELEMETRY_', delta: true },
    { type: 'message', role: 'assistant', content: 'OK', delta: true },
    { type: 'result', status: 'success', stats: { input_tokens: 10, output_tokens: 2, total_tokens: 12 } },
  ].map(event => JSON.stringify(event)).join('\n');
  const result = await runCli({ provider: 'gemini', command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(raw)})`] }, outputDir: setup(), parseTraceImport });
  expect(result.status).toBe('passed');
  expect(result.totalTokens).toBe(12);
});

it('does not claim a passed smoke check just because the CLI exited successfully', async () => {
  const raw = events.replace('TELEMETRY_OK', 'Different answer');
  const result = await runCli({ provider: 'codex', command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(raw)})`] }, outputDir: setup(), parseTraceImport });
  expect(result.status).toBe('response-mismatch');
});

it('rejects Codex action items even when the importer presents them as system events', async () => {
  const raw = events.replace('{"type":"item.completed"', JSON.stringify({ type: 'item.completed', item: { id: 'search', type: 'web_search', query: 'synthetic query' } }) + '\n{"type":"item.completed"');
  const result = await runCli({ provider: 'codex', command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(raw)})`] }, outputDir: setup(), parseTraceImport });
  expect(result.status).toBe('response-mismatch');
});

it('preserves failed process diagnostics instead of reporting a passing import', async () => {
  const outputDir = setup();
  const result = await runCli({ provider: 'codex', command: { executable: process.execPath, args: ['-e', "process.stderr.write('Synthetic authentication unavailable'); process.exit(1)"] }, outputDir, parseTraceImport });
  expect(result.status).toBe('cli-error');
  expect(result.exitCode).toBe(1);
  expect(readFileSync(join(outputDir, 'stderr.log'), 'utf8')).toContain('Synthetic authentication unavailable');
});

it('times out an unfinished process and reports no success', async () => {
  const result = await runCli({ provider: 'codex', command: { executable: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] }, outputDir: setup(), parseTraceImport, timeoutMs: 100 });
  expect(result.status).toBe('timeout');
});
