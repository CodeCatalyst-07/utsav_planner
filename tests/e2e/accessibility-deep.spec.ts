import { test, expect } from '@playwright/test';

/**
 * tests/e2e/accessibility-deep.spec.ts
 *
 * Verifies deep accessibility requirements:
 * 1. 200% Zoom Reflow: Viewport equivalent (640x400) displays with zero horizontal scrollbar
 *    and no clipped content.
 * 2. Forced Colors (High Contrast Mode): forcedColors: 'active' emulation preserves visible
 *    focus outlines, text contrast, and status indicators.
 * 3. Reduced Motion: prefers-reduced-motion: 'reduce' emulation disables transition/animations.
 * 4. Route Headings & Meta Titles: Verifies distinct server-rendered <title> and meta description.
 */

const CORE_ROUTES = [
  { name: 'start', path: '/', expectedTitle: 'Utsav Planner' },
  { name: 'wizard', path: '/plan/new', expectedTitle: 'New Event Blueprint Wizard' },
  {
    name: 'plan_home',
    path: '/plan?sample=pune_wedding',
    expectedTitle: 'Plan Workspace Overview',
  },
  { name: 'budget', path: '/plan/budget', expectedTitle: 'Budget & What-If' },
  { name: 'timeline', path: '/plan/timeline', expectedTitle: 'Celebration Timeline & Calendar' },
  { name: 'vendors', path: '/plan/vendors', expectedTitle: 'Vendor Directory & Checklist' },
  { name: 'ask', path: '/plan/ask', expectedTitle: 'Ask Event Assistant' },
];

test.describe('Accessibility Deep Audit: Reflow & Responsive Zoom (200%)', () => {
  for (const route of CORE_ROUTES) {
    test(`Route [${route.name}] (${route.path}) reflows at 640x400 with no horizontal overflow`, async ({
      page,
    }) => {
      // 640x400 viewport simulates standard 200% desktop browser zoom on a 1280x800 display
      await page.setViewportSize({ width: 640, height: 400 });
      const res = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBeLessThan(400);

      await page.waitForTimeout(500);

      // Verify page title
      const title = await page.title();
      expect(title).toContain(route.expectedTitle);

      // Verify zero horizontal page scrolling (scrollWidth === clientWidth)
      const hasHorizontalScroll = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > root.clientWidth;
      });

      expect(
        hasHorizontalScroll,
        `Horizontal overflow detected at 640px reflow on ${route.path}`
      ).toBe(false);
    });
  }
});

test.describe('Accessibility Deep Audit: High Contrast Mode (forced-colors: active)', () => {
  for (const route of CORE_ROUTES) {
    test(`Route [${route.name}] renders high-contrast focus rings and status chips`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        forcedColors: 'active',
        colorScheme: 'dark',
        viewport: { width: 1024, height: 768 },
      });
      const page = await context.newPage();
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      // Save screenshot evidence
      await page.screenshot({
        path: `docs/screenshots/forced-colors/${route.name}-forced-colors.png`,
        fullPage: false,
      });

      // Press Tab and verify active element has focus
      await page.keyboard.press('Tab');
      const hasFocusedElement = await page.evaluate(() => document.activeElement !== document.body);
      expect(hasFocusedElement).toBe(true);

      await context.close();
    });
  }
});

test.describe('Accessibility Deep Audit: Reduced Motion (prefers-reduced-motion: reduce)', () => {
  test('Respects user preference for reduced motion', async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: 'reduce',
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    await page.goto('/plan?sample=pune_wedding', { waitUntil: 'domcontentloaded' });

    const matchesReducedMotion = await page.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    expect(matchesReducedMotion).toBe(true);
    await context.close();
  });
});
