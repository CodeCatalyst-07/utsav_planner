import { EventType, CityTier, BudgetTier, VenueType } from '@/domain/schemas/profile';

export interface WizardFormData {
  eventType: EventType;
  birthdayKind: 'kids' | 'adult';
  eventDate: string;
  cityName: string;
  cityTier: CityTier;
  guestCount: number;
  totalBudgetInr: number;
  budgetTier: BudgetTier;
  venueType: VenueType;
  functionsCount: number;
  dietary: {
    veg: number;
    nonVeg: number;
    jain: number;
    vegan: number;
  };
  toggles: {
    venueIncluded: boolean;
    includeAttireJewellery: boolean;
  };
  notes: string;
}

export const DEFAULT_WIZARD_DATA: WizardFormData = {
  eventType: 'wedding',
  birthdayKind: 'adult',
  eventDate: '',
  cityName: '',
  cityTier: 'tier1',
  guestCount: 200,
  totalBudgetInr: 2500000,
  budgetTier: 'mid',
  venueType: 'lawn',
  functionsCount: 2,
  dietary: {
    veg: 160,
    nonVeg: 30,
    jain: 10,
    vegan: 0,
  },
  toggles: {
    venueIncluded: false,
    includeAttireJewellery: true,
  },
  notes: '',
};

export const STEP_TITLES = [
  'Event Type',
  'Date & City',
  'Guests & Budget',
  'Event Details',
  'Review & Confirm',
];
