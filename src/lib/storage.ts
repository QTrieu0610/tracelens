import { TraceLensV1Trace } from '../types/trace';
import demoCoding from '../../fixtures/demo-coding-agent.json';
import demoTravel from '../../fixtures/demo-trip-planner-failure.json';
import demoSupport from '../../fixtures/demo-support-subagents.json';
import demoHonestyFCC from '../../fixtures/demo-honesty-false-completion.json';
import { validateTraceLensJson } from './validator';

const STORAGE_KEY = 'tracelens_runs_v1';

export const INITIAL_DEMO_RUNS: TraceLensV1Trace[] = [
  demoCoding as unknown as TraceLensV1Trace,
  demoHonestyFCC as unknown as TraceLensV1Trace,
  demoTravel as unknown as TraceLensV1Trace,
  demoSupport as unknown as TraceLensV1Trace
];

export function loadStoredRuns(): TraceLensV1Trace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // First-time visit: seed with demo runs
      return INITIAL_DEMO_RUNS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every(run => validateTraceLensJson(run).valid)) {
      return parsed;
    }
    throw new Error('Invalid stored traces');
  } catch {
    throw new Error('Browser storage could not be loaded. Download a backup before resetting; stored data has not been changed.');
  }
}

export function persistRuns(runs: TraceLensV1Trace[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
    return true;
  } catch (err) {
    console.error('Failed to persist runs to localStorage', err);
    return false;
  }
}

export function saveRun(run: TraceLensV1Trace): TraceLensV1Trace[] {
  return saveRuns([run]);
}

export function saveRuns(incoming: TraceLensV1Trace[]): TraceLensV1Trace[] {
  const current = loadStoredRuns();
  const updated = [...current];
  for (const run of [...incoming].reverse()) {
    const index = updated.findIndex(r => r.runId === run.runId);
    if (index >= 0) updated[index] = run;
    else updated.unshift(run);
  }
  if (!persistRuns(updated)) throw new Error('Could not save the imported trace to browser storage. Free some space or export existing runs first.');
  return updated;
}

export function deleteRun(runId: string): TraceLensV1Trace[] {
  const current = loadStoredRuns();
  const updated = current.filter(r => r.runId !== runId);
  if (!persistRuns(updated)) throw new Error('Could not delete the run from browser storage. Your library has not changed.');
  return updated;
}

export function resetToDemoRuns(): TraceLensV1Trace[] {
  if (!persistRuns(INITIAL_DEMO_RUNS)) throw new Error('Could not reset browser storage. Your library has not changed.');
  return INITIAL_DEMO_RUNS;
}

export function downloadJsonFile(filename: string, content: unknown): void {
  downloadTextFile(filename, JSON.stringify(content, null, 2), 'application/json');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/markdown;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
