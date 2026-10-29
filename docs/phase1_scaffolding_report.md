# Phase 1 Scaffolding Complete

The scaffolding, structure, configuration, tooling, design system, and accessible shell UI for **[Utsav Planner](file:///Users/arnav/Desktop/event_planner/src/lib/brand.ts)** are fully implemented and verified.

---

## 1. Final Folder Tree

```
event_planner/
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── .prettierignore
├── .prettierrc
├── docs/
│   ├── architecture.md
│   ├── decisions.md
│   └── phase1_scaffolding_report.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── plan/
│   │       ├── ask/
│   │       │   └── page.tsx
│   │       ├── budget/
│   │       │   └── page.tsx
│   │       ├── layout.tsx
│   │       ├── page.tsx
│   │       ├── timeline/
│   │       │   └── page.tsx
│   │       └── vendors/
│   │           └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── footer.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav.tsx
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── checkbox.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── select.tsx
│   │       ├── tabs.tsx
│   │       └── toast.tsx
│   ├── domain/
│   │   ├── config/
│   │   │   └── in/
│   │   │       └── README.md
│   │   ├── rules/
│   │   │   └── README.md
│   │   └── schemas/
│   │       └── README.md
│   ├── lib/
│   │   ├── brand.ts
│   │   └── utils.ts
│   └── server/
│       ├── env.ts
│       ├── google/
│       │   └── README.md
│       ├── llm/
│       │   └── README.md
│       ├── security/
│       │   └── README.md
│       └── vendors/
│           └── README.md
└── tests/
    ├── e2e/
    │   └── smoke.spec.ts
    ├── mocks/
    │   └── server-only.ts
    └── unit/
        ├── env.test.ts
        └── health.test.ts
```

---

## 2. Commands Ran & Results

| Command          | Target                                            | Result            | Output Summary                                                               |
| :--------------- | :------------------------------------------------ | :---------------- | :--------------------------------------------------------------------------- |
| `pnpm lint`      | ESLint (Flat Config + `jsx-a11y/recommended`)     | **PASS (code 0)** | 0 errors, 0 warnings                                                         |
| `pnpm format`    | Prettier check                                    | **PASS (code 0)** | All matched files use Prettier code style                                    |
| `pnpm typecheck` | TypeScript (`strict`, `noUncheckedIndexedAccess`) | **PASS (code 0)** | Zero compiler errors                                                         |
| `pnpm test`      | Vitest Unit Tests                                 | **PASS (code 0)** | 2 test files, 8 tests passed (500ms)                                         |
| `pnpm build`     | Next.js Production Build                          | **PASS (code 0)** | 10/10 routes compiled & static pages optimized (796ms)                       |
| `pnpm test:e2e`  | Playwright + `@axe-core/playwright`               | **PASS (code 0)** | 6 passed across `mobile-375x812` & `desktop-1280x800` (**0 axe violations**) |

---

## 3. WCAG Contrast Ratios & Formula

### Formula & Calculation Script

$$L = 0.2126 \times R_{\text{linear}} + 0.7152 \times G_{\text{linear}} + 0.0722 \times B_{\text{linear}}$$
$$\text{Contrast Ratio} = \frac{\max(L_1, L_2) + 0.05}{\min(L_1, L_2) + 0.05}$$

```javascript
function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const [rl, gl, bl] = [r, g, b].map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}
function getRatio(c1, c2) {
  const l1 = getLuminance(c1),
    l2 = getLuminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
```

### Verified Contrast Table

| Color Pair                  | Hex Values             | Relative Luminances                                        | Calculated Ratio | WCAG Requirement  | Status                |
| :-------------------------- | :--------------------- | :--------------------------------------------------------- | :--------------- | :---------------- | :-------------------- |
| **Ink on BG**               | `#2B1B17` on `#FFF8F0` | $L_{\text{ink}} = 0.0136, L_{\text{bg}} = 0.9469$          | **15.68 : 1**    | $\ge 4.5:1$ (AAA) | **PASS**              |
| **Ink on Surface**          | `#2B1B17` on `#FFFFFF` | $L_{\text{ink}} = 0.0136, L_{\text{surface}} = 1.0000$     | **16.51 : 1**    | $\ge 4.5:1$ (AAA) | **PASS**              |
| **White on Primary Button** | `#FFFFFF` on `#7A1F3D` | $L_{\text{white}} = 1.0000, L_{\text{primary}} = 0.0545$   | **10.04 : 1**    | $\ge 4.5:1$ (AAA) | **PASS**              |
| **Primary on BG**           | `#7A1F3D` on `#FFF8F0` | $L_{\text{primary}} = 0.0545, L_{\text{bg}} = 0.9469$      | **9.54 : 1**     | $\ge 4.5:1$ (AAA) | **PASS**              |
| **Primary on Surface**      | `#7A1F3D` on `#FFFFFF` | $L_{\text{primary}} = 0.0545, L_{\text{surface}} = 1.0000$ | **10.04 : 1**    | $\ge 4.5:1$ (AAA) | **PASS**              |
| **Secondary on BG**         | `#0F766E` on `#FFF8F0` | $L_{\text{sec}} = 0.1418, L_{\text{bg}} = 0.9469$          | **5.20 : 1**     | $\ge 4.5:1$ (AA)  | **PASS**              |
| **Secondary on Surface**    | `#0F766E` on `#FFFFFF` | $L_{\text{sec}} = 0.1418, L_{\text{surface}} = 1.0000$     | **5.47 : 1**     | $\ge 4.5:1$ (AA)  | **PASS**              |
| **Danger on Surface**       | `#B42318` on `#FFFFFF` | $L_{\text{danger}} = 0.1097, L_{\text{surface}} = 1.0000$  | **6.57 : 1**     | $\ge 4.5:1$ (AAA) | **PASS**              |
| **Warning on Surface**      | `#B54708` on `#FFFFFF` | $L_{\text{warning}} = 0.1435, L_{\text{surface}} = 1.0000$ | **5.43 : 1**     | $\ge 4.5:1$ (AA)  | **PASS**              |
| **Focus Rings**             | `#7A1F3D` on `#FFF8F0` | $L_{\text{primary}} = 0.0545, L_{\text{bg}} = 0.9469$      | **9.54 : 1**     | $\ge 3.0:1$ (UI)  | **PASS**              |
| **Accent on Surface**       | `#F59E0B` on `#FFFFFF` | $L_{\text{accent}} = 0.4389, L_{\text{surface}} = 1.0000$  | **2.15 : 1**     | _Decoration only_ | **PASS (Never text)** |

---

## 4. Deviations & Observations

1. **ESLint 9 Flat Config (`eslint.config.mjs`)**:
   ESLint 9 ignores `.eslintrc.*` by default. We implemented [`eslint.config.mjs`](file:///Users/arnav/Desktop/event_planner/eslint.config.mjs) using `FlatCompat` to extend `next/core-web-vitals` alongside `plugin:jsx-a11y/recommended`. Global ignore patterns (`.next/**`, `test-results/**`) were explicitly configured at the top of the flat config array so Next.js build chunks are not flagged.
2. **Playwright Mobile Configuration**:
   To ensure CI runs cleanly via `playwright install --with-deps chromium`, the `mobile-375x812` project in [`playwright.config.ts`](file:///Users/arnav/Desktop/event_planner/playwright.config.ts) was configured with `browserName: 'chromium'`, `viewport: { width: 375, height: 812 }`, and `isMobile: true`. This avoids requiring WebKit binaries while testing the exact mobile layout and accessibility tree.
3. **Route Navigation Structure**:
   Per your guidance, the five workspace sections are route-based links ([`/plan`](file:///Users/arnav/Desktop/event_planner/src/app/plan/page.tsx), [`/plan/budget`](file:///Users/arnav/Desktop/event_planner/src/app/plan/budget/page.tsx), [`/plan/timeline`](file:///Users/arnav/Desktop/event_planner/src/app/plan/timeline/page.tsx), [`/plan/vendors`](file:///Users/arnav/Desktop/event_planner/src/app/plan/vendors/page.tsx), [`/plan/ask`](file:///Users/arnav/Desktop/event_planner/src/app/plan/ask/page.tsx)) using `aria-current="page"`. The primitive [`Tabs`](file:///Users/arnav/Desktop/event_planner/src/components/ui/tabs.tsx) component remains available in `src/components/ui/` for future within-page tabbed interfaces without duplicating route state.
