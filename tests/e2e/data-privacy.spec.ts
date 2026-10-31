import { test, expect } from '@playwright/test';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('Data Privacy & Clear My Data Action', () => {
  test('confirmation dialog clears localStorage and resets application state', async ({ page }) => {
    // 1. Seed saved real plan
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

    await page.goto('/plan');
    await expect(page.locator('h1')).toContainText('Indian Wedding in Pune');

    // 2. Click "Clear my data"
    const clearBtn = page.locator('button:has-text("Clear my data")');
    await clearBtn.click();

    // 3. Confirmation dialog appears
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Clear All Celebration Data?');

    // Test Cancel first
    const cancelBtn = dialog.locator('button:has-text("Cancel")');
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('h1')).toContainText('Indian Wedding in Pune');

    // Open again and confirm
    await clearBtn.click();
    const confirmClearBtn = dialog.locator('button:has-text("Clear Data")');
    await confirmClearBtn.click();

    // Should redirect to '/' and localStorage must be empty
    await expect(page).toHaveURL(/\/$/);

    const stored = await page.evaluate(() => localStorage.getItem('utsav_plan_v1'));
    expect(stored).toBeNull();

    // Navigating back to /plan should show clean empty state
    await page.goto('/plan');
    await expect(page.locator('h1')).toContainText('Celebration Workspace');
    await expect(page.locator('text=No celebration blueprint configured yet')).toBeVisible();
  });
});
