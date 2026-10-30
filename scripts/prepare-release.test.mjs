import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareRelease } from './prepare-release.mjs';

test('prepares a runnable source tree without private benchmark artifacts or local configuration', () => {
  const output = join(mkdtempSync(join(tmpdir(), 'tracelens-release-')), 'source');
  const manifest = prepareRelease(output);
  assert.ok(manifest.files.some(file => file.path === 'src/lib/importTrace.ts'));
  assert.ok(manifest.files.some(file => file.path === 'public/examples/codex-before.jsonl'));
  assert.ok(manifest.files.some(file => file.path === 'LICENSE'));
  assert.ok(manifest.files.some(file => file.path === 'scripts/tracelens.mjs'));
  assert.ok(manifest.files.some(file => file.path === 'docs/local-use.md'));
  assert.ok(manifest.files.some(file => file.path === 'docs/pydantic-evals.md'));
  assert.equal(manifest.files.some(file => file.path.includes('__pycache__') || file.path.endsWith('.pyc')), false);
  assert.ok(manifest.files.some(file => file.path === 'fixtures/demo-honesty-false-completion.json'));
  assert.equal(manifest.files.some(file => /real-subagent|\.tracelens\//.test(file.path)), false);
  assert.equal(manifest.files.some(file => /^(benchmarks|node_modules|dist|\.codex|\.agents|\.cli-smoke-runs)\//.test(file.path) || ['codex-smoke.jsonl', 'agy-smoke.jsonl'].includes(file.path)), false);
  assert.equal(manifest.files.some(file => file.path.endsWith('benchmark-artifacts.test.ts') || file.path.endsWith('benchmark-comparison.spec.ts')), false);
  const pkg = JSON.parse(readFileSync(join(output, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['benchmark:cli'], undefined);
  assert.equal(pkg.license, 'MIT');
  assert.ok(pkg.scripts.build);
  assert.equal(pkg.bin.tracelens, 'scripts/tracelens.mjs');
  assert.throws(() => prepareRelease(output), /exist/i);
});
