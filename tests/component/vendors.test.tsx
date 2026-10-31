import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VendorsPage from '@/app/plan/vendors/page';
import { PlanProvider } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Vendors Component (src/app/plan/vendors/page.tsx)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const renderVendors = (bookedVendors: string[] = []) =>
    render(
      <PlanProvider
        initialData={{
          realProfile: weddingPuneFixture,
          realOverrides: {},
          realBookedVendors: bookedVendors,
          isHydrated: true,
        }}
      >
        <VendorsPage />
      </PlanProvider>
    );

  it('renders priority-grouped checklists and booking progress', () => {
    renderVendors();

    expect(
      screen.getByRole('heading', { level: 1, name: /Vendor Checklist/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/0 of/i)).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 2, name: /High Priority Deliverables/i })
    ).toBeInTheDocument();
  });

  it('toggles vendor booking checkbox and updates progress', async () => {
    const user = userEvent.setup();
    renderVendors();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);

    // Click first vendor checkbox
    await user.click(checkboxes[0]!);

    await waitFor(() => {
      expect(screen.getByText(/1 of/i)).toBeInTheDocument();
    });
  });

  it('expands example listings and displays sample disclaimer', async () => {
    const user = userEvent.setup();
    renderVendors();

    // Mock fetch for /api/vendors
    vi.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            source: 'sample',
            vendors: [
              {
                id: 'sample_vendor_1',
                name: 'Royal Palace Lawns',
                area: 'Baner',
                mapsUrl: 'https://maps.google.com/?q=Royal+Palace+Lawns',
                badge: 'sample',
                note: 'Sample listing, not a real business. Use the Google Maps link to find real vendors.',
              },
            ],
            mapsUrl: 'https://maps.google.com',
          }),
      } as unknown as Response)
    );

    const expandButtons = screen.getAllByRole('button', { name: /Show listings/i });
    expect(expandButtons.length).toBeGreaterThan(0);

    await user.click(expandButtons[0]!);

    await waitFor(() => {
      expect(screen.getByText(/Sample listings disclaimer:/i)).toBeInTheDocument();
      expect(screen.getByText('Royal Palace Lawns')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Sample listing, not a real business. Use the Google Maps link to find real vendors.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/Rating:/i)).not.toBeInTheDocument();
    });
  });
});
