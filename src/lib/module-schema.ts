import { z } from 'astro/zod';
import { contentDate } from './post-schema';
import { licensePresets } from './licenses';
import { authorRegistry, photoTagRegistry } from '../site.config';
export const imageSchema = z.object({
  src: z.string().regex(/^(\/(?!\/)|https:\/\/)/),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().optional(),
  srcset: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
});
export const moduleSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  date: contentDate,
  draft: z.boolean().default(false),
  images: z.array(imageSchema).default([]),
  status: z.enum(['planned', 'active', 'done']).default('planned'),
});

const slugId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens.');
const text = z.string().trim().min(1).optional();
// Editors leave optional fields blank; treat '' and null as "not set" everywhere below.
const blankless = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    );
  }, schema);
const knownTag = z.string().refine((tag) => Object.hasOwn(photoTagRegistry, tag), {
  message: 'Unknown tag. Add it to data/tags.json first.',
});
const knownAuthor = z.string().refine((author) => Object.hasOwn(authorRegistry, author), {
  message: 'Unknown author. Add it to data/authors.json first.',
});
export const photoSchema = blankless(
  imageSchema.extend({
    id: slugId.optional(),
    kind: z.enum(['photo', 'artwork']).default('photo'),
    title: text,
    caption: text,
    date: contentDate.optional(),
    location: text,
    tags: z.array(knownTag).default([]),
    author: knownAuthor.optional(),
    license: z.enum(licensePresets).optional(),
    licenseText: text,
    photo: blankless(
      z.object({
        camera: text,
        lens: text,
        focalLength: text,
        aperture: text,
        shutter: text,
        iso: z.union([z.number().int().positive(), z.string().trim().min(1)]).optional(),
        film: text,
        software: text,
      }),
    ).optional(),
    artwork: blankless(z.object({ device: text, software: text, medium: text })).optional(),
  }),
);
export const albumSchema = blankless(
  z.object({
    title: z.string().min(1),
    slug: slugId,
    date: contentDate,
    draft: z.boolean().default(false),
    description: text,
    authors: z.array(knownAuthor).optional(),
    tags: z.array(knownTag).default([]),
    cover: slugId.optional(),
    images: z.array(photoSchema).default([]),
  }),
);
export type AlbumData = z.output<typeof albumSchema>;
