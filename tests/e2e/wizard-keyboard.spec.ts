import { test, expect } from '@playwright/test';

test.describe('Wizard Keyboard-Only Happy Path', () => {
  test('user completes full 5-step wizard using strictly keyboard navigation', async ({ page }) => {
    // Clear storage for fresh wizard session
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/plan/new');

    // STEP 1: Select Event Type
    const h1 = page.locator('h1#step-heading');
    await expect(h1).toContainText('What type of celebration are you planning?');

    // Press Tab until reaching Wedding radio, then select with Space
    // Or focus the first radio and select
    const weddingRadio = page.locator('input[value="wedding"]').first();
    await weddingRadio.focus();
    await page.keyboard.press('Space');
    expect(await weddingRadio.isChecked()).toBe(true);

    // Tab to Continue button and press Enter
    const continueBtn = page.locator('button:has-text("Continue")');
    await continueBtn.focus();
    await page.keyboard.press('Enter');

    // STEP 2: Date + City
    await expect(h1).toContainText('When and where is the celebration?');
    // Ensure focus moved to h1
    await expect(h1).toBeFocused();

    // Tab to City input
    const cityInput = page.locator('input#field-cityName');
    await cityInput.focus();
    await page.keyboard.type('Bengaluru');

    // Tab to Continue and press Enter
    await continueBtn.focus();
    await page.keyboard.press('Enter');

    // STEP 3: Guests + Budget
    await expect(h1).toContainText('How many guests');
    await expect(h1).toBeFocused();

    // Tab to Continue and press Enter
    await continueBtn.focus();
    await page.keyboard.press('Enter');

    // STEP 4: Details
    await expect(h1).toContainText('Celebration Details');
    await expect(h1).toBeFocused();

    // Tab to notes and add brief vibe
    const notesInput = page.locator('textarea#field-notes');
    await notesInput.focus();
    await page.keyboard.type('Traditional Carnatic wedding with floral mandap');

    // Tab to Continue and press Enter
    await continueBtn.focus();
    await page.keyboard.press('Enter');

    // STEP 5: Review
    await expect(h1).toContainText('Review Your Celebration Blueprint');
    await expect(h1).toBeFocused();

    // Summary checks
    await expect(page.locator('body')).toContainText('Bengaluru');
    await expect(page.locator('body')).toContainText('Indian Wedding');

    // Tab to "Create my plan" and press Enter
    const createBtn = page.locator('button:has-text("Create my plan")');
    await createBtn.focus();
    await page.keyboard.press('Enter');

    // Should redirect to /plan
    await expect(page).toHaveURL(/\/plan$/);
    await expect(page.locator('h1')).toContainText('Indian Wedding in Bengaluru');
  });
});
