import { test, expect } from '@playwright/test';

test('preserves corrupt storage and offers a backup instead of crashing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tracelens_runs_v1', '[{"runId":"broken"}]'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Browser storage could not be loaded');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download stored data backup' }).click();
  expect((await download).suggestedFilename()).toBe('tracelens-storage-backup.json');
  expect(await page.evaluate(() => localStorage.getItem('tracelens_runs_v1'))).toBe('[{"runId":"broken"}]');
});

test('failed deletion keeps the visible run and reports the storage error', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByTestId('delete-run-run-demo-code-001').click();
  await expect(page.getByRole('alert')).toContainText('Could not delete');
  await expect(page.getByTestId('run-row-run-demo-code-001')).toBeVisible();
});

test('cancelled reset preserves imported data', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sanitized Codex examples' }).click();
  const storedBefore = await page.evaluate(() => localStorage.getItem('tracelens_runs_v1'));
  await page.getByRole('button', { name: 'Reset to default synthetic demo datasets' }).click();
  await page.getByRole('dialog', { name: 'Replace stored runs with demos?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('tracelens_runs_v1'))).toBe(storedBefore);
});

test('an empty library remains empty on reload', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tracelens_runs_v1', '[]'));
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('No matching executions found')).toBeVisible();
});
