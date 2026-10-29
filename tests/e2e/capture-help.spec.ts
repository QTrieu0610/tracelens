import { test, expect } from '@playwright/test';

test('guides a new user from import to the right capture command', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Import your logs', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import TraceLens JSON or CLI logs' });
  await dialog.getByText('Need a log? Show capture commands', { exact: true }).click();
  await dialog.getByRole('combobox', { name: 'CLI format' }).selectOption('gemini');
  await expect(dialog.locator('pre')).toContainText('gemini -p');
  await expect(dialog.locator('pre')).toContainText('--output-format stream-json');
  await expect(dialog.locator('pre')).toContainText('-NoClobber');
  await dialog.getByRole('combobox', { name: 'Terminal shell' }).selectOption('bash');
  await expect(dialog.locator('pre')).toContainText('set -C');
  await expect(dialog.getByText(/already authenticated/)).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await dialog.getByRole('button', { name: 'Copy capture command' }).click();
  await expect(dialog.getByRole('status')).toContainText('Select the command');
});
