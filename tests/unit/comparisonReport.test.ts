import { describe, expect, it } from 'vitest';
import { buildComparisonReport } from '../../src/lib/comparisonReport';
import { computeRunComparison } from '../../src/lib/analytics';
import type { TraceLensV1Trace } from '../../src/types/trace';

const run: TraceLensV1Trace = {
  schemaVersion: 'tracelens-v1', runId: 'secret-id', name: '<script>private</script> | [link](https://private)',
  agentName: 'secret-agent', model: 'secret-model', status: 'success', startedAt: '', totalDurationMs: 0,
  metadata: { import: { timingKnown: false }, prompt: 'secret-prompt' },
  steps: [{ stepId: 'secret-step', stepIndex: 0, name: 'secret-command', type: 'tool_call', status: 'failed', startedAt: '', durationMs: 0,
    error: { message: 'secret-error' }, input: 'secret-path', output: 'secret-output' }],
};

describe('comparison report', () => {
  it('projects only aggregate evidence and makes missing timing and tokens explicit', () => {
    const text = buildComparisonReport(computeRunComparison(run, run));
    for (const secret of ['private', 'secret-', '<script>']) expect(text).not.toContain(secret);
    expect(text).toContain('Run A');
    expect(text).toContain('Unknown');
    expect(text).toContain('Unverified');
    expect(text).toContain('positional');
    expect(text).toContain('semantic regression');
  });

  it('includes names only by opt-in and escapes Markdown and HTML', () => {
    const text = buildComparisonReport(computeRunComparison(run, run), { includeRunNames: true });
    expect(text).toContain('&lt;script&gt;private&lt;/script&gt;');
    expect(text).toContain('\\|');
    expect(text).toContain('\\[link\\]');
    expect(text).not.toContain('secret-command');
  });

  it('reports latest evaluator counts and partial telemetry without exposing milestone IDs or warnings', () => {
    const evidence: TraceLensV1Trace = {
      ...run, totalTokens: { promptTokens: 8, completionTokens: 2, totalTokens: 10 },
      metadata: { import: { timingKnown: false, telemetryComplete: false, cachedInputTokens: 4, warnings: ['secret-warning'] } },
      steps: ['failed', 'success'].map((status, stepIndex) => ({ ...run.steps[0], stepIndex, status: status as 'failed' | 'success', metadata: { evaluator: true, milestoneId: 'secret-milestone' } })),
    };
    const comparison = computeRunComparison(evidence, evidence);
    const text = buildComparisonReport({ ...comparison, alignment: 'incompatible' });
    expect(text).toContain('1/1 checks passed');
    expect(text).toContain('Tokens: 10; telemetry: partial / unavailable');
    expect(text).toContain('Cached input tokens: 4');
    expect(text).toContain('No steps are aligned');
    expect(text).not.toContain('secret-');
  });
});
