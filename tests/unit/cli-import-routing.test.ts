import { expect, it } from 'vitest';
import { parseTraceImport } from '../../src/lib/importTrace';

it('detects Claude public JSON and preserves its cache accounting', () => {
  const result = parseTraceImport(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 'synthetic-claude',
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 }, result: 'Synthetic answer' }), 'claude.json');
  expect(result.valid).toBe(true);
  expect(result.trace?.metadata?.source).toBe('claude-code-stream-json');
  expect(result.trace?.totalTokens?.totalTokens).toBe(180);
});

it('detects Gemini streaming events without treating warnings as a failed CLI', () => {
  const result = parseTraceImport([
    { type: 'init', session_id: 'synthetic-gemini', model: 'synthetic-model' },
    { type: 'error', severity: 'warning', message: 'Synthetic warning' },
    { type: 'result', status: 'success', stats: { input_tokens: 100, output_tokens: 20, total_tokens: 120, cached: 50 } },
  ].map(e => JSON.stringify(e)).join('\n'), 'gemini.jsonl');
  expect(result.valid).toBe(true);
  expect(result.trace?.metadata?.source).toBe('gemini-cli-stream-json');
  expect(result.trace?.status).toBe('success');
  expect(result.trace?.totalTokens?.totalTokens).toBe(120);
});
