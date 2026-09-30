import { createHash } from 'node:crypto';

// Ids make deep links, so they must not change when photos are reordered. A readable file name
// is used when there is one; generated names (R2 keys, numeric sizes) fall back to a short hash.
export function photoId(src: string, explicit?: string) {
  if (explicit) return explicit;
  const name = decodeURIComponent(src.split(/[?#]/)[0]!.split('/').pop() || '')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const generated = !name || /^\d+$/.test(name) || /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(name);
  return generated ? `p-${createHash('sha1').update(src).digest('hex').slice(0, 8)}` : name;
}
