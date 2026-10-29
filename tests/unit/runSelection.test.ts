import { describe, expect, it } from 'vitest';
import demo from '../../fixtures/demo-coding-agent.json';
import { TraceLensV1Trace } from '../../src/types/trace';
import { selectAnalyticsRuns, getRunSelectionFields } from '../../src/lib/runSelection';

const real = { ...demo, runId: 'real', tags: ['coding'], model: 'model-a', metadata: { source: 'codex-exec-jsonl' } } as TraceLensV1Trace;

describe('analytics run selection', () => {
  it('excludes recognized demos unless explicitly included', () => {
    const legacy = { ...real, runId: 'codex-synthetic-before-a123bc' };
    const runs = [demo as TraceLensV1Trace, legacy, real];
    expect(selectAnalyticsRuns(runs, {})).toEqual([real]);
    expect(selectAnalyticsRuns(runs, { includeExamples: true })).toEqual(runs);
  });

  it('intersects source, model and tag filters without changing runs', () => {
    const other = { ...real, runId: 'other', model: 'model-b' };
    expect(selectAnalyticsRuns([real, other], { source: 'codex-exec-jsonl', model: 'model-a', tag: 'coding' })).toEqual([real]);
    expect(selectAnalyticsRuns([real], { tag: 'missing' })).toEqual([]);
    expect(real.tags).toEqual(['coding']);
  });

  it('keeps unknown fields selectable and handles empty libraries', () => {
    const unknown = { ...real, model: '', tags: undefined, metadata: { source: {} } };
    expect(getRunSelectionFields(unknown)).toEqual({ source: null, model: null });
    expect(selectAnalyticsRuns([unknown, real], { source: null, model: null, tag: null })).toEqual([unknown]);
    expect(selectAnalyticsRuns([], {})).toEqual([]);
  });
});
