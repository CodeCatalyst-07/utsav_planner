# Accessibility & Inclusive Design Guide

## Overview

Utsav Planner is designed to WCAG 2.1 Level AA and AAA standards, ensuring full keyboard navigability, high-contrast support, screen reader comprehension, zero-overflow 200% zoom reflow, and motion sensitivity.

---

## Screen-by-Screen Keyboard Navigation Map

| Screen                   | Route            | Key Interactions                       | Accessible Behavior                                                                                                                                  |
| :----------------------- | :--------------- | :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start Screen**         | `/`              | `Tab`, `Shift+Tab`, `Enter`            | Focus starts on skip link, moves sequentially through primary CTA ("Start Planning") and sample profile quick-launch buttons.                        |
| **Blueprint Wizard**     | `/plan/new`      | `Tab`, `Arrow keys`, `Space`, `Enter`  | Step-by-step form: Radio button groups navigate with `ArrowUp`/`ArrowDown`; numerical inputs announce increments; `Enter` advances to the next step. |
| **Plan Workspace**       | `/plan?sample=*` | `Tab`, `Enter`, `Escape`               | Overview cards, milestone summaries, and AI Ideas refresh button. Modals (e.g., Clear Plan dialog) trap focus inside and restore focus on `Escape`.  |
| **Budget & What-If**     | `/plan/budget`   | `Tab`, `Enter`, `Arrow keys`, `Escape` | Budget tables, Category edit buttons, and What-If Sandbox steppers & numeric inputs. Radix Dialogs trap keyboard focus with `aria-modal="true"`.     |
| **Celebration Timeline** | `/plan/timeline` | `Tab`, `Enter`, `Space`                | Milestone status checkboxes toggle completion state; Google Calendar / `.ics` export buttons trigger downloads without losing focus.                 |
| **Vendor Directory**     | `/plan/vendors`  | `Tab`, `Enter`                         | Category tab switcher with `ArrowLeft`/`ArrowRight`; vendor search links open external Google Maps listings with `rel="noopener noreferrer"`.        |
| **Ask Assistant**        | `/plan/ask`      | `Tab`, `Enter`                         | Chat input submits on `Enter` (without Shift); patch preview cards provide explicit "Apply Patch" and "Dismiss" buttons.                             |

---

## Screen Reader Semantics & ARIA Landmarks

- **Semantic HTML5 Landmarks**: Every page uses `<header role="banner">`, `<main id="main-content">`, `<nav aria-label="Main Navigation">`, and `<footer role="contentinfo">`.
- **Skip Links**: An accessible skip link (`href="#main-content"`) is the first focusable element on every page, allowing keyboard users to bypass header navigation.
- **Dynamic Live Announcements**: `aria-live="polite"` regions announce budget updates in the What-If sandbox, toast notifications, and AI generation statuses.
- **Indian Currency Pronunciation**: Currency values are rendered with the `<MoneyDisplay />` component, which includes hidden `sr-only` spoken text (e.g., `<span class="sr-only">25 lakh rupees</span>`) alongside formatted visual text (`₹25,00,000`).

---

## 200% Zoom & Responsive Reflow

- **WCAG 1.4.10 Reflow Compliance**: Tested and verified under standard 200% desktop browser zoom on a 1280x800 display (effective viewport: `640x400`).
- **Zero Horizontal Overflow**: `document.documentElement.scrollWidth === document.documentElement.clientWidth` across all core routes (`/`, `/plan/new`, `/plan`, `/plan/budget`, `/plan/timeline`, `/plan/vendors`, `/plan/ask`).
- Responsive single-column reflow ensures that no cards, tables, or buttons are clipped, obscured, or require bi-directional scrolling.

---

## High Contrast Mode (`forced-colors: active`)

- **System Theme Adaptation**: Evaluated under Windows High Contrast Mode / CSS `forced-colors: active`.
- **Focus Rings**: Strict 2px solid `Highlight` or `CanvasText` outlines are preserved on all interactive elements.
- **Status Chips**: Status indicators ([status-chip.tsx](../src/components/ui/status-chip.tsx)) adapt borders and text to system colors (`Canvas`, `CanvasText`, `HighlightText`), maintaining distinct visual states without relying purely on color fills.
- **Screenshots**: Visual inspection captures are stored in `docs/screenshots/forced-colors/`:
  - `start-forced-colors.png`
  - `wizard-forced-colors.png`
  - `plan_home-forced-colors.png`
  - `budget-forced-colors.png`
  - `timeline-forced-colors.png`
  - `vendors-forced-colors.png`
  - `ask-forced-colors.png`

---

## Motion Sensitivity (`prefers-reduced-motion: reduce`)

- **Respect for User Vestibular Preferences**: CSS global styles and Tailwind config honor `prefers-reduced-motion: reduce`.
- **Instant Transitions**: When active, CSS transitions and keyframe animations are suppressed (`animation-duration: 0.01ms !important`, `transition-duration: 0.01ms !important`), eliminating dizziness-inducing motion while maintaining immediate state feedback.

---

## Route Metadata & Title Structure

Every route is server-rendered with unique `<title>` and `<meta name="description">` tags to support assistive technologies and bookmarks:

| Route                | `<title>`                                                                             |
| :------------------- | :------------------------------------------------------------------------------------ |
| `/`                  | `Utsav Planner - AI-Assisted Cultural Celebration Planner for India`                  |
| `/plan/new`          | `New Event Blueprint Wizard \| Utsav Planner`                                         |
| `/plan`              | `Plan Workspace Overview \| Utsav Planner`                                            |
| `/plan/budget`       | `Budget & What-If Sandbox \| Utsav Planner`                                           |
| `/plan/timeline`     | `Celebration Timeline & Calendar \| Utsav Planner`                                    |
| `/plan/vendors`      | `Vendor Directory & Checklist \| Utsav Planner`                                       |
| `/plan/ask`          | `Ask Event Assistant \| Utsav Planner`                                                |
| Global Brand Favicon | Built strictly from brand design tokens (`icon.svg`, `#7A1F3D`, `#F59E0B`, `#FFF8F0`) |
| Theme Color          | `#7A1F3D` (Royal Maroon brand primary)                                                |
