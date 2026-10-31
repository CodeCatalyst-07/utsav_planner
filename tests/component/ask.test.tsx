import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AskPage from '@/app/plan/ask/page';
import { PlanProvider } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Ask Component (src/app/plan/ask/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  const renderAsk = () =>
    render(
      <PlanProvider
        initialData={{
          realProfile: weddingPuneFixture,
          realOverrides: {},
          isHydrated: true,
        }}
      >
        <AskPage />
      </PlanProvider>
    );

  it('renders welcome message and sticky composer with character counter', () => {
    renderAsk();

    expect(screen.getByRole('heading', { level: 1, name: /Ask.*Assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(
      screen.getByText(/Namaste! I am your celebration planning assistant/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about rituals/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 500/i)).toBeInTheDocument();
  });

  it('sends user message and displays conversational assistant response', async () => {
    const user = userEvent.setup();
    renderAsk();

    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            reply:
              'For a Marathi wedding, consider booking a Shehnai group and traditional catering.',
            meta: { provider: 'jarvis' },
          }),
      } as unknown as Response)
    );

    const textarea = screen.getByPlaceholderText(/Ask about rituals/i);
    await user.type(textarea, 'What entertainment is typical?');

    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('What entertainment is typical?')).toBeInTheDocument();
      expect(
        screen.getByText(/For a Marathi wedding, consider booking a Shehnai group/i)
      ).toBeInTheDocument();
    });
  });

  it('displays proposed plan adjustment and applies it on user confirmation', async () => {
    const user = userEvent.setup();
    renderAsk();

    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            reply: 'I can adjust your guest count to 150. Here is the estimated budget impact:',
            patch: { guestCount: 150 },
            diff: {
              summaryFacts: ['Guest count decreased from 300 to 150', 'Catering estimate reduced'],
              totalDelta: 0,
              cateringEstimateDelta: -300000,
              milestonesShifted: [],
            },
            meta: { provider: 'jarvis' },
          }),
      } as unknown as Response)
    );

    const textarea = screen.getByPlaceholderText(/Ask about rituals/i);
    await user.type(textarea, 'What if we cut the guest list to 150?');

    const sendBtn = screen.getByRole('button', { name: /Send message/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText('Proposed Plan Adjustment')).toBeInTheDocument();
      expect(screen.getByText(/Guest count decreased from 300 to 150/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Apply change/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /No thanks/i })).toBeInTheDocument();
    });

    // Click Apply change
    const applyBtn = screen.getByRole('button', { name: /Apply change/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Plan updated successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/See budget breakdown/i)).toBeInTheDocument();
    });
  });
});
