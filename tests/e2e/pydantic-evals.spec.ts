import { test, expect } from '@playwright/test';

test('compares Pydantic evaluation criteria and exposes failed trajectory evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try Pydantic Evals comparison' }).click();
  await expect(page.getByText('Alignment: milestone', { exact: false })).toBeVisible();
  await expect(page.getByText('Run A acceptance: Evaluator reports 60/60 checks passed', { exact: true })).toBeVisible();
  await expect(page.getByText('Run B acceptance: Evaluator reports 40/60 checks passed', { exact: true })).toBeVisible();
  const trajectory = page.getByRole('row').filter({ hasText: 'order-1/TrajectoryMatch' });
  await expect(trajectory).toContainText('success');
  await expect(trajectory).toContainText('failed');
  await page.getByRole('button', { name: 'Preview Markdown report' }).click();
  await expect(page.getByLabel('Editable Markdown')).toHaveValue(/40\/60 checks passed/);
  await page.getByRole('button', { name: 'Close preview' }).click();
  await page.getByTestId('open-import-modal-btn').click();
  await page.locator('input[type=file]').setInputFiles('public/examples/pydantic-evals-regressed.json');
  await page.getByRole('searchbox', { name: 'Search steps' }).fill('order-1 / TrajectoryMatch');
  await page.locator('[data-testid^="step-item-"]').click();
  await expect(page.getByRole('heading', { name: 'order-1 / TrajectoryMatch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(page.locator('pre').filter({ hasText: 'evidenceStepIds' })).toContainText('"minimumScore": 1');
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  await expect(page.getByText(/required >= 1/).last()).toBeVisible();
});
