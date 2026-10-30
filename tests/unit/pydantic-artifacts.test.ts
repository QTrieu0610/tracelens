import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTraceImport } from '../../src/lib/importTrace';
import { computeRunComparison } from '../../src/lib/analytics';
import { getAcceptance, isSyntheticDemo } from '../../src/lib/runEvidence';
import { auditRunHonesty } from '../../src/lib/honestyAuditor';

const read = (name: string) => parseTraceImport(readFileSync(`public/examples/pydantic-evals-${name}.json`, 'utf8'));

describe('recorded Pydantic Evals integration', () => {
  it.each(['baseline', 'regressed'])('does not infer agent reporting honesty from %s evaluations', name => {
      const audit = auditRunHonesty(read(name).trace!);
      expect(audit.verdict).toBe('UNVERIFIED');
      expect(audit.hasFalseCompletionClaim).toBe(false);
      expect(audit.discrepancies).toEqual([]);
  });
  it('imports real exported reports and distinguishes execution from acceptance', () => {
    const a = read('baseline'), b = read('regressed');
    expect(a.errors).toEqual([]);
    expect(b.errors).toEqual([]);
    const baseline = a.trace!, regressed = b.trace!;
    expect(baseline.status).toBe('success');
    expect(regressed.status).toBe('success');
    expect(getAcceptance(baseline)).toContain('60/60');
    expect(getAcceptance(regressed)).toContain('40/60');
    expect(isSyntheticDemo(regressed)).toBe(true);
    expect(regressed.totalTokens).toBeUndefined();
    expect(baseline.steps.filter(s => s.type === 'tool_call')).toHaveLength(80);
    expect(regressed.steps.filter(s => s.type === 'tool_call')).toHaveLength(100);
    const comparison = computeRunComparison(baseline, regressed);
    expect(comparison.alignment).toBe('milestone');
    expect(comparison.stepDiffs).toHaveLength(60);
    expect(comparison.stepDiffs.filter(s => s.statusA === 'success' && s.statusB === 'failed')).toHaveLength(20);
    const failed = regressed.steps.filter(s => s.metadata?.evaluator && s.status === 'failed');
    expect(failed).toHaveLength(20);
    for (const step of failed) {
      expect(step.error?.message).toBeTruthy();
      const evidence = step.output as { evidenceStepIds: string[] };
      expect(evidence.evidenceStepIds.length).toBeGreaterThan(0);
      expect(evidence.evidenceStepIds.every(id => regressed.steps.some(s => s.stepId === id && s.type === 'tool_call'))).toBe(true);
    }
    const tools = regressed.steps.filter(s => s.type === 'tool_call' && s.metadata?.caseId === 'order-1');
    expect(tools.map(s => s.name)).toEqual(['extract_data', 'analyze_form', 'fill_form', 'validate_mapping']);
  });
});
