import { z } from 'astro/zod';
import { siteConfig, authorRegistry } from '../site.config';

export const contentDate = z.union([z.string(), z.date()]).transform((value, ctx) => {
  const result = new Date(value);
  const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const calendar = typeof value === 'string' ? value.slice(0, 10) : '';
  const calendarDate = new Date(`${calendar}T00:00:00Z`);
  const validCalendar =
    !calendar ||
    (Number.isFinite(calendarDate.getTime()) &&
      calendarDate.toISOString().slice(0, 10) === calendar);
  const isTimestamp =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (
    !validCalendar ||
    !Number.isFinite(result.getTime()) ||
    (typeof value === 'string' && !isDateOnly && !isTimestamp) ||
    (isDateOnly && result.toISOString().slice(0, 10) !== value)
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Use a valid ISO date (YYYY-MM-DD) or timestamp with an explicit timezone.',
    });
    return z.NEVER;
  }
  return result;
});

export const postSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(320),
    slug: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use a stable lowercase ASCII slug separated by hyphens.',
      ),
    pubDate: contentDate,
    updatedDate: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      contentDate.optional(),
    ),
    category: z
      .string()
      .refine(
        (value) => Object.hasOwn(siteConfig.categories, value),
        'Category must match an ID declared in data/categories.json.',
      ),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(40)
          .refine(
            (value) => !/[\\/#?%]/.test(value) && value !== '.' && value !== '..',
            'Tags cannot contain URL separators.',
          ),
      )
      .max(12)
      .default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    lang: z.enum(['zh-CN', 'en']).default('zh-CN'),
    authors: z
      .array(z.string().refine((id) => Object.hasOwn(authorRegistry, id), 'Unknown author'))
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, 'Duplicate author')
      .default([siteConfig.defaultAuthor]),
    cover: z.preprocess(
      (value) =>
        value === null ||
        (value &&
          typeof value === 'object' &&
          Object.values(value).every((v) => v == null || v === ''))
          ? undefined
          : value,
      z
        .object({
          src: z.string().regex(/^(\/(?!\/)|https:\/\/)/),
          alt: z.string().trim().min(1),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          focal: z.preprocess(
            (value) => (value === '' ? undefined : value),
            z
              .string()
              .regex(/^(?:100|\d{1,2})% (?:100|\d{1,2})%$/)
              .default('50% 50%'),
          ),
          caption: z.string().optional(),
          srcset: z.string().optional(),
        })
        .optional(),
    ),
    ogImage: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z
        .string()
        .regex(/^(\/(?!\/)|https:\/\/)/)
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.updatedDate && data.updatedDate < data.pubDate)
      ctx.addIssue({
        code: 'custom',
        path: ['updatedDate'],
        message: 'updatedDate cannot be earlier than pubDate.',
      });
    if (new Set(data.tags).size !== data.tags.length)
      ctx.addIssue({ code: 'custom', path: ['tags'], message: 'Tags must be unique.' });
  });
export type PostData = z.infer<typeof postSchema>;
