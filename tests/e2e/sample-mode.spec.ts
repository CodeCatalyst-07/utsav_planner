import { test, expect } from '@playwright/test';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('Sample Mode Isolation (Amendment 1)', () => {
  test('loading sample plan displays persistent banner and does not overwrite existing real plan', async ({
    page,
  }) => {
    // 1. Seed saved real plan for Jaipur
    const realPlan = {
      ...weddingPuneFixture,
      cityName: 'Jaipur',
      guestCount: 220,
      dietary: {
        veg: 180,
        nonVeg: 30,
        jain: 10,
        vegan: 0,
      },
    };

    await page.goto('/');
    await page.evaluate((profile) => {
      localStorage.setItem(
        'utsav_plan_v1',
        JSON.stringify({
          version: 1,
          profile,
          overrides: { decor: 400000 },
          savedAt: new Date().toISOString(),
        })
      );
    }, realPlan);

    // 2. Click "Try a sample plan" on Start screen
    await page.goto('/');
    const sampleBtn = page.locator('button:has-text("Try a sample plan")');
    await sampleBtn.click();

    await expect(page).toHaveURL(/\/plan$/);

    // 3. Verify persistent sample banner appears
    const sampleBanner = page.locator('aside[aria-label="Sample Plan Notice"]');
    await expect(sampleBanner).toBeVisible();
    await expect(sampleBanner).toContainText("You're viewing a sample plan");
    await expect(sampleBanner).toContainText('Start my own plan');

    // Action button to return to saved plan should be visible
    const returnBtn = page.locator('button:has-text("Return to my saved plan")');
    await expect(returnBtn).toBeVisible();

    // 4. Verify localStorage STILL has the real Jaipur plan, NOT the sample
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('utsav_plan_v2') || localStorage.getItem('utsav_plan_v1');
      return raw ? JSON.parse(raw) : null;
    });

    expect(stored.profile.cityName).toBe('Jaipur');
    expect(stored.profile.guestCount).toBe(220);
    expect(stored.overrides.decor).toBe(400000);

    // 5. Click "Return to my saved plan"
    await returnBtn.click();

    // Banner disappears and real plan is shown
    await expect(sampleBanner).not.toBeVisible();
    await expect(page.locator('h1')).toContainText('Indian Wedding in Jaipur');
  });
});
