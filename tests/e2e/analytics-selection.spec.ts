import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const demo = JSON.parse(readFileSync(new URL('../../fixtures/demo-coding-agent.json', import.meta.url), 'utf8'));

async function openAnalytics(page: Page) {
  await page.goto('/');
  const desktop = page.getByTestId('nav-tab-analytics');
  await (await desktop.isVisible() ? desktop : page.getByTestId('mobile-nav-tab-analytics')).click();
}

test('excludes examples by default and makes inclusion and reset explicit', async ({ page }) => {
  await openAnalytics(page);
  const selection = page.getByRole('region', { name: 'Analytics run selection' });
  await expect(selection.getByRole('status')).toHaveText('0 selected / 4 available runs');
  await expect(page.getByText('No runs selected.', { exact: false })).toBeVisible();
  await expect(page.getByText('Run status does not establish task acceptance or reliability.', { exact: false })).toBeVisible();
  await page.getByLabel('Include synthetic examples').check();
  await expect(selection.getByRole('status')).toHaveText('4 selected / 4 available runs');
  await page.getByRole('button', { name: 'Reset selection', exact: true }).click();
  await expect(page.getByLabel('Include synthetic examples')).not.toBeChecked();
  await expect(selection.getByRole('status')).toHaveText('0 selected / 4 available runs');
  await page.getByRole('button', { name: 'Import a trace', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('intersects source, model and tag filters and preserves missing usage', async ({ page }) => {
  const runs = [
    { ...demo, runId: 'real-one', name: 'Real one', model: 'model-a', tags: ['coding'], metadata: { source: 'codex-exec-jsonl' }, totalTokens: undefined },
    { ...demo, runId: 'real-two', name: 'Real two', model: 'model-b', tags: ['coding'], metadata: { source: 'claude-code-stream-json' } },
    { ...demo, runId: 'real-three', name: 'Real three', model: 'model-a', tags: ['review'], metadata: {} },
    demo,
  ];
  await page.addInitScript(data => localStorage.setItem('tracelens_runs_v1', JSON.stringify(data)), runs);
  await openAnalytics(page);
  const count = page.getByRole('region', { name: 'Analytics run selection' }).getByRole('status');
  await expect(count).toHaveText('3 selected / 4 available runs');
  await page.getByLabel('Analytics model', { exact: true }).selectOption(JSON.stringify('model-a'));
  await expect(count).toHaveText('2 selected / 4 available runs');
  await page.getByLabel('Analytics tag', { exact: true }).selectOption(JSON.stringify('coding'));
  await expect(count).toHaveText('1 selected / 4 available runs');
  await page.getByLabel('Analytics source', { exact: true }).selectOption(JSON.stringify('claude-code-stream-json'));
  await expect(count).toHaveText('0 selected / 4 available runs');
  await page.getByLabel('Analytics source', { exact: true }).selectOption(JSON.stringify('codex-exec-jsonl'));
  await expect(count).toHaveText('1 selected / 4 available runs');
  await expect(page.getByText('Total Tokens', { exact: true }).locator('..').locator('..')).toContainText('Unknown');
  await page.getByRole('button', { name: 'Reset selection', exact: true }).click();
  await page.getByLabel('Analytics source', { exact: true }).selectOption({ label: 'TraceLens JSON (source unreported)' });
  await expect(count).toHaveText('1 selected / 4 available runs');
});

test('empty libraries provide an import path without fabricated measurements', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tracelens_runs_v1', '[]'));
  await openAnalytics(page);
  await expect(page.getByRole('region', { name: 'Analytics run selection' }).getByRole('status')).toHaveText('0 selected / 0 available runs');
  await expect(page.getByText('Total Tokens', { exact: true }).locator('..').locator('..')).toContainText('Unknown');
  await expect(page.getByRole('button', { name: 'Import a trace', exact: true })).toBeVisible();
});
