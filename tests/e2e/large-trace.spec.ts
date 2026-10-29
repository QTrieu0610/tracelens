import { test, expect } from '@playwright/test';

test('inspects a 1000-command trace and finds a late failure', async ({ page }, testInfo) => {
  const events: unknown[] = [{ type: 'thread.started', thread_id: 'synthetic-large' }, { type: 'turn.started' }];
  for (let i = 0; i < 1000; i++) events.push({ type: 'item.completed', item: {
    id: `cmd-${i}`, type: 'command_execution', command: `synthetic-command-${i}`, exit_code: i === 950 ? 1 : 0,
    aggregated_output: i === 950 ? 'Synthetic late failure evidence' : 'Synthetic output',
  } });
  events.push({ type: 'turn.completed', usage: { input_tokens: 10000, output_tokens: 1000 } });
  await page.goto('/');
  await page.getByTestId('open-import-modal-btn').click();
  const started = Date.now();
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic-large.jsonl', mimeType: 'application/jsonl', buffer: Buffer.from(events.map(e => JSON.stringify(e)).join('\n')) });
  await expect(page.getByText('Execution Sequence (1000 steps)', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Inspect first failed step' }).click();
  await expect(page.getByRole('heading', { name: 'synthetic-command-950', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.locator('pre code')).toContainText('Synthetic late failure evidence');
  await testInfo.attach('local-performance.json', { body: JSON.stringify({ commands: 1000, importAndInspectMs: Date.now() - started, environment: 'Local browser; mobile project emulates viewport, not mobile hardware' }), contentType: 'application/json' });
});
