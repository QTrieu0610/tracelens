import { describe, it, expect } from 'vitest';
import { computeStudioAnalytics, computeRunComparison } from '../../src/lib/analytics';
import { TraceLensV1Trace } from '../../src/types/trace';

describe('computeStudioAnalytics', () => {
  const mockRuns: TraceLensV1Trace[] = [
    {
      schemaVersion: 'tracelens-v1',
      runId: 'r1',
      name: 'Run 1',
      agentName: 'A1',
      model: 'm1',
      status: 'success',
      startedAt: '2026-10-20T10:00:00Z',
      totalDurationMs: 1000,
      totalTokens: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      steps: [
        {
          stepId: 's1',
          stepIndex: 0,
          type: 'tool_call',
          name: 'step1',
          status: 'success',
          startedAt: '2026-10-20T10:00:00Z',
          durationMs: 400
        }
      ]
    },
    {
      schemaVersion: 'tracelens-v1',
      runId: 'r2',
      name: 'Run 2',
      agentName: 'A1',
      model: 'm1',
      status: 'failed',
      startedAt: '2026-10-20T10:01:00Z',
      totalDurationMs: 2000,
      totalTokens: { promptTokens: 200, completionTokens: 50, totalTokens: 250 },
      steps: [
        {
          stepId: 's2',
          stepIndex: 0,
          type: 'tool_call',
          name: 'step2',
          status: 'failed',
          startedAt: '2026-10-20T10:01:00Z',
          durationMs: 1200,
          error: { code: 'TimeoutError', message: 'TimeoutError: 5000ms exceeded' }
        }
      ]
    }
  ];

  it('correctly aggregates runs statistics', () => {
    const stats = computeStudioAnalytics(mockRuns);
    expect(stats.totalRuns).toBe(2);
    expect(stats.successCount).toBe(1);
    expect(stats.failureCount).toBe(1);
    expect(stats.successRate).toBe(50);
    expect(stats.totalTokens).toBe(400);
    expect(stats.avgDurationMs).toBe(1500);
    expect(stats.longestSteps[0].stepName).toBe('step2');
    expect(stats.longestSteps[0].durationMs).toBe(1200);
    expect(stats.failureTypes['TimeoutError']).toBe(1);
  });

  it('handles empty run list gracefully', () => {
    const stats = computeStudioAnalytics([]);
    expect(stats.totalRuns).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.longestSteps).toHaveLength(0);
  });

  it('does not report a partial token sum as a complete total', () => {
    const missing = { ...mockRuns[0], totalTokens: undefined };
    expect(computeStudioAnalytics([missing]).totalTokens).toBeUndefined();
    expect(computeStudioAnalytics([mockRuns[1], missing]).totalTokens).toBeUndefined();
  });
});

describe('computeRunComparison', () => {
  const runA: TraceLensV1Trace = {
    schemaVersion: 'tracelens-v1',
    runId: 'rA',
    name: 'Baseline Run',
    agentName: 'DevAgent',
    model: 'gpt-4o',
    status: 'success',
    startedAt: '2026-10-20T10:00:00Z',
    totalDurationMs: 2000,
    totalTokens: { promptTokens: 300, completionTokens: 100, totalTokens: 400 },
    steps: [
      {
        stepId: 's1',
        stepIndex: 0,
        type: 'agent_thought',
        name: 'Planning',
        status: 'success',
        startedAt: '2026-10-20T10:00:00Z',
        durationMs: 500
      },
      {
        stepId: 's2',
        stepIndex: 1,
        type: 'tool_call',
        name: 'fetch_data',
        status: 'success',
        startedAt: '2026-10-20T10:00:00.500Z',
        durationMs: 1500
      }
    ]
  };

  const runB: TraceLensV1Trace = {
    schemaVersion: 'tracelens-v1',
    runId: 'rB',
    name: 'Target Run',
    agentName: 'DevAgent',
    model: 'gpt-4o',
    status: 'failed',
    startedAt: '2026-10-20T10:05:00Z',
    totalDurationMs: 3200,
    totalTokens: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
    steps: [
      {
        stepId: 's1',
        stepIndex: 0,
        type: 'agent_thought',
        name: 'Planning',
        status: 'success',
        startedAt: '2026-10-20T10:05:00Z',
        durationMs: 700
      },
      {
        stepId: 's2',
        stepIndex: 1,
        type: 'tool_call',
        name: 'fetch_data',
        status: 'failed',
        startedAt: '2026-10-20T10:05:00.700Z',
        durationMs: 2500,
        error: { code: 'HTTP_500', message: 'Internal Server Error' }
      }
    ]
  };

  it('computes timing, token and status deltas accurately', () => {
    const diff = computeRunComparison(runA, runB);
    expect(diff.durationDeltaMs).toBe(1200);
    expect(diff.tokenDelta).toBe(150);
    expect(diff.statusChanged).toBe(true);
    expect(diff.stepDiffs).toHaveLength(2);

    // Step 0 check
    expect(diff.stepDiffs[0].statusMatch).toBe(true);
    expect(diff.stepDiffs[0].durationDiffMs).toBe(200);

    // Step 1 check
    expect(diff.stepDiffs[1].statusMatch).toBe(false);
    expect(diff.stepDiffs[1].statusA).toBe('success');
    expect(diff.stepDiffs[1].statusB).toBe('failed');
    expect(diff.stepDiffs[1].durationDiffMs).toBe(1000);
  });
});
