import { describe, it, expect } from 'vitest';
import { validateTraceLensJson } from '../../src/lib/validator';

describe('validateTraceLensJson', () => {
  const validTrace = {
    schemaVersion: 'tracelens-v1',
    runId: 'run-123',
    name: 'Test Execution',
    agentName: 'SearchAgent',
    model: 'gemini-1.5-pro',
    status: 'success',
    startedAt: '2026-10-20T10:00:00.000Z',
    totalDurationMs: 4200,
    steps: [
      {
        stepId: 'step-1',
        stepIndex: 0,
        type: 'user_input',
        name: 'Query input',
        status: 'success',
        startedAt: '2026-10-20T10:00:00.000Z',
        durationMs: 100
      },
      {
        stepId: 'step-2',
        stepIndex: 1,
        type: 'tool_call',
        name: 'search_web',
        status: 'success',
        startedAt: '2026-10-20T10:00:00.150Z',
        durationMs: 800
      }
    ]
  };

  it('accepts a fully valid TraceLens V1 trace', () => {
    const res = validateTraceLensJson(validTrace);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.trace?.runId).toBe('run-123');
  });

  it('rejects missing or wrong schemaVersion', () => {
    const invalid = { ...validTrace, schemaVersion: 'v2' };
    const res = validateTraceLensJson(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'schemaVersion')).toBe(true);
  });

  it('rejects missing required root fields', () => {
    const invalid = { ...validTrace, runId: '', model: '' };
    const res = validateTraceLensJson(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'runId')).toBe(true);
    expect(res.errors.some(e => e.path === 'model')).toBe(true);
  });

  it('rejects invalid step types and negative durations', () => {
    const invalid = {
      ...validTrace,
      steps: [
        {
          stepId: 'step-1',
          stepIndex: 0,
          type: 'invalid_type',
          name: 'Bad Step',
          status: 'success',
          startedAt: '2026-10-20T10:00:00.000Z',
          durationMs: -50
        }
      ]
    };
    const res = validateTraceLensJson(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'steps[0].type')).toBe(true);
    expect(res.errors.some(e => e.path === 'steps[0].durationMs')).toBe(true);
  });

  it('requires error details when a step status is failed', () => {
    const invalid = {
      ...validTrace,
      steps: [
        {
          stepId: 'step-1',
          stepIndex: 0,
          type: 'tool_call',
          name: 'execute_command',
          status: 'failed',
          startedAt: '2026-10-20T10:00:00.000Z',
          durationMs: 300
          // missing error object
        }
      ]
    };
    const res = validateTraceLensJson(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.path === 'steps[0].error')).toBe(true);
  });

  it('rejects malformed tokens and display fields before they reach analytics or reports', () => {
    for (const totalTokens of ['private\n![link](https://example.invalid)', -1, 0.5, null, Infinity]) {
      expect(validateTraceLensJson({ ...validTrace, totalTokens: { promptTokens: 1, completionTokens: 1, totalTokens } }).valid).toBe(false);
    }
    expect(validateTraceLensJson({ ...validTrace, steps: [{ ...validTrace.steps[0], status: 'failed', error: { message: { secret: 'value' } } }] }).valid).toBe(false);
    expect(validateTraceLensJson({ ...validTrace, tags: [42] }).valid).toBe(false);
    expect(validateTraceLensJson({ ...validTrace, description: {} }).valid).toBe(false);
  });
});
