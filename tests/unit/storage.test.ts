import { afterEach, expect, it, vi } from 'vitest';
import { saveRun, saveRuns, loadStoredRuns, deleteRun, resetToDemoRuns } from '../../src/lib/storage';
import demo from '../../fixtures/demo-coding-agent.json';
import { TraceLensV1Trace } from '../../src/types/trace';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('keeps an intentionally empty library empty after reload', () => {
  localStorage.setItem('tracelens_runs_v1', '[]');
  expect(loadStoredRuns()).toEqual([]);
});

it('rejects corrupt stored traces without overwriting the original data', () => {
  const raw = JSON.stringify([{ runId: 'broken' }]);
  localStorage.setItem('tracelens_runs_v1', raw);
  expect(() => loadStoredRuns()).toThrow(/storage|stored/i);
  expect(() => saveRun(demo as TraceLensV1Trace)).toThrow();
  expect(localStorage.getItem('tracelens_runs_v1')).toBe(raw);
});

it('does not report deletion or reset as saved when storage is unavailable', () => {
  localStorage.setItem('tracelens_runs_v1', JSON.stringify([demo]));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => deleteRun(demo.runId)).toThrow(/storage/i);
  expect(() => resetToDemoRuns()).toThrow(/storage/i);
});

it('reports failed persistence instead of silently losing an imported trace', () => {
  localStorage.setItem('tracelens_runs_v1', JSON.stringify([demo]));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => saveRun({ ...demo, runId: 'new-import' } as TraceLensV1Trace)).toThrow(/save|storage/i);
  expect(JSON.parse(localStorage.getItem('tracelens_runs_v1')!)).toHaveLength(1);
});

it('saves a comparison pair together or leaves the existing library intact', () => {
  localStorage.setItem('tracelens_runs_v1', JSON.stringify([demo]));
  const baseline = { ...demo, runId: 'baseline' } as TraceLensV1Trace;
  const candidate = { ...demo, runId: 'candidate' } as TraceLensV1Trace;
  expect(saveRuns([baseline, candidate]).map(r => r.runId)).toEqual(['baseline', 'candidate', demo.runId]);
  const original = localStorage.getItem('tracelens_runs_v1');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => saveRuns([{ ...baseline, runId: 'new-baseline' }, { ...candidate, runId: 'new-candidate' }])).toThrow(/storage/i);
  expect(localStorage.getItem('tracelens_runs_v1')).toBe(original);
});
