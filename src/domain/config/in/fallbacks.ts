import { EventType } from '../../schemas/profile';

export interface ThemeIdea {
  title: string;
  description: string;
}

export interface CategoryTip {
  categoryId: string;
  tip: string;
}

export interface MenuCourse {
  course: string;
  items: string[];
}

export interface EventFallbackData {
  ideas: {
    themes: [ThemeIdea, ThemeIdea, ThemeIdea];
  };
  tips: CategoryTip[];
  menu: {
    suggestions: MenuCourse[];
  };
}

export const fallbackDataByEventType: Record<EventType, EventFallbackData> = {
  wedding: {
    ideas: {
      themes: [
        {
          title: 'Royal Heritage Elegance',
          description:
            'A regal celebration honoring regional traditions with warm marigold accents, classical instrumental music, brass lanterns, and heritage textiles.',
        },
        {
          title: 'Botanical Courtyard Romance',
          description:
            'Lush natural foliage, pastel floral canopies, fairy lights, and open-air mandap setups highlighting understated contemporary charm.',
        },
        {
          title: 'Festive Vibrant Mela',
          description:
            'Energetic colorful drape installations, artisanal folk craft stalls, interactive live counters, and high-energy music celebration.',
        },
      ],
    },
    tips: [
      {
        categoryId: 'venue',
        tip: 'Confirm curfew hours, generator backup, and parking logistics before signing the venue agreement.',
      },
      {
        categoryId: 'catering',
        tip: 'Schedule tasting sessions with your head caterer and finalize separate counters for dietary preferences.',
      },
      {
        categoryId: 'decor',
        tip: 'Repurpose ceremony flowers and mandap lighting for the evening reception stage to optimize floral spend.',
      },
      {
        categoryId: 'photo_video',
        tip: 'Provide photographers with a shot list of key family elders and ritual moments well ahead of the event.',
      },
      {
        categoryId: 'attire_jewellery',
        tip: 'Schedule trials at least three weeks before functions to allow seamless tailoring and comfortable footwear pairing.',
      },
      {
        categoryId: 'entertainment',
        tip: 'Verify sound license guidelines and local decibel rules with your DJ and venue coordinator.',
      },
      {
        categoryId: 'stationery_gifts',
        tip: 'Choose sustainable cloth bags or artisanal dry-fruit hampers for memorable and eco-friendly return gifts.',
      },
      {
        categoryId: 'rituals_misc',
        tip: 'Review the pooja samagri checklist with your family priest a week in advance to avoid last-minute rush.',
      },
      {
        categoryId: 'contingency',
        tip: 'Keep your contingency fund untouched for unforeseen vendor overtime, extra guest plates, or emergency travel.',
      },
    ],
    menu: {
      suggestions: [
        {
          course: 'Welcome Beverages & Coolers',
          items: ['Spiced Kokum Sherbet', 'Kesar Pista Thandai', 'Fresh Mint Lime Fizz'],
        },
        {
          course: 'Starters & Live Chaat',
          items: [
            'Paneer Tikka Angare',
            'Kurkuri Bhindi Chaat',
            'Hara Bhara Kebab',
            'Amritsari Fish Bites',
          ],
        },
        {
          course: 'Main Course Specialties',
          items: [
            'Dal Makhani Slow Cooked',
            'Paneer Lababdar',
            'Subz Biryani with Burani Raita',
            'Butter Naan & Roti Basket',
          ],
        },
        {
          course: 'Desserts & Sweet Celebrations',
          items: ['Warm Gulab Jamun with Rabdi', 'Angoori Rasmalai', 'Seasonal Kulfi Counter'],
        },
      ],
    },
  },

  birthday_kids: {
    ideas: {
      themes: [
        {
          title: 'Jungle Safari Adventure',
          description:
            'Vibrant green and earth tones with animal face masks, balloon trees, scavenger hunt games, and themed photo ops.',
        },
        {
          title: 'Space Explorer Odyssey',
          description:
            'Glow-in-the-dark stars, silver balloon rockets, cosmic trivia games, and astronaut badge craft tables.',
        },
        {
          title: 'Carnival Wonderland',
          description:
            'Classic striped canopy decor, magic show host, ring toss games, popcorn stalls, and lively carnival music.',
        },
      ],
    },
    tips: [
      {
        categoryId: 'venue',
        tip: 'Ensure play zones have child-safe flooring and dedicated seating for supervising parents.',
      },
      {
        categoryId: 'catering',
        tip: 'Focus on bite-sized finger foods, natural fruit coolers, and nut-allergy safe treats for kids.',
      },
      {
        categoryId: 'decor',
        tip: 'Use air-filled balloon garlands and sturdy foam board cutouts placed away from main running aisles.',
      },
      {
        categoryId: 'photo_video',
        tip: 'Capture candid joy shots during cake cutting and group party games while children are fully engaged.',
      },
      {
        categoryId: 'entertainment',
        tip: 'Hire an energetic host who coordinates age-appropriate musical statues, treasure hunts, and magic tricks.',
      },
      {
        categoryId: 'stationery_gifts',
        tip: 'Assemble educational craft kits, storybooks, or wooden puzzles as durable return favors.',
      },
      {
        categoryId: 'contingency',
        tip: 'Maintain a small cash buffer for extra snack plates, emergency wet wipes, and first-aid supplies.',
      },
    ],
    menu: {
      suggestions: [
        {
          course: 'Welcome Sips',
          items: ['Mango Lassi Pops', 'Fresh Strawberry Lemonade', 'Warm Chocolate Milk'],
        },
        {
          course: 'Finger Bites & Sliders',
          items: [
            'Mini Veg Cheese Sliders',
            'Corn & Cheese Balls',
            'Crispy Potato Wedges',
            'Paneer Finger Skewers',
          ],
        },
        {
          course: 'Party Mains',
          items: ['Baked Macaroni Cheese', 'Pav Bhaji with Butter Pav', 'Mild Veg Hakka Noodles'],
        },
        {
          course: 'Sweet Treats & Cake',
          items: ['Themed Birthday Cake', 'Vanilla Cupcakes', 'Fruit Cream Cups'],
        },
      ],
    },
  },

  birthday_adult: {
    ideas: {
      themes: [
        {
          title: 'Retro Bollywood Glamour',
          description:
            'Nostalgic golden-era vinyl record decor, iconic dialogue photo props, curated retro playlist, and vintage cocktails.',
        },
        {
          title: 'Rustic Terrace Sunset Lounge',
          description:
            'Warm bistro fairy lighting, acoustic live performance, cozy floor lounge cushions, and intimate conversational seating.',
        },
        {
          title: 'Contemporary Neon Soirée',
          description:
            'Sleek modern aesthetics with subtle neon art accents, dynamic LED ambient lounge lighting, and upbeat deep-house beats.',
        },
      ],
    },
    tips: [
      {
        categoryId: 'venue',
        tip: 'Check terrace sound curfew restrictions and ensure comfortable indoor weather backup arrangements.',
      },
      {
        categoryId: 'catering',
        tip: 'Pair interactive live grill stations and tapas counters with refreshing mocktail concoctions.',
      },
      {
        categoryId: 'decor',
        tip: 'Focus accent lighting on the bar and dining lounge zones for maximum evening ambiance.',
      },
      {
        categoryId: 'photo_video',
        tip: 'Create a stylized photobooth corner with warm amber lighting for memorable group portraits.',
      },
      {
        categoryId: 'entertainment',
        tip: 'Book an acoustic soloist or saxophonist for sunset followed by an upbeat DJ set later in the evening.',
      },
      {
        categoryId: 'contingency',
        tip: 'Reserve contingency funds for extended venue hours or extra beverage supplies if the party runs late.',
      },
    ],
    menu: {
      suggestions: [
        {
          course: 'Artisanal Starters',
          items: [
            'Truffle Mushroom Bruschetta',
            'Tandoori Soya Chaap',
            'Murgh Malai Tikka',
            'Crispy Lotus Stem Honey Chilli',
          ],
        },
        {
          course: 'Lounge Mains',
          items: [
            'Paneer Makhani Pot',
            'Dal Bukhara with Chur Chur Naan',
            'Dum Gosht Biryani',
            'Kashmiri Pulao with Raita',
          ],
        },
        {
          course: 'Artisan Desserts',
          items: ['Moong Dal Halwa Tart', 'Dark Chocolate Mousse Cups', 'Paan Ice Cream'],
        },
      ],
    },
  },

  community_festival: {
    ideas: {
      themes: [
        {
          title: 'Eco-Friendly Heritage Utsav',
          description:
            'Biodegradable clay idols, natural terracotta lamps, marigold and mango leaf torans, and traditional cultural recitals.',
        },
        {
          title: 'Community Harmony Celebration',
          description:
            'Inclusive cultural performances, vibrant handloom fabric pandal drapes, rangoli competitions, and community feast mahaprasad.',
        },
        {
          title: 'Artisanal Folk Traditions',
          description:
            'Spotlighting local regional craftsmen with live dhol-tasha drumming, terracotta displays, and devotional bhajan evenings.',
        },
      ],
    },
    tips: [
      {
        categoryId: 'venue',
        tip: 'Secure local civic authority, police, and fire safety clearances well in advance of pandal erection.',
      },
      {
        categoryId: 'catering',
        tip: 'Organize high-capacity batch cooking and sheltered seated dining queues for seamless mahaprasad distribution.',
      },
      {
        categoryId: 'decor',
        tip: 'Use eco-friendly cloth draping, recycled wood framing, and low-power LED serial lighting.',
      },
      {
        categoryId: 'photo_video',
        tip: 'Assign volunteers to record daily maha-aarti and cultural performances for community archive streaming.',
      },
      {
        categoryId: 'entertainment',
        tip: 'Schedule sound permits and loudspeaker operation strictly in compliance with municipal noise bylaws.',
      },
      {
        categoryId: 'rituals_misc',
        tip: 'Coordinate with community priests on exact aarti samagri, havan timings, and idol immersion logistics.',
      },
      {
        categoryId: 'contingency',
        tip: 'Keep emergency first-aid kits, fire extinguishers, and standby power backup easily accessible.',
      },
    ],
    menu: {
      suggestions: [
        {
          course: 'Mahaprasad & Savory Offerings',
          items: [
            'Masale Bhaat with Ghee',
            'Traditional Puri & Batata Bhaji',
            'Varan Bhaat with Limbu',
          ],
        },
        {
          course: 'Pooja Sweets & Bhog',
          items: [
            'Ukadiche Modak (Steamed Coconut Jaggery)',
            'Puran Poli with Ghee',
            'Sheera / Sooji Halwa',
          ],
        },
        {
          course: 'Cooling Refreshments',
          items: ['Chilled Mattha (Spiced Buttermilk)', 'Aam Panna', 'Fresh Coconut Water'],
        },
      ],
    },
  },
};
