import { expect, test } from '@playwright/test';

test('searches payloads, bounds rows, and navigates filtered pages and failures', async ({ page }) => {
  const trace = {
    schemaVersion: 'tracelens-v1', runId: 'synthetic-search', name: 'Synthetic searchable trace',
    agentName: 'Synthetic', model: 'fixture', status: 'failed', startedAt: '2026-10-23T00:00:00Z', totalDurationMs: 1000,
    steps: Array.from({ length: 1000 }, (_, i) => ({
      stepId: `search-${i}`, stepIndex: i, name: `Command ${i}`, type: i === 999 ? 'system_event' : 'tool_call',
      status: i === 950 || i === 980 ? 'failed' : 'success', startedAt: '2026-10-23T00:00:00Z', durationMs: 1,
      input: { path: `input-${i}` }, output: { text: i >= 850 ? 'needle in output' : 'ordinary output' },
      ...(i === 950 || i === 980 ? { error: { message: 'recorded-error-only' } } : {}),
    })),
  };
  await page.goto('/');
  await page.getByTestId('open-import-modal-btn').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-search.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(trace)) });
  const rows = page.locator('[data-testid^="step-item-"]');
  const search = page.getByRole('searchbox', { name: 'Search steps' });
  const heading = (name: string) => page.getByRole('heading', { name, exact: true });
  await expect(rows).toHaveCount(100);
  await expect(heading('Command 0')).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(heading('Command 100')).toBeVisible();
  await page.getByTestId('step-item-search-100').press('ArrowUp');
  await expect(page.getByTestId('step-item-search-99')).toBeFocused();
  await expect(heading('Command 99')).toBeVisible();

  await search.fill('NEEDLE');
  await expect(rows).toHaveCount(100);
  await expect(heading('Command 850')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '150 of 1000 steps match' })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(rows).toHaveCount(50);
  await expect(heading('Command 950')).toBeVisible();
  await page.getByRole('button', { name: 'Next failed step', exact: true }).click();
  await expect(heading('Command 980')).toBeVisible();
  await page.getByRole('button', { name: 'Previous failed step', exact: true }).click();
  await expect(heading('Command 950')).toBeVisible();

  await search.fill('recorded-error-only');
  await expect(rows).toHaveCount(2);
  await page.getByLabel('Status', { exact: true }).selectOption('success');
  await expect(rows).toHaveCount(0);
  await expect(heading('Command 950')).toHaveCount(0);
  await expect(page.getByText('No steps match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect first failed step', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(rows).toHaveCount(100);
  await expect(page.getByTestId('step-item-search-950')).toHaveAttribute('aria-pressed', 'true');
  await expect(heading('Command 950')).toBeVisible();

  await search.fill('input-999');
  await page.getByLabel('Type', { exact: true }).selectOption('tool_call');
  await expect(rows).toHaveCount(0);
  await page.getByLabel('Type', { exact: true }).selectOption('system_event');
  await expect(rows).toHaveCount(1);
  await expect(heading('Command 999')).toBeVisible();
  await search.press('ArrowUp');
  await expect(search).toBeFocused();

  await page.getByTestId('open-import-modal-btn').click();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-second.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...trace, runId: 'synthetic-second', name: 'Second synthetic trace' })) });
  await expect(search).toHaveValue('');
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('all');
  await expect(rows).toHaveCount(100);
  await expect(heading('Command 0')).toBeVisible();
});
