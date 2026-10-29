import { test, expect } from '@playwright/test';
import type { TraceLensV1Trace } from '../../src/types/trace';

test('report excludes source secrets, supports redaction and downloads exactly the edited text', async ({ page }) => {
  const run: TraceLensV1Trace = {
    schemaVersion: 'tracelens-v1', runId: 'private-id', name: '<img src=x onerror=alert(1)> private-name',
    agentName: 'private-agent', model: 'test', status: 'success', startedAt: '2026-10-23T00:00:00Z', totalDurationMs: 0,
    metadata: { import: { timingKnown: false }, prompt: 'private-prompt' },
    steps: [{ stepId: 'private-step', stepIndex: 0, type: 'tool_call', name: 'private-command', status: 'failed', startedAt: '2026-10-23T00:00:00Z', durationMs: 0,
      input: '/private/path', error: { message: 'private-error' } }],
  };
  await page.addInitScript(runs => localStorage.setItem('tracelens_runs_v1', JSON.stringify(runs)), [run, { ...run, runId: 'private-id-2' }]);
  await page.goto('/');
  const tab = page.getByTestId('nav-tab-comparison');
  await (await tab.isVisible() ? tab : page.getByTestId('mobile-nav-tab-comparison')).click();
  await expect(page.getByText('Timing evidence is missing; durations and duration deltas are unknown.')).toBeVisible();
  await page.getByRole('button', { name: 'Preview Markdown report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Comparison Markdown preview' });
  const editor = dialog.getByRole('textbox', { name: 'Editable Markdown' });
  const value = await editor.inputValue();
  expect(value).not.toContain('private-');
  expect(value).not.toContain('/private/');
  expect(value).toContain('Duration: Unknown');
  await dialog.getByRole('checkbox').check();
  await expect(editor).toHaveValue(/&lt;img/);
  await expect(dialog.locator('img')).toHaveCount(0);
  await editor.fill('# Manually redacted\nOnly approved text.');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } }));
  await dialog.getByRole('button', { name: 'Copy Markdown' }).click();
  await expect(dialog.getByRole('status')).toContainText('Clipboard unavailable');
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download Markdown' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('tracelens-comparison.md');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString('utf8')).toBe('# Manually redacted\nOnly approved text.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
