import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BudgetPage from '@/app/plan/budget/page';
import { PlanProvider } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('What-If Sandbox Component (src/app/plan/budget/page.tsx)', () => {
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

  it('renders What-If Sandbox with guests, budget, and date inputs', () => {
    renderBudgetWithPlan();

    expect(
      screen.getByRole('heading', { level: 2, name: /What-If Rebalancing Sandbox/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Guest Count/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Total Budget/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Date/i)).toBeInTheDocument();
  });

  it('increasing guests from 200 to 300 generates catering diff chip instantly', async () => {
    const user = userEvent.setup();
    renderBudgetWithPlan();

    const guestsInput = screen.getByLabelText(/Guest Count/i);
    expect(guestsInput).toHaveValue(200);

    // Increase guests to 300
    await user.clear(guestsInput);
    await user.type(guestsInput, '300');

    // Live diff chip should appear locally
    await waitFor(() => {
      expect(screen.getByText(/Catering \+/i)).toBeInTheDocument();
      expect(screen.getByText(/Engine Replan Summary:/i)).toBeInTheDocument();
    });
  });

  it('discard resets inputs back to saved plan without applying', async () => {
    const user = userEvent.setup();
    renderBudgetWithPlan();

    const guestsInput = screen.getByLabelText(/Guest Count/i);
    await user.clear(guestsInput);
    await user.type(guestsInput, '350');

    await waitFor(() => {
      expect(screen.getByText(/Catering \+/i)).toBeInTheDocument();
    });

    const discardBtn = screen.getByRole('button', { name: /Discard/i });
    await user.click(discardBtn);

    // Value should revert to original 200
    await waitFor(() => {
      expect(screen.getByLabelText(/Guest Count/i)).toHaveValue(200);
    });
  });

  it('apply changes commits patch to plan', async () => {
    const user = userEvent.setup();
    renderBudgetWithPlan();

    const budgetInput = screen.getByLabelText(/Total Budget/i);
    await user.clear(budgetInput);
    await user.type(budgetInput, '4500000');

    const applyBtn = screen.getByRole('button', { name: /Apply changes/i });
    await user.click(applyBtn);

    // Total should now reflect the updated 45,00,000 in the table or header
    await waitFor(() => {
      expect(screen.getAllByText(/₹45,00,000/).length).toBeGreaterThan(0);
    });
  });
});
