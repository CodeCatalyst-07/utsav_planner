import { BudgetSplitCategory } from '../types';
import { EventType } from '@/domain/schemas/profile';

export const budgetSplits: Record<EventType, BudgetSplitCategory[]> = {
  wedding: [
    { id: 'venue', label: 'Venue & Accommodation', weight: 22, source: 'assumption' },
    { id: 'catering', label: 'Catering & Beverages', weight: 25, source: 'assumption' },
    { id: 'decor', label: 'Decor, Mandap & Florals', weight: 10, source: 'assumption' },
    { id: 'photo_video', label: 'Photography & Videography', weight: 7, source: 'assumption' },
    {
      id: 'attire_jewellery',
      label: 'Attire, Jewellery & Styling',
      weight: 18,
      source: 'assumption',
    },
    { id: 'entertainment', label: 'Music, DJ & Entertainment', weight: 4, source: 'assumption' },
    {
      id: 'stationery_gifts',
      label: 'Invitations & Return Gifts',
      weight: 3,
      source: 'assumption',
    },
    {
      id: 'rituals_misc',
      label: 'Pandit, Pooja Samagri & Logistics',
      weight: 3,
      source: 'assumption',
    },
    {
      id: 'contingency',
      label: 'Contingency & Emergency Reserve',
      weight: 8,
      source: 'assumption',
    },
  ],
  birthday_kids: [
    { id: 'venue', label: 'Party Venue / Play Area', weight: 25, source: 'assumption' },
    { id: 'catering', label: 'Catering & Snacks', weight: 30, source: 'assumption' },
    { id: 'decor', label: 'Themed Decor & Balloons', weight: 15, source: 'assumption' },
    { id: 'photo_video', label: 'Photography', weight: 4, source: 'assumption' },
    { id: 'entertainment', label: 'Entertainer, Games & Host', weight: 12, source: 'assumption' },
    {
      id: 'stationery_gifts',
      label: 'Cake, Favors & Invitations',
      weight: 9,
      source: 'assumption',
    },
    { id: 'contingency', label: 'Contingency Reserve', weight: 5, source: 'assumption' },
  ],
  birthday_adult: [
    { id: 'venue', label: 'Venue / Banquet Hall', weight: 30, source: 'assumption' },
    { id: 'catering', label: 'Dinner & Bar', weight: 35, source: 'assumption' },
    { id: 'decor', label: 'Ambient Lighting & Decor', weight: 8, source: 'assumption' },
    { id: 'photo_video', label: 'Photography', weight: 4, source: 'assumption' },
    { id: 'entertainment', label: 'DJ, Music & Sound', weight: 12, source: 'assumption' },
    { id: 'stationery_gifts', label: 'Invitations & Keepsakes', weight: 1, source: 'assumption' },
    { id: 'cake_gifts', label: 'Custom Cake & Surprises', weight: 5, source: 'assumption' },
    { id: 'contingency', label: 'Contingency Reserve', weight: 5, source: 'assumption' },
  ],
  community_festival: [
    {
      id: 'catering',
      label: 'Prasad, Community Kitchen & Water',
      weight: 20,
      source: 'assumption',
    },
    { id: 'decor', label: 'Pandal, Stage & Lighting', weight: 25, source: 'assumption' },
    {
      id: 'entertainment',
      label: 'Sound System & Cultural Programs',
      weight: 12,
      source: 'assumption',
    },
    {
      id: 'stationery_gifts',
      label: 'Printing, Banners & Publicity',
      weight: 4,
      source: 'assumption',
    },
    {
      id: 'rituals_misc',
      label: 'Idol, Pandit, Pooja & Samagri',
      weight: 18,
      source: 'assumption',
    },
    {
      id: 'permissions_security',
      label: 'Permits, Safety & Barricades',
      weight: 8,
      source: 'assumption',
    },
    {
      id: 'cleanup_logistics',
      label: 'Immersion & Waste Cleanup',
      weight: 7,
      source: 'assumption',
    },
    { id: 'contingency', label: 'Emergency Reserve', weight: 6, source: 'assumption' },
  ],
};
