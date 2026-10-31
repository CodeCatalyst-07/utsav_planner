import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetPage from '@/app/plan/budget/page';
import { PlanProvider } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Budget Component (src/app/plan/budget/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderBudgetWithPlan = () =>
    render(
      <PlanProvider
        initialData={{
          realProfile: weddingPuneFixture,
          realOverrides: {},
          isHydrated: true,
        }}
      >
        <BudgetPage />
      </PlanProvider>
    );

  it('renders budget categories table, totals, and stacked bar', () => {
    renderBudgetWithPlan();

    expect(
      screen.getByRole('heading', { level: 1, name: /Budget Blueprint/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Venue & Accommodation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Catering & Beverages').length).toBeGreaterThan(0);
    expect(screen.getByText('Total Celebration Budget')).toBeInTheDocument();
  });

  it('supports inline override editing, saving, and reset-to-suggested', async () => {
    const user = userEvent.setup();
    renderBudgetWithPlan();

    // Find the first "Edit" button
    const editButtons = screen.getAllByRole('button', { name: /^Edit$/i });
    expect(editButtons.length).toBeGreaterThan(0);
    await user.click(editButtons[0]!);

    // Input should appear for override
    const overrideInput = screen.getByLabelText(/Override amount for/i);
    expect(overrideInput).toBeInTheDocument();

    // Type new amount: 1000000
    await user.clear(overrideInput);
    await user.type(overrideInput, '1000000');

    // Click Save
    const saveBtn = screen.getByLabelText(/Save override for/i);
    await user.click(saveBtn);

    // Overridden badge should now be visible
    await waitFor(() => {
      expect(screen.getByText('Edited by you')).toBeInTheDocument();
    });

    // Click Edit again to test reset
    const editBtnAfterOverride = screen.getAllByRole('button', { name: /^Edit$/i })[0]!;
    await user.click(editBtnAfterOverride);

    // Reset button should now be available
    const resetBtn = screen.getByTitle(/Reset to engine suggestion/i);
    expect(resetBtn).toBeInTheDocument();
    await user.click(resetBtn);

    // "Edited by you" should disappear
    await waitFor(() => {
      expect(screen.queryByText('Edited by you')).not.toBeInTheDocument();
    });
  });

  it('opens and closes assumptions dialog', async () => {
    const user = userEvent.setup();
    renderBudgetWithPlan();

    const assumptionsBtn = screen.getByRole('button', { name: /Assumptions/i });
    await user.click(assumptionsBtn);

    await waitFor(() => {
      expect(screen.getByText('Engine Planning Assumptions')).toBeInTheDocument();
      expect(screen.getByText(/Honest note:/i)).toBeInTheDocument();
    });

    // Close dialog
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    await user.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Engine Planning Assumptions/i)).not.toBeInTheDocument();
    });
  });
});
