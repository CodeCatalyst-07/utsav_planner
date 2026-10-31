import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WizardPage from '@/app/plan/new/page';
import { PlanProvider } from '@/context/plan-context';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Wizard Component (src/app/plan/new/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  const renderWizard = () =>
    render(
      <PlanProvider>
        <WizardPage />
      </PlanProvider>
    );

  it('renders Step 1 with heading and event type radio choices', () => {
    renderWizard();

    expect(
      screen.getByRole('heading', { level: 1, name: /What type of celebration are you planning/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Indian Wedding')).toBeInTheDocument();
    expect(screen.getByText('Birthday Celebration')).toBeInTheDocument();
    expect(screen.getByText('Community Festival')).toBeInTheDocument();
  });

  it('navigates from Step 1 to Step 2 and manages focus', async () => {
    renderWizard();

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      const step2Heading = screen.getByRole('heading', {
        level: 1,
        name: /When and where is the celebration/i,
      });
      expect(step2Heading).toBeInTheDocument();
      // Focus should have moved to the new step's h1
      expect(document.activeElement).toBe(step2Heading);
    });
  });

  it('validates Step 2 required fields and displays error summary', async () => {
    renderWizard();

    // Move to step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Clear city name if any and attempt continue
    const cityInput = screen.getByLabelText(/City \/ Location/i);
    fireEvent.change(cityInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Error summary should be displayed
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getAllByText(/City name is required/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('updates dietary counter dynamically in Step 4', async () => {
    renderWizard();

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2: fill valid city and date
    const cityInput = screen.getByLabelText(/City \/ Location/i);
    fireEvent.change(cityInput, { target: { value: 'Mumbai' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3 -> Step 4
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /How many guests/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 4: Verify dietary counter
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Celebration Details & Dietary/i })
      ).toBeInTheDocument();
    });

    // Default guests in wizard is 200; assigned dietary default is 160+30+10 = 200
    expect(screen.getByText(/200 of 200 guests assigned/i)).toBeInTheDocument();

    // Change veg to 100
    const vegInput = screen.getByLabelText(/^Vegetarian$/i);
    fireEvent.change(vegInput, { target: { value: '100' } });

    // Counter updates live to 140 of 200
    expect(screen.getByText(/140 of 200 guests assigned/i)).toBeInTheDocument();
  });

  it('completes the full wizard flow and redirects to /plan', async () => {
    const user = userEvent.setup();
    renderWizard();

    // Step 1 -> Step 2
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 2: fill city
    const cityInput = screen.getByLabelText(/City \/ Location/i);
    await user.type(cityInput, 'Pune');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 3 -> Step 4
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /How many guests/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 4 -> Step 5
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Celebration Details & Dietary/i })
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Step 5: Review
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Review Your Celebration Blueprint/i })
      ).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /Create my plan/i });
    await user.click(createBtn);

    // Expect redirect to /plan
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/plan');
      },
      { timeout: 1000 }
    );
  });
});
