import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { PlanProvider, usePlan, STORAGE_KEY, LEGACY_STORAGE_KEY_V1 } from '@/context/plan-context';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('LocalStorage Persistence & Hydration (src/context/plan-context.tsx)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlanProvider>{children}</PlanProvider>
  );

  it('hydrates valid v2 stored plan from localStorage on mount with progress arrays', async () => {
    const validStoredV2 = {
      version: 2,
      profile: weddingPuneFixture,
      overrides: { decor: 300000 },
      completedMilestones: ['m1', 'm2'],
      bookedVendors: ['v1'],
      savedAt: '2026-10-30T10:00:00Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validStoredV2));

    const { result } = renderHook(() => usePlan(), { wrapper });

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.profile?.cityName).toBe('Pune');
    expect(result.current.overrides['decor']).toBe(300000);
    expect(result.current.completedMilestones).toEqual(['m1', 'm2']);
    expect(result.current.bookedVendors).toEqual(['v1']);
  });

  it('migrates legacy v1 stored data to v2 seamlessly on hydration', async () => {
    const legacyV1 = {
      version: 1,
      profile: weddingPuneFixture,
      overrides: { catering: 1000000 },
      savedAt: '2026-10-29T10:00:00Z',
    };
    localStorage.setItem(LEGACY_STORAGE_KEY_V1, JSON.stringify(legacyV1));

    const { result } = renderHook(() => usePlan(), { wrapper });

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.profile?.cityName).toBe('Pune');
    expect(result.current.completedMilestones).toEqual([]);
    expect(result.current.bookedVendors).toEqual([]);

    // Check localStorage migration: v2 is written, legacy v1 is removed
    const storedV2 = localStorage.getItem(STORAGE_KEY);
    expect(storedV2).not.toBeNull();
    const parsedV2 = JSON.parse(storedV2!);
    expect(parsedV2.version).toBe(2);
    expect(parsedV2.completedMilestones).toEqual([]);
    expect(parsedV2.bookedVendors).toEqual([]);
    expect(localStorage.getItem(LEGACY_STORAGE_KEY_V1)).toBeNull();
  });

  it('safely discards corrupt non-JSON localStorage data without crashing', async () => {
    localStorage.setItem(STORAGE_KEY, '{corrupted_json:::');

    const { result } = renderHook(() => usePlan(), { wrapper });

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('safely discards stored data that fails schema validation', async () => {
    const invalidSchema = {
      version: 2,
      profile: {
        ...weddingPuneFixture,
        guestCount: -500, // Invalid!
      },
      overrides: {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalidSchema));

    const { result } = renderHook(() => usePlan(), { wrapper });

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('safely discards stored data with unrecognized schema version', async () => {
    const wrongVersion = {
      version: 99,
      profile: weddingPuneFixture,
      overrides: {},
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wrongVersion));

    const { result } = renderHook(() => usePlan(), { wrapper });

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('persists real profile changes and progress toggles to v2 localStorage', async () => {
    const { result } = renderHook(() => usePlan(), { wrapper });

    act(() => {
      result.current.setProfile({ ...weddingPuneFixture, cityName: 'Goa' });
    });

    act(() => {
      result.current.toggleMilestone('m_venue');
      result.current.toggleVendor('v_catering');
    });

    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(2);
    expect(parsed.profile.cityName).toBe('Goa');
    expect(parsed.completedMilestones).toEqual(['m_venue']);
    expect(parsed.bookedVendors).toEqual(['v_catering']);
  });

  it('never persists sample mode plan over an existing real plan in localStorage', async () => {
    // 1. Establish real saved plan
    const realStored = {
      version: 2,
      profile: { ...weddingPuneFixture, cityName: 'Hyderabad' },
      overrides: { venue: 900000 },
      completedMilestones: ['m_real'],
      bookedVendors: ['v_real'],
      savedAt: '2026-10-29T10:00:00Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(realStored));

    const { result } = renderHook(() => usePlan(), { wrapper });
    expect(result.current.profile?.cityName).toBe('Hyderabad');

    // 2. Load sample plan and toggle in sample mode
    act(() => {
      result.current.loadSample('wedding');
    });

    expect(result.current.isSampleMode).toBe(true);

    act(() => {
      result.current.toggleMilestone('m_sample');
    });

    // 3. Inspect localStorage - MUST STILL BE Hyderabad, NOT the sample
    const storedAfterSample = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(storedAfterSample.profile.cityName).toBe('Hyderabad');
    expect(storedAfterSample.overrides.venue).toBe(900000);
    expect(storedAfterSample.completedMilestones).toEqual(['m_real']);

    // 4. Exit sample mode
    act(() => {
      result.current.exitSample();
    });

    expect(result.current.isSampleMode).toBe(false);
    expect(result.current.profile?.cityName).toBe('Hyderabad');
    expect(result.current.completedMilestones).toEqual(['m_real']);
  });

  it('clears localStorage on reset()', async () => {
    const { result } = renderHook(() => usePlan(), { wrapper });

    act(() => {
      result.current.setProfile(weddingPuneFixture);
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
