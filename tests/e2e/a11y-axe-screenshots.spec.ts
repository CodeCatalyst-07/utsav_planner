import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('Axe Core Accessibility & Screen Screenshots', () => {
  test('Axe verification and screenshots on Start, Wizard, Plan Home, and Budget', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');
    const viewportSuffix = isMobile ? '375px' : '1280px';
    const screenshotsDir = path.resolve(process.cwd(), 'docs/screenshots');

    // 1. START SCREEN (/)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.waitForLoadState('networkidle');

    let axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `start-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 2. WIZARD STEP 1 (/plan/new)
    await page.goto('/plan/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1#step-heading').first()).toBeVisible();

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `wizard-step-1-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 3. WIZARD STEP 3 (Guests & Budget)
    // Step 1 -> Step 2
    await page.locator('button:has-text("Continue")').first().click();
    await page.locator('input#field-cityName').fill('Pune');
    // Step 2 -> Step 3
    await page.locator('button:has-text("Continue")').first().click();
    await expect(page.locator('h1#step-heading').first()).toContainText('How many guests');

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `wizard-step-3-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 4. WIZARD STEP 5 (Review)
    // Step 3 -> Step 4
    await page.locator('button:has-text("Continue")').first().click();
    // Step 4 -> Step 5
    await page.locator('button:has-text("Continue")').first().click();
    await expect(page.locator('h1#step-heading').first()).toContainText(
      'Review Your Celebration Blueprint'
    );

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `wizard-step-5-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 5. PLAN HOME SCREEN (/plan) with Seeded Plan & Mocked AI
    await page.route('/api/ai/section', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            themes: [
              {
                title: 'Royal Heritage Elegance',
                description: 'Traditional Maratha wedding with brass lamps and marigold florals.',
              },
              {
                title: 'Botanical Courtyard Romance',
                description: 'Open lawn mandap with fairy lights and pastel canopies.',
              },
              {
                title: 'Festive Vibrant Sangeet',
                description: 'High-energy live music setup with colorful drape cabanas.',
              },
            ],
          },
          meta: {
            provider: 'template',
            durationMs: 40,
          },
        }),
      });
    });

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
    await expect(page.locator('text=Royal Heritage Elegance')).toBeVisible();

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `plan-home-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 6. BUDGET SCREEN (/plan/budget) WITH WHAT-IF OPEN
    await page.goto('/plan/budget');
    await expect(page.locator('h1')).toContainText('Budget Blueprint');
    await expect(page.locator('h2#whatif-heading')).toBeVisible();

    // Trigger what-if rebalance
    await page.locator('input#whatif-guests').fill('300');
    await expect(page.locator('span:has-text("Catering +")').first()).toBeVisible();

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `budget-what-if-${viewportSuffix}.png`),
      fullPage: true,
    });

    // 7. TIMELINE SCREEN (/plan/timeline)
    await page.goto('/plan/timeline');
    await expect(page.locator('h1')).toContainText('Celebration Timeline');

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `timeline-${viewportSuffix}.png`),
      fullPage: true,
    });
    if (!isMobile) {
      await page.screenshot({
        path: path.join(screenshotsDir, `07-timeline-desktop.png`),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(screenshotsDir, `08-timeline-mobile.png`),
        fullPage: true,
      });
    }

    // 8. VENDORS SCREEN (/plan/vendors) WITH EXPANDED LISTING
    await page.goto('/plan/vendors');
    await expect(page.locator('h1')).toContainText('Vendor Checklist');

    // Expand the first vendor listing
    const showListingsBtn = page.locator('button:has-text("Show listings")').first();
    await showListingsBtn.click();
    await expect(page.locator('text=Sample listings disclaimer:')).toBeVisible();

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `vendors-${viewportSuffix}.png`),
      fullPage: true,
    });
    if (!isMobile) {
      await page.screenshot({
        path: path.join(screenshotsDir, `09-vendors-desktop.png`),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(screenshotsDir, `10-vendors-mobile.png`),
        fullPage: true,
      });
    }

    // 9. ASK SCREEN (/plan/ask) WITH CONVERSATION & PROPOSAL
    await page.route('/api/ai/chat', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply: 'I can reduce your guest count to 150. Here is the estimated impact:',
          patch: { guestCount: 150 },
          diff: {
            summaryFacts: ['Guest count changed from 300 to 150', 'Catering estimate decreased'],
            totalDelta: 0,
            cateringEstimateDelta: -300000,
            milestonesShifted: [],
          },
          meta: { provider: 'jarvis', durationMs: 60 },
        }),
      });
    });

    await page.goto('/plan/ask');
    await expect(page.locator('h1')).toContainText('Ask Event Assistant');

    const textarea = page.locator('textarea[aria-label="Ask the planning assistant"]');
    await textarea.fill('What if we cut the guest list to 150?');
    await page.locator('button[aria-label="Send message"]').click();
    await expect(page.locator('span:text-is("Proposed Plan Adjustment")')).toBeVisible();

    axeResults = await new AxeBuilder({ page }).analyze();
    expect(axeResults.violations).toEqual([]);

    await page.screenshot({
      path: path.join(screenshotsDir, `ask-${viewportSuffix}.png`),
      fullPage: true,
    });
    if (!isMobile) {
      await page.screenshot({
        path: path.join(screenshotsDir, `11-ask-desktop.png`),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(screenshotsDir, `12-ask-mobile.png`),
        fullPage: true,
      });
    }
  });
});
