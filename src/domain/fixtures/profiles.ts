import { EventProfile } from '../schemas/profile';
import { addDays } from '../dates';

export const FROZEN_TODAY = '2026-10-29';

export type SampleProfileKind = 'wedding' | 'birthday_kids' | 'community_festival';

/**
 * Builds a valid sample profile relative to a provided reference date `today`.
 * Relative offsets guarantee standard mode execution:
 * - wedding: today + 360 days (minLead = 180)
 * - birthday_kids: today + 45 days (minLead = 28)
 * - community_festival: today + 120 days (minLead = 70)
 */
export function buildSampleProfile(kind: SampleProfileKind, today: string): EventProfile {
  switch (kind) {
    case 'wedding':
      return {
        eventType: 'wedding',
        eventDate: addDays(today, 360),
        cityTier: 'tier1',
        cityName: 'Pune',
        guestCount: 200,
        totalBudgetInr: 4_000_000,
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
        overrides: {},
        notes: 'Traditional Marathi wedding with Sangeet and reception dinner in Pune.',
      };
    case 'birthday_kids':
      return {
        eventType: 'birthday_kids',
        eventDate: addDays(today, 45),
        cityTier: 'tier2',
        cityName: 'Indore',
        guestCount: 40,
        totalBudgetInr: 100_000,
        budgetTier: 'mid',
        venueType: 'home',
        functionsCount: 1,
        dietary: {
          veg: 35,
          nonVeg: 0,
          jain: 5,
          vegan: 0,
        },
        toggles: {
          venueIncluded: true,
          includeAttireJewellery: false,
        },
        overrides: {},
        notes: 'Superhero theme party for 5-year-old in society club house.',
      };
    case 'community_festival':
      return {
        eventType: 'community_festival',
        eventDate: addDays(today, 120),
        cityTier: 'tier1',
        cityName: 'Mumbai',
        guestCount: 500,
        totalBudgetInr: 400_000,
        budgetTier: 'budget',
        venueType: 'community_hall',
        functionsCount: 1,
        dietary: {
          veg: 450,
          nonVeg: 0,
          jain: 50,
          vegan: 0,
        },
        toggles: {
          venueIncluded: false,
          includeAttireJewellery: false,
        },
        overrides: {},
        notes: 'Eco-friendly clay idol Ganeshotsav with daily evening aarti and mahaprasad.',
      };
  }
}

/**
 * Fixture 1 (Stressed Case): Wedding in Pune (Over-budget catering demo)
 * Tier 1, Mid tier, 300 guests, 3 functions, ₹25,00,000 budget, Event date: 2027-02-14.
 * Catering allocation ₹6,25,000 vs Mid estimate ₹14,04,150 -> status: over.
 */
export const weddingStressedFixture: EventProfile = {
  eventType: 'wedding',
  eventDate: '2027-02-14',
  cityTier: 'tier1',
  cityName: 'Pune',
  guestCount: 300,
  totalBudgetInr: 2_500_000,
  budgetTier: 'mid',
  venueType: 'lawn',
  functionsCount: 3,
  dietary: {
    veg: 240,
    nonVeg: 50,
    jain: 10,
    vegan: 0,
  },
  toggles: {
    venueIncluded: false,
    includeAttireJewellery: true,
  },
  overrides: {},
  notes: 'Traditional Marathi wedding with Sangeet, Mehendi, and reception dinner.',
};
export const weddingStressed = weddingStressedFixture;

/**
 * Fixture 1b (Default Sample): Wedding in Pune (Coherent initial plan)
 * Tier 1, Mid tier, 200 guests, 2 functions, ₹40,00,000 budget, Event date: 2027-02-14.
 * Catering allocation ₹10,00,000 vs High estimate ₹9,20,000 -> status: ok.
 */
export const weddingPuneFixture: EventProfile = {
  eventType: 'wedding',
  eventDate: '2027-02-14',
  cityTier: 'tier1',
  cityName: 'Pune',
  guestCount: 200,
  totalBudgetInr: 4_000_000,
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
  overrides: {},
  notes: 'Traditional Marathi wedding with Sangeet and reception dinner in Pune.',
};
export const weddingDefault = weddingPuneFixture;
export const weddingDefaultFixture = weddingPuneFixture;

/**
 * Fixture 2: Kids 5th Birthday in Indore (Coherent initial plan)
 * Tier 2, Mid tier, 40 guests, ₹1,00,000 budget, Event date: 2026-12-15.
 * Home venue included, catering allocation ₹40,000 vs High estimate ₹36,000 -> status: ok.
 */
export const birthdayKidsIndoreFixture: EventProfile = {
  eventType: 'birthday_kids',
  eventDate: '2026-12-15',
  cityTier: 'tier2',
  cityName: 'Indore',
  guestCount: 40,
  totalBudgetInr: 100_000,
  budgetTier: 'mid',
  venueType: 'home',
  functionsCount: 1,
  dietary: {
    veg: 35,
    nonVeg: 0,
    jain: 5,
    vegan: 0,
  },
  toggles: {
    venueIncluded: true,
    includeAttireJewellery: false,
  },
  overrides: {},
  notes: 'Superhero theme party for 5-year-old in society club house.',
};
export const birthdayKidsDefault = birthdayKidsIndoreFixture;

/**
 * Fixture 3: Community Ganesh Chaturthi in Mumbai (Coherent initial plan)
 * Tier 1, Budget tier, 500 guests, ₹4,00,000 budget, Event date: 2027-09-14.
 * Fixed catering band ₹50-150/head, allocation ₹80,000 vs High estimate ₹75,000 -> status: ok.
 */
export const communityGaneshMumbaiFixture: EventProfile = {
  eventType: 'community_festival',
  eventDate: '2027-09-14',
  cityTier: 'tier1',
  cityName: 'Mumbai',
  guestCount: 500,
  totalBudgetInr: 400_000,
  budgetTier: 'budget',
  venueType: 'community_hall',
  functionsCount: 1,
  dietary: {
    veg: 450,
    nonVeg: 0,
    jain: 50,
    vegan: 0,
  },
  toggles: {
    venueIncluded: false,
    includeAttireJewellery: false,
  },
  overrides: {},
  notes: 'Eco-friendly clay idol Ganeshotsav with daily evening aarti and mahaprasad.',
};
export const communityDefault = communityGaneshMumbaiFixture;
