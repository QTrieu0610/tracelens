import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runEvalDemo } from './eval-demo.mjs';

const folder = () => mkdtempSync(join(tmpdir(), 'tracelens-eval-'));
const trace = name => ({ schemaVersion: 'tracelens-v1', runId: name, name, agentName: 'synthetic', model: 'test', status: 'success', startedAt: '2026-10-30T00:00:00Z', totalDurationMs: 1, metadata: { evaluation: { datasetId: 'forms', datasetRevision: 'v1' } }, steps: [] });

// Stub only the external Python boundary; publication/discovery uses real files.
function pythonBoundary({ fail = '', installed = true } = {}) {
  const calls = [];
  return { calls, run: async (command, args) => {
    calls.push({ command, args });
    if (args.some(a => a.includes('sys.version_info'))) return { code: fail === 'python' ? 1 : 0, stdout: '' };
    if (args.includes('venv')) {
      const env = args.at(-1);
      mkdirSync(join(env, process.platform === 'win32' ? 'Scripts' : 'bin'), { recursive: true });
      writeFileSync(join(env, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), 'stub');
    }
    if (args.some(a => a.includes('import importlib.metadata'))) return { code: installed ? 0 : 1, stdout: '' };
    if (args.includes('pip') && fail === 'pip') return { code: 1, stdout: '' };
    const out = args.indexOf('--output');
    if (out !== -1) {
      if (fail === 'demo') return { code: 1, stdout: '' };
      mkdirSync(args[out + 1], { recursive: true });
      for (const name of ['baseline', 'regressed']) writeFileSync(join(args[out + 1], name + '.json'), JSON.stringify(trace(name)));
    }
    return { code: 0, stdout: '' };
  } };
}

test('prepares isolated Python and publishes a comparison only after both traces are readable', async () => {
  const dataDir = folder(), python = pythonBoundary({ installed: false });
  const result = await runEvalDemo({ dataDir, run: python.run, pythonCandidates: [{ executable: 'python', args: [] }], log: () => {} });
  const manifest = JSON.parse(readFileSync(join(result.directory, 'manifest.json')));
  assert.equal(manifest.id, result.id);
  assert.ok(python.calls.some(c => c.args.includes('venv')));
  assert.ok(python.calls.some(c => c.args.includes('pip')));
  assert.ok(existsSync(join(result.directory, 'baseline.json')));
  const reused = pythonBoundary();
  await runEvalDemo({ dataDir, run: reused.run, pythonCandidates: [], log: () => {} });
  assert.equal(reused.calls.some(c => c.args.includes('venv') || c.args.includes('pip')), false);
});

test('explains missing Python and dependency setup failure', async () => {
  await assert.rejects(runEvalDemo({ dataDir: folder(), run: pythonBoundary({ fail: 'python' }).run, pythonCandidates: [{ executable: 'missing', args: [] }], log: () => {} }), /Python 3\.11/);
  await assert.rejects(runEvalDemo({ dataDir: folder(), run: pythonBoundary({ fail: 'pip', installed: false }).run, pythonCandidates: [{ executable: 'python', args: [] }], log: () => {} }), /dependencies.*retry/i);
});

test('failed experiments are not published as completed comparisons', async () => {
  const dataDir = folder();
  await assert.rejects(runEvalDemo({ dataDir, run: pythonBoundary({ fail: 'demo' }).run, pythonCandidates: [{ executable: 'python', args: [] }], log: () => {} }), /evaluation.*failed/i);
  const { readdirSync } = await import('node:fs');
  for (const id of readdirSync(join(dataDir, 'evals'))) assert.equal(existsSync(join(dataDir, 'evals', id, 'manifest.json')), false);
});
