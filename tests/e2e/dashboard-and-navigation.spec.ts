import { test, expect } from '@playwright/test';

test.describe('TraceLens Dashboard and Trace Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('studio-title')).toBeVisible();
  });

  test('displays imported demo runs on dashboard', async ({ page }) => {
    // Check that default demo runs appear in the table
    const table = page.locator('table');
    await expect(table.getByText('[DEMO] CodeRefactor & Test Suite Generation')).toBeVisible();
    await expect(table.getByText('[DEMO] Autonomous Travel Booking Workflow')).toBeVisible();
    await expect(table.getByText('[DEMO] Customer Support Multi-Agent Delegation')).toBeVisible();
  });

  test('filters runs by search term', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('Travel');
    const table = page.locator('table');
    await expect(table.getByText('[DEMO] Autonomous Travel Booking Workflow')).toBeVisible();
    await expect(table.getByText('[DEMO] CodeRefactor & Test Suite Generation')).not.toBeVisible();

    await searchInput.clear();
    await expect(table.getByText('[DEMO] CodeRefactor & Test Suite Generation')).toBeVisible();
  });

  test('filters runs by status tabs', async ({ page }) => {
    // Click failed filter
    await page.getByTestId('filter-failed').click();
    const table = page.locator('table');
    await expect(table.getByText('[DEMO] Autonomous Travel Booking Workflow')).toBeVisible();
    await expect(table.getByText('[DEMO] CodeRefactor & Test Suite Generation')).not.toBeVisible();

    // Click success filter
    await page.getByTestId('filter-success').click();
    await expect(table.getByText('[DEMO] CodeRefactor & Test Suite Generation')).toBeVisible();
    await expect(table.getByText('[DEMO] Autonomous Travel Booking Workflow')).not.toBeVisible();
  });

  test('inspects a run and navigates trace steps', async ({ page }) => {
    // Click on the row for run 1
    await page.getByTestId('run-row-run-demo-code-001').click();

    // Should now be on the explorer tab
    await expect(page.locator('text=Execution Sequence')).toBeVisible();
    await expect(page.locator('text=Analyze auth middleware architecture')).toBeVisible();

    // Click on step 2 (thought)
    await page.getByTestId('step-item-step-02').click();
    // Verify Thought tab exists and thought text appears in inspector
    await page.locator('button:has-text("Thought")').click();
    await expect(page.locator('text=I need to inspect src/middleware/auth.ts first')).toBeVisible();

    // Click on step 5 (subagent invocation)
    await page.getByTestId('step-item-step-06').click();
    await expect(page.getByRole('heading', { name: 'invoke_subagent: SecurityReviewer', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Input', exact: true }).click();
    await expect(page.locator('pre code')).toContainText('AppSec Auditor');

    // Test ArrowDown navigation
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('heading', { name: 'Synthesize summary response', exact: true })).toBeVisible();
  });
});
