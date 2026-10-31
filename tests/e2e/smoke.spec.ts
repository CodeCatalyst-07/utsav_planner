import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility & Core Shell Smoke Tests', () => {
  test('Home page loads, has one h1, skip link, and passes axe with zero violations', async ({
    page,
  }) => {
    await page.goto('/');

    // Title contains brand name
    await expect(page).toHaveTitle(/Utsav Planner/);

    // Landmark requirements: exactly one h1 per page
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);
    await expect(h1Elements).toBeVisible();

    // Accessible skip-to-content link
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveCount(1);
    await expect(skipLink).toHaveText('Skip to main content');

    // Semantic landmarks exist
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main#main-content')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();

    // Disclaimer present in footer
    await expect(page.locator('footer')).toContainText('Planning aid, not a quote.');

    // Axe core accessibility verification
    const scanResults = await new AxeBuilder({ page }).analyze();
    expect(scanResults.violations).toEqual([]);
  });

  test('/plan displays designed empty state with clear call to action and passes axe', async ({
    page,
  }) => {
    // Clear storage to ensure clean empty state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/plan');

    // Exactly one h1
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);
    await expect(h1Elements).toContainText('Celebration Workspace');

    // Actions exist
    await expect(page.locator('a:has-text("Start Planning")')).toBeVisible();
    await expect(page.locator('button:has-text("Try a sample plan")')).toBeVisible();

    // Axe core accessibility verification
    const scanResults = await new AxeBuilder({ page }).analyze();
    expect(scanResults.violations).toEqual([]);
  });
});
