import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('TraceLens Evidence Collection', () => {
  const screenshotsDir = path.resolve('docs/screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('captures full-studio screenshots across all core features', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop screenshots only');

    // 1. Dashboard View
    await page.goto('http://localhost:5188/');
    await page.waitForSelector('[data-testid="studio-title"]');
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png'), fullPage: true });

    // 2. Trace Explorer View
    await page.getByTestId('nav-tab-explorer').click();
    await page.waitForSelector('text=Execution Sequence');
    await page.screenshot({ path: path.join(screenshotsDir, 'trace-explorer.png'), fullPage: true });

    // Click on a step with thought and inspect
    await page.getByTestId('step-item-step-02').click();
    await page.screenshot({ path: path.join(screenshotsDir, 'step-inspector.png'), fullPage: true });

    // 3. Workflow Graph View
    await page.getByTestId('nav-tab-workflow').click();
    await page.waitForSelector('text=Workflow State & Transition Graph');
    await page.screenshot({ path: path.join(screenshotsDir, 'workflow-graph.png'), fullPage: true });

    // 4. Run Comparison View
    await page.getByTestId('nav-tab-comparison').click();
    await page.waitForSelector('text=Aligned Step Comparison Matrix');
    await page.screenshot({ path: path.join(screenshotsDir, 'run-comparison.png'), fullPage: true });

    // 5. Studio Analytics View
    await page.getByTestId('nav-tab-analytics').click();
    await page.waitForSelector('text=Execution Performance Analytics');
    await page.screenshot({ path: path.join(screenshotsDir, 'studio-analytics.png'), fullPage: true });
  });

  test('captures mobile responsive studio layout', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto('http://localhost:5188/');
    await page.waitForSelector('[data-testid="studio-title"]');
    await page.screenshot({ path: path.join(screenshotsDir, 'mobile-dashboard.png'), fullPage: true });
  });
});
