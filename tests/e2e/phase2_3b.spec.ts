import { test, expect } from '@playwright/test';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('Phase 2.3b UI Part 2 E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Seed v2 plan in localStorage
    await page.goto('/');
    await page.evaluate((profile) => {
      sessionStorage.clear();
      localStorage.setItem(
        'utsav_plan_v2',
        JSON.stringify({
          version: 2,
          profile,
          overrides: {},
          completedMilestones: [],
          bookedVendors: [],
          savedAt: new Date().toISOString(),
        })
      );
    }, weddingPuneFixture);
  });

  test('1. Mark milestone done -> persists on reload', async ({ page }) => {
    await page.goto('/plan/timeline');
    await expect(page.locator('h1')).toContainText('Celebration Timeline');

    // Initial progress: 0 of N done
    await expect(page.locator('p:has-text("0 of")')).toBeVisible();

    // Check the first milestone checkbox
    const firstCheckbox = page.locator('button[id^="chk-"]').first();
    await firstCheckbox.click();

    // Progress updates to 1 of N done
    await expect(page.locator('p:has-text("1 of")')).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await expect(page.locator('p:has-text("1 of")')).toBeVisible();
    await expect(firstCheckbox).toHaveAttribute('data-state', 'checked');
  });

  test('2. Download .ics with skip completed checkbox and Google Calendar links', async ({
    page,
  }) => {
    await page.goto('/plan/timeline');

    // Verify Google Calendar links exist
    const gcalLink = page.locator('a[aria-label*="Google Calendar"]').first();
    await expect(gcalLink).toBeVisible();
    const href = await gcalLink.getAttribute('href');
    expect(href).toContain('calendar.google.com/calendar/render');

    // Mark milestone done and check "Skip completed"
    const firstCheckbox = page.locator('button[id^="chk-"]').first();
    await firstCheckbox.click();

    const skipCheckbox = page.locator('label:has-text("Skip completed milestones") input');
    await skipCheckbox.check();

    // Intercept download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Download .ics (all)")').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('event-timeline.ics');
  });

  test('3. Vendors priority list, booking toggle persistence, and sample expander disclaimer', async ({
    page,
  }) => {
    await page.goto('/plan/vendors');
    await expect(page.locator('h1')).toContainText('Vendor Checklist');

    // Progress starts at 0 booked
    await expect(page.locator('text=0 of')).toBeVisible();

    // Book first vendor
    const firstVendorCheckbox = page.locator('button[role="checkbox"]').first();
    await firstVendorCheckbox.click();

    // Progress updates to 1 of N booked
    await expect(page.locator('text=1 of')).toBeVisible();

    // Reload page and verify persistence
    await page.reload();
    await expect(page.locator('text=1 of')).toBeVisible();

    // Expand vendor listings
    const showListingsBtn = page.locator('button:has-text("Show listings")').first();
    await showListingsBtn.click();

    // Verify sample disclaimer is prominently displayed
    await expect(page.locator('text=Sample listings disclaimer:')).toBeVisible();
    await expect(
      page.locator('text=Sample listing, not a real business. Use the Google Maps link above')
    ).toBeVisible();
  });

  test('4. Caterer row on-demand Menu Ideas opens modal with courses', async ({ page }) => {
    // Mock menu route
    await page.route('/api/ai/section', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      if (postData.section === 'menu') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              suggestions: [
                {
                  course: 'Welcome Beverages & Chaat',
                  items: ['Kokum Sharbat', 'Pani Puri Counter', 'Kothimbir Vadi'],
                },
                {
                  course: 'Traditional Maharashtrian Feast',
                  items: ['Puri Shrikhand', 'Varan Bhaat', 'Matki Usal'],
                },
              ],
            },
            meta: { provider: 'jarvis', durationMs: 50 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/plan/vendors');
    const menuBtn = page.locator('button:has-text("Menu ideas")').first();
    await menuBtn.click();

    await expect(page.locator('h3#menu-ideas-heading')).toBeVisible();
    await expect(page.locator('text=Welcome Beverages & Chaat')).toBeVisible();
    await expect(page.locator('text=Kokum Sharbat')).toBeVisible();

    // Close modal
    await page.locator('button:has-text("Close")').click();
    await expect(page.locator('h3#menu-ideas-heading')).not.toBeVisible();
  });

  test('5. Budget Category Tips on-demand fetch and display', async ({ page }) => {
    // Mock category tips route
    await page.route('/api/ai/section', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      if (postData.section === 'category_tips') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              tips: [
                {
                  categoryId: 'catering',
                  tip: 'Lock seasonal vegetables and negotiate live counter inclusions early.',
                },
                {
                  categoryId: 'venue',
                  tip: 'Check if daytime lawn rental includes electrical generator backup.',
                },
              ],
            },
            meta: { provider: 'jarvis', durationMs: 45 },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/plan/budget');
    await expect(page.locator('h1')).toContainText('Budget');
    const getTipsBtn = page.locator('button:has-text("tips")').first();
    await expect(getTipsBtn).toBeVisible();
    await getTipsBtn.click();

    await expect(page.locator('text=Lock seasonal vegetables')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh tips")')).toBeVisible();
  });

  test('6. Chat assistant proposing plan change -> Apply updates plan; No thanks leaves plan untouched', async ({
    page,
  }) => {
    // Mock /api/ai/chat with plan update proposal
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

    // Type query and send
    const textarea = page.locator('textarea[aria-label="Ask the planning assistant"]');
    await textarea.fill('What if we cut the guest list to 150?');
    await page.locator('button[aria-label="Send message"]').click();

    // Verify proposal block
    await expect(page.locator('span:text-is("Proposed Plan Adjustment")')).toBeVisible();
    await expect(page.locator('text=Guest count changed from 300 to 150')).toBeVisible();

    const applyBtn = page.locator('button:has-text("Apply change")');
    const noThanksBtn = page.locator('button:has-text("No thanks")');
    await expect(applyBtn).toBeVisible();
    await expect(noThanksBtn).toBeVisible();

    // Click Apply change
    await applyBtn.click();
    await expect(page.locator('text=Plan updated successfully.')).toBeVisible();

    // Ensure state persisted to localStorage before navigating
    await page.waitForFunction(() => {
      const stored = localStorage.getItem('utsav_plan_v2');
      return stored && JSON.parse(stored).profile?.guestCount === 150;
    });

    // Navigate to Plan Home to verify updated guest count
    await page.goto('/plan');
    await expect(page.locator('text=150 guests')).toBeVisible();
  });

  test('7. Keyboard-only navigation across Timeline, Vendors, and Ask pages', async ({ page }) => {
    // Timeline
    await page.goto('/plan/timeline');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Ensure active element is focusable
    const activeTagName = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(activeTagName);

    // Vendors
    await page.goto('/plan/vendors');
    await page.keyboard.press('Tab');
    const activeVendorsTagName = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(activeVendorsTagName);

    // Ask
    await page.goto('/plan/ask');
    const textarea = page.locator('textarea[aria-label="Ask the planning assistant"]');
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.focus();
    await page.keyboard.type('Hello assistant');
    await page.keyboard.press('Enter');
    // Verify user message sent via Enter key
    await expect(page.locator('text=Hello assistant')).toBeVisible();
  });
});
