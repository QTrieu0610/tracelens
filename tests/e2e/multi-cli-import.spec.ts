import { test, expect } from '@playwright/test';

for (const [file, agent] of [['claude-synthetic.jsonl', 'Claude Code'], ['gemini-synthetic.jsonl', 'Gemini CLI']]) {
  test(`imports ${agent} public output and inspects the recorded tool failure`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-import-modal-btn').click();
    await page.locator('input[type=file]').setInputFiles(`public/examples/${file}`);
    await expect(page.getByText('CLI completed', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Run evidence')).toContainText(`${agent} CLI log`);
    await expect(page.getByLabel('Run evidence')).toContainText('Unverified (no evaluator evidence)');
    await page.getByRole('button', { name: 'Inspect first failed step' }).click();
    await page.getByRole('button', { name: 'Output', exact: true }).click();
    await expect(page.locator('pre code')).toContainText('expected 2, received 1');
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Clipboard unavailable' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Select execution run' })).toContainText(file.replace('.jsonl', ''));
  });
}
