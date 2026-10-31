import 'server-only';
import { EventProfile } from '@/domain/schemas/profile';
import { PlanDiff } from '@/domain/rules/replan';
import { fallbackDataByEventType } from '@/domain/config/in/fallbacks';
import { parseIntent } from '@/domain/intents/parseIntent';
import {
  IdeasSection,
  CategoryTipsSection,
  MenuSection,
  NarrateDiffSection,
  ChatIntentSection,
} from './sections';

export class DeterministicFallback {
  static getIdeas(profile: EventProfile): IdeasSection {
    const data = fallbackDataByEventType[profile.eventType] || fallbackDataByEventType.wedding;
    return {
      themes: [
        { ...data.ideas.themes[0] },
        { ...data.ideas.themes[1] },
        { ...data.ideas.themes[2] },
      ],
    };
  }

  static getCategoryTips(
    profile: EventProfile,
    allowedCategoryIds: string[] = []
  ): CategoryTipsSection {
    const data = fallbackDataByEventType[profile.eventType] || fallbackDataByEventType.wedding;
    const allowedSet = new Set(allowedCategoryIds);
    const matchingTips = data.tips.filter((t) => allowedSet.has(t.categoryId));

    if (matchingTips.length > 0) {
      return { tips: matchingTips.slice(0, 5) };
    }

    // Default tip for first allowed category if no match
    const firstCat = allowedCategoryIds[0] || 'venue';
    return {
      tips: [
        {
          categoryId: firstCat,
          tip: 'Review vendor contracts carefully and confirm deliverables with explicit milestone dates.',
        },
      ],
    };
  }

  static getMenu(profile: EventProfile): MenuSection {
    const data = fallbackDataByEventType[profile.eventType] || fallbackDataByEventType.wedding;
    const isPureVeg = profile.dietary.nonVeg === 0;
    const hasJain = profile.dietary.jain > 0;

    const suggestions = data.menu.suggestions.map((c) => ({
      course: c.course,
      items: c.items.map((item) => {
        if (isPureVeg) {
          if (/Dum Gosht Biryani/i.test(item)) return 'Dum Subz Biryani';
          if (/Amritsari Fish Bites/i.test(item)) return 'Dahi Ke Kebab';
          if (/Murgh Malai Tikka/i.test(item)) return 'Paneer Malai Tikka';
          if (/gosht|chicken|mutton|fish|prawn|egg|murgh/i.test(item)) return 'Vegetable Dum Pulao';
        }
        return item;
      }),
    }));

    if (hasJain) {
      suggestions.push({
        course: 'Dedicated Jain Counter',
        items: [
          'Kela Methi Nu Shaak (Raw Banana)',
          'Jain Moong Dal Tadka',
          'Steamed Basmati Rice',
          'Jain Paneer Makhani',
        ],
      });
    }

    return { suggestions };
  }

  static getNarrateDiff(diff: PlanDiff): NarrateDiffSection {
    if (diff.summaryFacts.length === 0) {
      return { narration: 'No structural changes were made to your event plan.' };
    }
    const joined = diff.summaryFacts.slice(0, 3).join('. ');
    const narration = joined.length > 400 ? joined.slice(0, 397) + '...' : joined;
    return { narration };
  }

  static getChatIntent(
    message: string = '',
    profile?: EventProfile,
    today?: string
  ): ChatIntentSection {
    if (!message || !message.trim()) {
      return {
        intent: 'question',
        reply:
          'I am here to help answer questions about your celebration or adjust guest counts, dates, and budgets.',
      };
    }
    const parsed = parseIntent(message, profile, today);
    if (parsed.intent === 'update_plan') {
      return {
        intent: 'update_plan',
        reply: parsed.reply,
        patch: parsed.patch,
      };
    }
    if (parsed.intent === 'question') {
      return {
        intent: 'question',
        reply: parsed.reply,
      };
    }
    return {
      intent: 'unsupported',
      reply: parsed.reply,
    };
  }
}
