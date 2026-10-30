import { test, expect } from '@playwright/test';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from '../../scripts/local-server.mjs';

test('shows evaluation regressions and opens the selected failed check in one click', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try Pydantic Evals comparison' }).click();
  const summary = page.getByRole('region', { name: 'Evaluation results' });
  await expect(summary).toContainText('Baseline: 60/60 checks passed');
  await expect(summary).toContainText('Candidate: 40/60 checks passed');
  await expect(summary).toContainText('20 newly failed checks');
  await page.getByRole('row').filter({ hasText: 'order-1/TrajectoryMatch' }).getByRole('button', { name: 'View candidate evidence' }).click();
  await expect(page.getByRole('heading', { name: 'order-1 / TrajectoryMatch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.locator('pre').filter({ hasText: 'evidenceStepIds' })).toContainText('"minimumScore": 1');
  await page.getByRole('button', { name: 'Back to comparison', exact: true }).click();
  await expect(summary).toContainText('Baseline: 60/60 checks passed');
  await expect(summary).toContainText('Candidate: 40/60 checks passed');
});

test('opens discovered local evaluation results without file selection', async ({ page }) => {
  await page.route('**/api/evals', route => route.fulfill({ json: { service: 'tracelens-local-v1', evaluations: [{ id: 'local-eval', name: 'Fresh evaluation', createdAt: '2026-10-30T00:00:00Z', synthetic: true }], unreadable: 0 } }));
  for (const [kind, file] of [['baseline', 'baseline'], ['regressed', 'regressed']]) {
    await page.route(`**/api/evals/local-eval/${kind}`, route => route.fulfill({ body: readFileSync(`public/examples/pydantic-evals-${file}.json`, 'utf8'), contentType: 'application/json' }));
  }
  await page.goto('/');
  const evaluations = page.getByRole('region', { name: 'Local evaluations' });
  await expect(evaluations).toContainText('Fresh evaluation');
  await evaluations.getByRole('button', { name: 'Open comparison' }).click();
  await expect(page.getByRole('region', { name: 'Evaluation results' })).toContainText('20 newly failed checks');
});

test('rejects a corrupt pair without importing half of the comparison', async ({ page }) => {
  await page.route('**/api/evals', route => route.fulfill({ json: { service: 'tracelens-local-v1', evaluations: [{ id: 'broken-eval', name: 'Broken evaluation', createdAt: '2026-10-30T00:00:00Z', synthetic: true }], unreadable: 0 } }));
  await page.route('**/api/evals/broken-eval/baseline', route => route.fulfill({ body: readFileSync('public/examples/pydantic-evals-baseline.json', 'utf8'), contentType: 'application/json' }));
  await page.route('**/api/evals/broken-eval/regressed', route => route.fulfill({ body: '{bad', contentType: 'application/json' }));
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('tracelens_runs_v1'));
  const evaluations = page.getByRole('region', { name: 'Local evaluations' });
  await evaluations.getByRole('button', { name: 'Open comparison' }).click();
  await expect(evaluations.getByRole('alert')).toContainText('Invalid evaluation trace');
  expect(await page.evaluate(() => localStorage.getItem('tracelens_runs_v1'))).toBe(before);
  await expect(evaluations.getByRole('button', { name: 'Open comparison' })).toBeEnabled();
});

test('production viewer discovers results through the real read-only server', async ({ page }) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tracelens-eval-browser-'));
  const directory = join(dataDir, 'evals', 'production-demo');
  mkdirSync(directory, { recursive: true });
  for (const kind of ['baseline', 'regressed']) copyFileSync(`public/examples/pydantic-evals-${kind}.json`, join(directory, kind + '.json'));
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ id: 'production-demo', name: 'Production evaluation', createdAt: '2026-10-30T00:00:00Z', synthetic: true }));
  const local = await startLocalServer({ dataDir, distDir: fileURLToPath(new URL('../../dist/', import.meta.url)), port: 0 });
  try {
    await page.goto(local.url);
    await page.getByRole('region', { name: 'Local evaluations' }).getByRole('button', { name: 'Open comparison' }).click();
    await expect(page.getByRole('region', { name: 'Evaluation results' })).toContainText('20 newly failed checks');
  } finally { await local.close(); }
});
