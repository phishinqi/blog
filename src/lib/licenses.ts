import type { Localized } from '../site.config';

export const licensePresets = [
  'all-rights-reserved',
  'cc-by-4.0',
  'cc-by-nc-4.0',
  'cc-by-nc-sa-4.0',
  'cc0-1.0',
  'custom',
] as const;
export type LicensePreset = (typeof licensePresets)[number];
export interface License {
  label: Localized;
  href?: string;
}
const cc = (code: string, name: string): License => ({
  label: { 'zh-CN': name, en: name },
  href: `https://creativecommons.org/licenses/${code}/4.0/`,
});
const known: Record<Exclude<LicensePreset, 'custom'>, License> = {
  'all-rights-reserved': { label: { 'zh-CN': '保留所有权利', en: 'All rights reserved' } },
  'cc-by-4.0': cc('by', 'CC BY 4.0'),
  'cc-by-nc-4.0': cc('by-nc', 'CC BY-NC 4.0'),
  'cc-by-nc-sa-4.0': cc('by-nc-sa', 'CC BY-NC-SA 4.0'),
  'cc0-1.0': {
    label: { 'zh-CN': 'CC0 1.0（公共领域）', en: 'CC0 1.0 (public domain)' },
    href: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
};
/** A photo's own license wins over the site default; "custom" shows the accompanying text. */
export function resolveLicense(
  preset: LicensePreset | undefined,
  text: string | undefined,
  fallback: { preset: LicensePreset; text: string },
): License {
  const [chosen, custom] = preset ? [preset, text] : [fallback.preset, fallback.text];
  if (chosen === 'custom') {
    if (!custom?.trim()) throw new Error('A "custom" license needs licenseText.');
    return { label: { 'zh-CN': custom.trim(), en: custom.trim() } };
  }
  return known[chosen];
}
