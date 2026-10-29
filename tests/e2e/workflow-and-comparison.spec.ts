import { test, expect, Page } from '@playwright/test';

async function navigateToTab(page: Page, tabId: string) {
  const desktop = page.getByTestId(`nav-tab-${tabId}`);
  if (await desktop.isVisible()) {
    await desktop.click();
  } else {
    await page.getByTestId(`mobile-nav-tab-${tabId}`).click();
  }
}

test.describe('TraceLens Workflow Graph and Run Comparison', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('studio-title')).toBeVisible();
  });

  test('visualizes agent transitions in workflow graph', async ({ page }) => {
    await navigateToTab(page, 'workflow');
    await expect(page.locator('text=Workflow State & Transition Graph')).toBeVisible();

    // Verify presence of step nodes in the graph
    await expect(page.locator('text=Analyze auth middleware architecture')).toBeVisible();
    await expect(page.locator('text=invoke_subagent: SecurityReviewer')).toBeVisible();

    // Clicking a node selects it in the inspector
    await page.locator('div:has-text("invoke_subagent: SecurityReviewer")').last().click();
    await expect(page.locator('text=ID: step-06')).toBeVisible();
  });

  test('compares two runs side-by-side with variance calculation', async ({ page }) => {
    await navigateToTab(page, 'comparison');
    await expect(page.locator('text=Baseline Execution (Run A)')).toBeVisible();
    await expect(page.locator('text=Comparison Execution (Run B)')).toBeVisible();

    // Verify KPI delta cards
    await expect(page.locator('text=Wall-Clock Delta')).toBeVisible();
    await expect(page.locator('text=Token Usage Delta')).toBeVisible();
    await expect(page.locator('text=Status Parity')).toBeVisible();

    // Check Aligned Step Matrix table
    await expect(page.locator('text=Aligned Step Comparison Matrix')).toBeVisible();
  });

  test('displays aggregated studio analytics and bottleneck ranking', async ({ page }) => {
    await navigateToTab(page, 'analytics');
    await expect(page.locator('text=Execution Performance Analytics')).toBeVisible();
    await expect(page.getByText(/Run status does not establish task acceptance or reliability/)).toBeVisible();

    // Check KPI counts
    await expect(page.locator('text=Total Runs')).toBeVisible();
    await expect(page.getByText('Successful Run Status', { exact: true })).toBeVisible();
    await expect(page.locator('text=Execution Bottlenecks')).toBeVisible();
    await expect(page.locator('text=Failure Causes & Error Codes')).toBeVisible();
  });
});
