import { describe, expect, it } from 'vitest';
import { indexSteps, filterSteps } from '../../src/lib/stepSearch';
import { TraceLensStep } from '../../src/types/trace';

describe('step search', () => {
  const steps: TraceLensStep[] = [
    { stepId: 'a', stepIndex: 0, name: 'Read source', type: 'tool_call', status: 'success', startedAt: '', durationMs: 0, input: { path: 'INPUT-only' }, output: { text: 'OUTPUT-only' } },
    { stepId: 'b', stepIndex: 1, name: 'Explain', type: 'agent_thought', status: 'failed', startedAt: '', durationMs: 0, error: { message: 'ERROR-only', details: { reason: 'nested' } } },
    { stepId: 'c', stepIndex: 2, name: 'Empty', type: 'system_event', status: 'skipped', startedAt: '', durationMs: 0 },
  ];
  it('searches name, structured input/output and error without case sensitivity', () => {
    const index = indexSteps(steps);
    for (const query of [' read ', 'input-ONLY', 'output-only']) expect(filterSteps(index, query, 'all', 'all')).toEqual([steps[0]]);
    for (const query of ['error-only', 'nested']) expect(filterSteps(index, query, 'all', 'all')).toEqual([steps[1]]);
    expect(filterSteps(index, 'missing', 'all', 'all')).toEqual([]);
  });
  it('combines filters, preserves order, and accepts absent payloads', () => {
    const index = indexSteps(steps);
    expect(filterSteps(index, '', 'all', 'all')).toEqual(steps);
    expect(filterSteps(index, '', 'failed', 'agent_thought')).toEqual([steps[1]]);
    expect(filterSteps(index, 'explain', 'success', 'all')).toEqual([]);
    expect(filterSteps(index, '', 'skipped', 'system_event')).toEqual([steps[2]]);
  });
});
