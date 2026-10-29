import { EventProfile } from '../schemas/profile';

export const FROZEN_TODAY = '2026-10-29';

/**
 * Fixture 1: Wedding in Pune
 * Tier 1, Mid tier, 300 guests, 3 functions, ₹25,00,000 budget, Event date: 2027-02-14.
 */
export const weddingPuneFixture: EventProfile = {
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

/**
 * Fixture 2: Kids 5th Birthday in Indore
 * Tier 2, Mid tier, 40 guests, ₹60,000 budget, Event date: 2026-12-15.
 */
export const birthdayKidsIndoreFixture: EventProfile = {
  eventType: 'birthday_kids',
  eventDate: '2026-12-15',
  cityTier: 'tier2',
  cityName: 'Indore',
  guestCount: 40,
  totalBudgetInr: 60_000,
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

/**
 * Fixture 3: Community Ganesh Chaturthi in Mumbai
 * Tier 1, Budget tier, 500 guests, ₹4,00,000 budget, Event date: 2027-09-14.
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
