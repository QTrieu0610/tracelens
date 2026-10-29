import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAgent } from '../../scripts/agent-capture.mjs';
import { startLocalServer } from '../../scripts/local-server.mjs';

test('opens a captured agent log without file selection and keeps failed process evidence', async ({ page }) => {
  const run = { id: 'synthetic-local-capture', provider: 'codex', status: 'failed', exitCode: 7, startedAt: '2026-10-29T00:00:00Z', bytes: 100 };
  await page.route('**/api/runs', route => route.fulfill({ json: { service: 'tracelens-local-v1', runs: [run], unreadable: 0 } }));
  await page.route('**/api/runs/synthetic-local-capture/stdout', route => route.fulfill({ body: [
    { type: 'thread.started', thread_id: 'local-browser-test' }, { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'message', type: 'agent_message', text: 'Synthetic captured answer' } },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } },
  ].map(e => JSON.stringify(e)).join('\n'), contentType: 'text/plain' }));
  await page.goto('/');
  const captures = page.getByRole('region', { name: 'Local agent captures' });
  await expect(captures).toBeVisible();
  await expect(captures).toContainText('Process failed (exit 7)');
  await captures.getByRole('button', { name: 'Open trace' }).click();
  await expect(page.getByText('Capture process failed', { exact: true }).first()).toBeVisible();
});

test('shows an import error without losing the local capture list', async ({ page }) => {
  await page.route('**/api/runs', route => route.fulfill({ json: { service: 'tracelens-local-v1', runs: [{ id: 'invalid-capture', provider: 'codex', status: 'completed', exitCode: 0, startedAt: '2026-10-29T00:00:00Z', bytes: 5 }], unreadable: 1 } }));
  await page.route('**/api/runs/invalid-capture/stdout', route => route.fulfill({ body: '{bad', contentType: 'text/plain' }));
  await page.goto('/');
  const captures = page.getByRole('region', { name: 'Local agent captures' });
  await captures.getByRole('button', { name: 'Open trace' }).click();
  await expect(captures.getByRole('alert')).toContainText('Malformed');
  await expect(captures).toContainText('1 capture could not be read');
  await expect(captures.getByRole('button', { name: 'Open trace' })).toBeEnabled();
});

test('production app opens a real subprocess capture through the local server', async ({ page }) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'tracelens-browser-'));
  const events = [
    { type: 'thread.started', thread_id: 'synthetic-production-browser' }, { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'Synthetic production capture' } },
    { type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 20 } },
  ].map(e => JSON.stringify(e)).join('\n');
  await captureAgent({ provider: 'codex', dataDir, command: { executable: process.execPath, args: ['-e', `process.stdout.write(${JSON.stringify(events)})`] }, stdout: null, stderr: null });
  const local = await startLocalServer({ dataDir, distDir: fileURLToPath(new URL('../../dist/', import.meta.url)), port: 0 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(local.url);
    await page.getByRole('region', { name: 'Local agent captures' }).getByRole('button', { name: 'Open trace' }).click();
    await page.getByRole('button', { name: 'Output', exact: true }).click();
    await expect(page.getByText('"Synthetic production capture"', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await local.close(); }
});
