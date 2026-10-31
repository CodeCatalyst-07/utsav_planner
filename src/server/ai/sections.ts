import 'server-only';
import { z } from 'zod';

export const ThemeItemSchema = z.object({
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(240),
});

export const IdeasSectionSchema = z.object({
  themes: z.array(ThemeItemSchema).length(3),
});
export type IdeasSection = z.infer<typeof IdeasSectionSchema>;

export const CategoryTipItemSchema = z.object({
  categoryId: z.string().trim().min(1),
  tip: z.string().trim().min(1).max(200),
});

export const CategoryTipsSectionSchema = z.object({
  tips: z.array(CategoryTipItemSchema).min(1),
});
export type CategoryTipsSection = z.infer<typeof CategoryTipsSectionSchema>;

export const MenuCourseSchema = z.object({
  course: z.string().trim().min(1),
  items: z.array(z.string().trim().min(1)).min(1).max(6),
});

export const MenuSectionSchema = z.object({
  suggestions: z.array(MenuCourseSchema).min(1),
});
export type MenuSection = z.infer<typeof MenuSectionSchema>;

export const NarrateDiffSectionSchema = z.object({
  narration: z.string().trim().min(1).max(400),
});
export type NarrateDiffSection = z.infer<typeof NarrateDiffSectionSchema>;

export const ChatIntentSectionSchema = z.object({
  intent: z.enum(['update_plan', 'question', 'unsupported']),
  patch: z.record(z.string(), z.unknown()).optional(),
  reply: z.string().trim().min(1).max(300),
});
export type ChatIntentSection = z.infer<typeof ChatIntentSectionSchema>;

export type SectionType = 'ideas' | 'category_tips' | 'menu' | 'narrate_diff';

export const sectionSchemas = {
  ideas: IdeasSectionSchema,
  category_tips: CategoryTipsSectionSchema,
  menu: MenuSectionSchema,
  narrate_diff: NarrateDiffSectionSchema,
  chat_intent: ChatIntentSectionSchema,
} as const;
