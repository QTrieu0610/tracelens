import { test, expect } from '@playwright/test';

const raw = [
  { type: 'thread.started', thread_id: 'encoding-demo' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'message', type: 'agent_message', text: 'Imported ✓' } },
  { type: 'turn.completed', usage: { input_tokens: 17000, output_tokens: 281, cached_input_tokens: 12000 } },
].map(e => JSON.stringify(e)).join('\n');

for (const encoding of ['utf8', 'utf16le'] as const) {
  test(`imports Codex JSONL with ${encoding} BOM`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('open-import-modal-btn').click();
    const bom = encoding === 'utf8' ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.from([0xff, 0xfe]);
    await page.locator('input[type=file]').setInputFiles({ name: `codex-${encoding}.jsonl`, mimeType: 'application/jsonl', buffer: Buffer.concat([bom, Buffer.from(raw, encoding)]) });
    await expect(page.getByTestId('import-json-textarea')).not.toBeVisible();
    await expect(page.getByText(`codex-${encoding}`, { exact: true }).first()).toBeVisible();
  });
}

test('reports malformed pasted Codex events with a line number', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-import-modal-btn').click();
  await page.getByTestId('import-json-textarea').fill(raw + '\n{');
  await page.getByTestId('validate-import-btn').click();
  await expect(page.getByText('line 5:', { exact: true })).toBeVisible();
});
