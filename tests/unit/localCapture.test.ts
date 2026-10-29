import { expect, it } from 'vitest';
import { parseLocalCapture } from '../../src/lib/localCapture';

const raw = [
  { type: 'thread.started', thread_id: 'local-capture-unit' }, { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'a', type: 'agent_message', text: 'Finished' } },
  { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } },
].map(e => JSON.stringify(e)).join('\n');

it('never promotes completed log events over a failed or unfinished capture process', () => {
  for (const status of ['failed', 'running'] as const) {
    const trace = parseLocalCapture(raw, { id: 'capture-1', provider: 'codex', status, startedAt: '2026-10-29T00:00:00Z', bytes: 100, exitCode: 7 });
    expect(trace.status).toBe(status === 'failed' ? 'failed' : 'running');
    expect(trace.totalTokens).toBeUndefined();
    expect(trace.metadata?.localCapture.observedTokens.totalTokens).toBe(12);
    expect(trace.runId).toBe('capture-1');
  }
});

it('retains valid completed telemetry and rejects malformed logs', () => {
  const capture = { id: 'capture-2', provider: 'codex', status: 'completed' as const, startedAt: '2026-10-29T00:00:00Z', bytes: 100, exitCode: 0 };
  expect(parseLocalCapture(raw, capture).totalTokens?.totalTokens).toBe(12);
  expect(() => parseLocalCapture('{bad', capture)).toThrow(/Malformed/);
});
