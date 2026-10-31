import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimelinePage from '@/app/plan/timeline/page';
import { PlanProvider } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Timeline Component (src/app/plan/timeline/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderTimeline = (completedMilestones: string[] = []) =>
    render(
      <PlanProvider
        initialData={{
          realProfile: weddingPuneFixture,
          realOverrides: {},
          realCompletedMilestones: completedMilestones,
          isHydrated: true,
        }}
      >
        <TimelinePage />
      </PlanProvider>
    );

  it('renders vertical timeline, progress bar, and filters', () => {
    renderTimeline();

    expect(
      screen.getByRole('heading', { level: 1, name: /Celebration Timeline/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^All/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^To do/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Done/i })).toBeInTheDocument();
  });

  it('supports toggling milestone completion and filters', async () => {
    const user = userEvent.setup();
    renderTimeline();

    // Checkboxes should exist for each milestone
    const milestoneCheckboxes = screen.getAllByRole('checkbox', { name: /^Mark done/i });
    expect(milestoneCheckboxes.length).toBeGreaterThan(0);

    // Initial progress should be 0 completed
    expect(screen.getByText(/0 of/i)).toBeInTheDocument();

    // Click the first milestone checkbox
    await user.click(milestoneCheckboxes[0]!);

    // Progress text should update to 1 of N completed
    await waitFor(() => {
      expect(screen.getByText(/1 of/i)).toBeInTheDocument();
    });

    // Filter by "Done"
    const doneFilter = screen.getByRole('radio', { name: /^Done/i });
    await user.click(doneFilter);

    // Filter by "To do"
    const todoFilter = screen.getByRole('radio', { name: /^To do/i });
    await user.click(todoFilter);
  });

  it('provides calendar download and Google Calendar links', () => {
    renderTimeline();

    expect(screen.getByRole('button', { name: /Download .ics \(all\)/i })).toBeInTheDocument();
    const gcalLinks = screen.getAllByRole('link', { name: /Google Calendar/i });
    expect(gcalLinks.length).toBeGreaterThan(0);
    expect(gcalLinks[0]).toHaveAttribute('href', expect.stringContaining('calendar.google.com'));
  });
});
