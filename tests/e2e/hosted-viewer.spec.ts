import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from '../../scripts/local-server.mjs';

test('hosted viewer does not poll local APIs or offer automatic local discovery', async ({ page, request }) => {
  const local = await startLocalServer({ dataDir: mkdtempSync(join(tmpdir(), 'tracelens-hosted-')), distDir: fileURLToPath(new URL('../../dist/', import.meta.url)), port: 0 });
  const apiRequests: string[] = [];
  await page.route('https://hosted.tracelens.test/**', async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/tracelens\//, '');
    if (path.startsWith('api/')) {
      apiRequests.push(path);
      await route.fulfill({ status: 404, body: 'No local API on static hosting' });
      return;
    }
    const response = await request.get(new URL(path, local.url).href);
    await route.fulfill({ response });
  });
  try {
    await page.goto('https://hosted.tracelens.test/tracelens/');
    await expect(page.getByTestId('studio-title')).toBeVisible();
    await page.waitForTimeout(5500); // Cover the former five-second polling cycle.
    expect(apiRequests).toEqual([]);
    await expect(page.getByRole('region', { name: 'Evaluation files' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh evaluations' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Try Pydantic Evals comparison' }).click();
    await expect(page.getByRole('region', { name: 'Evaluation results' })).toContainText('20 newly failed checks');
  } finally { await local.close(); }
});
