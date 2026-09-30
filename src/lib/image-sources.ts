import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const assets = import.meta.glob<{ default: ImageMetadata }>(
  '/public/**/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);
const largest = (srcset?: string) =>
  srcset
    ?.split(',')
    .map((part) => part.trim().split(/\s+/))
    .sort((a, b) => parseInt(b[1] ?? '0') - parseInt(a[1] ?? '0'))[0]?.[0];

/**
 * A srcset for a local raster image, generated at build time, capped at `max` pixels wide and at
 * the file's own width. Uploaded (R2) images already carry a srcset and are used as they are.
 */
export async function responsiveSource(src: string, srcset: string | undefined, widths: number[]) {
  const local = assets[`/public${src}`]?.default;
  if (!local) return { src: largest(srcset) ?? src, srcset };
  const max = Math.min(local.width, Math.max(...widths));
  const image = await getImage({
    src: local,
    widths: [...new Set([...widths.filter((w) => w < max), max])],
    format: 'webp',
  });
  return { src: image.srcSet.values.at(-1)?.url ?? image.src, srcset: image.srcSet.attribute };
}
