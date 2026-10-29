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

  test('/plan?sample=1 displays Phase 2 empty state with clear action and passes axe', async ({
    page,
  }) => {
    await page.goto('/plan?sample=1');

    // Exactly one h1
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);
    await expect(h1Elements).toContainText('Sample Celebration Plan');

    // No dead buttons: has real link with clear call-to-action
    const ctaButton = page.locator('a:has-text("Configure New Event")');
    await expect(ctaButton).toBeVisible();

    // Axe core accessibility verification
    const scanResults = await new AxeBuilder({ page }).analyze();
    expect(scanResults.violations).toEqual([]);
  });

  test('/plan workspace loads route-based nav links and passes axe', async ({ page }) => {
    await page.goto('/plan');

    // One h1
    const h1Elements = page.locator('h1');
    await expect(h1Elements).toHaveCount(1);
    await expect(h1Elements).toContainText('Celebration Plan Overview');

    // Route-based nav link has aria-current="page" and is visible
    const activeNavLink = page.locator('nav a[aria-current="page"]:visible').first();
    await expect(activeNavLink).toBeVisible();

    // Axe core accessibility verification
    const scanResults = await new AxeBuilder({ page }).analyze();
    expect(scanResults.violations).toEqual([]);
  });
});
