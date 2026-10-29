import { test, expect } from '@playwright/test';

test('imports public AGY output and distinguishes source elapsed time from missing timestamps', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import your logs', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles('public/examples/agy-synthetic.jsonl');
  await expect(page.getByText('CLI completed', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Run evidence')).toContainText('Antigravity CLI');
  await expect(page.getByLabel('Run evidence')).toContainText('Source-reported elapsed: 2.50s');
  await expect(page.getByLabel('Run evidence')).toContainText('Unverified');
  await expect(page.getByLabel('Run evidence')).toContainText('cache reads reported by AGY');
  await expect(page.getByLabel('Run evidence')).not.toContainText('included in input tokens');
  await page.getByTestId('step-item-step-1').click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.locator('pre code')).toContainText('Synthetic AGY response.');
});
