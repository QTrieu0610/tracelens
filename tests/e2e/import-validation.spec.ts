import { test, expect } from '@playwright/test';

test.describe('TraceLens Data Import & Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('studio-title')).toBeVisible();
  });

  test('validates and rejects corrupted trace json', async ({ page }) => {
    // Open import modal
    await page.getByTestId('open-import-modal-btn').click();
    await expect(page.locator('text=Import TraceLens JSON')).toBeVisible();

    const textarea = page.getByTestId('import-json-textarea');
    // Paste invalid json
    await textarea.fill('{\n  "schemaVersion": "invalid-v0",\n  "runId": ""\n}');
    await page.getByTestId('validate-import-btn').click();

    // Verify diagnostic error alert
    await expect(page.locator('text=Validation Failed')).toBeVisible();
    await expect(page.getByText('schemaVersion:')).toBeVisible();
  });

  test('successfully validates and imports a valid trace', async ({ page }) => {
    await page.getByTestId('open-import-modal-btn').click();
    await expect(page.locator('text=Import TraceLens JSON')).toBeVisible();

    const validJson = JSON.stringify({
      schemaVersion: 'tracelens-v1',
      runId: 'custom-import-run-777',
      name: 'Custom User Uploaded Trace',
      agentName: 'CustomBot',
      model: 'claude-3-opus',
      status: 'success',
      startedAt: '2026-10-20T12:00:00.000Z',
      totalDurationMs: 1500,
      steps: [
        {
          stepId: 'c-01',
          stepIndex: 0,
          type: 'user_input',
          name: 'Custom input step',
          status: 'success',
          startedAt: '2026-10-20T12:00:00.000Z',
          durationMs: 50
        },
        {
          stepId: 'c-02',
          stepIndex: 1,
          type: 'tool_call',
          name: 'custom_search',
          status: 'success',
          startedAt: '2026-10-20T12:00:00.100Z',
          durationMs: 1400
        }
      ]
    });

    const textarea = page.getByTestId('import-json-textarea');
    await textarea.fill(validJson);
    await page.getByTestId('validate-import-btn').click();

    // Modal should close and navigate to the new trace
    await expect(page.locator('text=Import TraceLens JSON')).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custom User Uploaded Trace' })).toBeVisible();
    await expect(page.locator('text=Custom input step').first()).toBeVisible();
  });
});
