import { test, expect } from '@playwright/test';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('What-If Rebalancing & Local Persistence', () => {
  test('increasing guests 200 -> 300 shows catering diff chip and Apply persists after reload', async ({
    page,
  }) => {
    // Seed localStorage with a known real plan
    await page.goto('/');
    await page.evaluate((profile) => {
      localStorage.setItem(
        'utsav_plan_v1',
        JSON.stringify({
          version: 1,
          profile,
          overrides: {},
          savedAt: new Date().toISOString(),
        })
      );
    }, weddingPuneFixture);

    await page.goto('/plan/budget');

    // Initial check
    await expect(page.locator('h1')).toContainText('Budget Blueprint');

    // What-If Panel exists
    const whatIfHeading = page.locator('h2#whatif-heading');
    await expect(whatIfHeading).toBeVisible();

    const guestsInput = page.locator('input#whatif-guests');
    await expect(guestsInput).toHaveValue('200');

    // Change guests to 300
    await guestsInput.fill('300');

    // Computed Diff Chip appears
    const cateringDiffChip = page.locator('span:has-text("Catering +")').first();
    await expect(cateringDiffChip).toBeVisible();

    // Replan summary text appears
    await expect(page.locator('text=Engine Replan Summary:')).toBeVisible();

    // Click Apply changes
    const applyBtn = page.locator('button:has-text("Apply changes")');
    await applyBtn.click();

    // Confirm that the guests updated in storage and table rebalanced
    const cateringStatusChip = page.locator(
      'span:has-text("Tight Per-Plate"), span:has-text("Over Catering Band")'
    );
    await expect(cateringStatusChip.first()).toBeVisible();

    // Reload page to verify local persistence
    await page.reload();

    // After reload, What-If guest count must be 300
    await expect(page.locator('input#whatif-guests')).toHaveValue('300');
  });
});
