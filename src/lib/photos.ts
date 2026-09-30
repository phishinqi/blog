import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { siteConfig, authorRegistry, photoTagRegistry, type Localized } from '../site.config';
import { moduleEntries } from './modules';
import { resolveLicense, type License } from './licenses';
import { photoId } from './photo-id';
import type { z } from 'astro/zod';
import type { photoSchema, AlbumData } from './module-schema';

type PhotoData = z.output<typeof photoSchema>;
export interface Photo extends Omit<PhotoData, 'tags' | 'author' | 'license' | 'licenseText'> {
  id: string;
  color?: string;
  tags: Array<{ id: string; label: Localized }>;
  author: { id: string; name: string };
  license: License;
  album: { slug: string; title: string; date: Date };
}

const colors = new Map<string, Promise<string | undefined>>();
// Local images get their placeholder colour at build time; uploads already carry one.
function localColor(src: string) {
  if (!src.startsWith('/')) return Promise.resolve(undefined);
  if (!colors.has(src)) {
    const file = join(process.cwd(), 'public', decodeURIComponent(src));
    colors.set(
      src,
      existsSync(file)
        ? sharp(file)
            .stats()
            .then(
              ({ dominant: { r, g, b } }) =>
                `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
            )
            .catch(() => undefined)
        : Promise.resolve(undefined),
    );
  }
  return colors.get(src)!;
}

export async function getAlbums() {
  const entries = await moduleEntries('albums');
  const seen = new Map<string, string>();
  const albums = [];
  for (const entry of entries) {
    const data: AlbumData = entry.data;
    const albumAuthor = data.authors?.[0] ?? siteConfig.defaultAuthor;
    const photos: Photo[] = [];
    for (const image of data.images) {
      const id = photoId(image.src, image.id);
      if (seen.has(id))
        throw new Error(
          `Duplicate photo id "${id}" in albums "${seen.get(id)}" and "${data.slug}". Give one an explicit id.`,
        );
      seen.set(id, data.slug);
      const authorId = image.author ?? albumAuthor;
      const { tags, license, licenseText, ...rest } = image;
      photos.push({
        ...rest,
        id,
        color: image.color ?? (await localColor(image.src)),
        tags: tags.map((tag) => ({ id: tag, label: photoTagRegistry[tag]! })),
        author: { id: authorId, name: authorRegistry[authorId]!.name },
        license: resolveLicense(license, licenseText, {
          preset: siteConfig.media.license,
          text: siteConfig.media.licenseText,
        }),
        album: { slug: data.slug, title: data.title, date: data.date },
      });
    }
    if (data.cover && !photos.some((p) => p.id === data.cover))
      throw new Error(`Album "${data.slug}" cover "${data.cover}" is not one of its photos.`);
    albums.push({
      entry,
      data,
      photos,
      cover: photos.find((p) => p.id === data.cover) ?? photos[0],
      authors: (data.authors ?? [siteConfig.defaultAuthor]).map((id) => ({
        id,
        name: authorRegistry[id]!.name,
      })),
    });
  }
  return albums;
}

/** Every published photo, newest first; photos without a date sort by their album's date. */
export async function getAllPhotos() {
  const photos = (await getAlbums()).flatMap((album) => album.photos);
  const time = (p: Photo) => (p.date ?? p.album.date).getTime();
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((a, b) => time(b.photo) - time(a.photo) || a.index - b.index)
    .map(({ photo }) => photo);
}

/** Tags in use, in registry order, with how many photos carry each. */
export function tagsIn(photos: Photo[]) {
  const counts = new Map<string, number>();
  for (const photo of photos)
    for (const tag of photo.tags) counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1);
  return Object.entries(photoTagRegistry)
    .filter(([id]) => counts.has(id))
    .map(([id, label]) => ({ id, label, count: counts.get(id)! }));
}
