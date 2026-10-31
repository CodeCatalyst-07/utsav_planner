import { test, expect } from '@playwright/test';

/**
 * tests/e2e/console-csp.spec.ts
 *
 * Verifies that zero console errors and zero Content Security Policy (CSP)
 * violations occur across all core user-facing routes:
 * 1. Start (/)
 * 2. Wizard (/plan/new)
 * 3. Plan home (/plan?sample=pune_wedding)
 * 4. Budget & What-If (/plan/budget)
 * 5. Timeline (/plan/timeline)
 * 6. Vendors (/plan/vendors)
 * 7. Ask (/plan/ask)
 */

const ROUTES_TO_AUDIT = [
  { name: 'Start Screen', path: '/' },
  { name: 'Wizard', path: '/plan/new' },
  { name: 'Plan Home (Sample)', path: '/plan?sample=pune_wedding' },
  { name: 'Budget & What-If', path: '/plan/budget' },
  { name: 'Celebration Timeline', path: '/plan/timeline' },
  { name: 'Vendor Directory', path: '/plan/vendors' },
  { name: 'Ask Assistant', path: '/plan/ask' },
];

for (const route of ROUTES_TO_AUDIT) {
  test(`Route [${route.name}] (${route.path}) has 0 console errors and 0 CSP violations`, async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(`[PageError] ${err.message}`);
    });

    // Listen for browser security policy violations (CSP)
    await page.addInitScript(() => {
      (window as any).__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => {
        (window as any).__cspViolations.push({
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          effectiveDirective: e.effectiveDirective,
          sourceFile: (e as any).sourceFile,
          lineNumber: (e as any).lineNumber,
          sample: (e as any).sample,
        });
      });
    });

    // Navigate to route
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(400);

    // Wait 1 second for any deferred scripts/effects
    await page.waitForTimeout(1000);

    // Collect any recorded CSP violations
    const cspViolations = await page.evaluate(
      () =>
        (window as any).__cspViolations as Array<{ blockedURI: string; violatedDirective: string }>
    );

    expect(
      consoleErrors,
      `Found console errors on ${route.path}: ${consoleErrors.join('; ')}`
    ).toEqual([]);
    expect(pageErrors, `Found page errors on ${route.path}: ${pageErrors.join('; ')}`).toEqual([]);
    expect(
      cspViolations,
      `Found CSP violations on ${route.path}: ${JSON.stringify(cspViolations)}`
    ).toEqual([]);
  });
}
