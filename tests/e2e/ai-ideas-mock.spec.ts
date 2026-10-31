import { test, expect } from '@playwright/test';
import { weddingPuneFixture } from '../../src/domain/fixtures/profiles';

test.describe('AI Ideas Route Mocking & Error Resilience (Amendment 6)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed real plan
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
      sessionStorage.clear();
    }, weddingPuneFixture);
  });

  test('(a) fast deterministic response renders 3 ideas with attribution', async ({ page }) => {
    await page.route('/api/ai/section', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            themes: [
              {
                title: 'Royal Heritage Palace',
                description: 'Majestic floral arches and brass lamps.',
              },
              {
                title: 'Pastel Garden Romance',
                description: 'Understated elegance with soft pastel drapes.',
              },
              {
                title: 'Festive Vibrant Sangeet',
                description: 'High-energy colorful tents and folk beats.',
              },
            ],
          },
          meta: {
            provider: 'jarvis',
            durationMs: 140,
          },
        }),
      });
    });

    await page.goto('/plan');

    // Ideas should be visible
    await expect(page.locator('text=Royal Heritage Palace')).toBeVisible();
    await expect(page.locator('text=Written by AI: Gemma via Jarvis')).toBeVisible();
  });

  test('(b) slow response displays Stop button and aborts on click', async ({ page }) => {
    await page.route('/api/ai/section', async (route) => {
      // Delay response by 3 seconds
      await new Promise((r) => setTimeout(r, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { themes: [] },
          meta: { provider: 'template' },
        }),
      });
    });

    await page.goto('/plan');

    // Stop button should appear during loading and be reachable by keyboard
    const stopBtn = page.locator('button:has-text("Stop")');
    await expect(stopBtn).toBeVisible();
    await stopBtn.focus();
    await expect(stopBtn).toBeFocused();

    // Trigger stop
    await stopBtn.click();

    // Friendly aborted error message should appear
    await expect(page.locator('text=Idea generation was stopped')).toBeVisible();
  });

  test('(c) HTTP 429 with Retry-After header shows friendly message', async ({ page }) => {
    await page.route('/api/ai/section', async (route) => {
      await route.fulfill({
        status: 429,
        headers: {
          'retry-after': '30',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests.',
          },
        }),
      });
    });

    await page.goto('/plan');

    // Friendly rate limit notice
    await expect(page.locator('text=Generation rate limit reached')).toBeVisible();
    await expect(page.locator('text=wait ~30 seconds')).toBeVisible();
  });
});
