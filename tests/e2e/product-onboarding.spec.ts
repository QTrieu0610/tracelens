import { test, expect } from '@playwright/test';

test('finds the failed command and its actual output in a completed CLI run', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sanitized Codex examples' }).click();
  await page.getByTestId(isMobile ? 'mobile-nav-tab-explorer' : 'nav-tab-explorer').click();
  await page.getByRole('button', { name: 'Inspect first failed step' }).click();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.locator('pre code')).toContainText('Synthetic example: one discount rounding test failed.');
  await expect(page.getByText('CLI completed', { exact: true })).toBeVisible();
});

test('tries synthetic Codex examples and previews a useful comparison without a model call', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try sanitized Codex examples' }).click();
  await expect(page.getByRole('button', { name: 'Preview Markdown report' })).toBeVisible();
  await expect(page.getByText('CLI completed', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Synthetic demo', { exact: true })).toHaveCount(2);
  await expect(page.locator('tbody tr').filter({ hasText: 'npm test' })).toContainText(/failed/i);
  await expect(page.getByText('Run A acceptance: Unverified (no evaluator evidence)', { exact: true })).toBeVisible();
  await expect(page.getByText('Timing evidence is missing; durations and duration deltas are unknown.')).toBeVisible();
  await page.getByRole('button', { name: 'Preview Markdown report' }).click();
  const editor = page.getByRole('textbox', { name: 'Editable Markdown' });
  await expect(editor).toHaveValue(/Token delta \(B - A\): -3150/);
  await expect(editor).toHaveValue(/Duration: Unknown/);
  await page.keyboard.press('Escape');
  if (!isMobile) await page.screenshot({ path: 'docs/screenshots/product-demo.png', fullPage: true });
});
