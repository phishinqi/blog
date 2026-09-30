import { dictionaries, languages } from './ui';
import siteConfig from '../../site.config.json';
import authorRegistry from '../../data/authors.json';
import categoryRegistry from '../../data/categories.json';
import type { Locale } from '../site.config';
export function currentLocale(): Locale {
  return document.documentElement.lang === 'en' ? 'en' : 'zh-CN';
}
export function currentUI() {
  return dictionaries[currentLocale()];
}
export function applyLocale(locale: Locale) {
  const translations = new Map<string, string>();
  for (const key of Object.keys(dictionaries.en) as Array<keyof typeof dictionaries.en>) {
    for (const source of ['zh-CN', 'en'] as const)
      translations.set(dictionaries[source][key], dictionaries[locale][key]);
  }
  const collect = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (typeof record['zh-CN'] === 'string' && typeof record.en === 'string') {
      translations.set(record['zh-CN'], record[locale] as string);
      translations.set(record.en, record[locale] as string);
    } else Object.values(record).forEach(collect);
  };
  collect(siteConfig);
  collect(authorRegistry);
  collect(categoryRegistry);
  const ignored =
    'script,style,pre,code,[data-no-translate],[data-content],#article-body,[data-locale-content],[data-react-ui]';
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest(ignored)) continue;
    const text = node.textContent || '';
    const translated = translations.get(text.trim());
    if (translated !== undefined) node.textContent = text.replace(text.trim(), translated);
  }
  document.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((el) => {
    if (el.closest(ignored)) return;
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const value = el.getAttribute(attr);
      if (value && translations.has(value)) el.setAttribute(attr, translations.get(value)!);
    }
  });
  document.querySelectorAll<HTMLElement>('[data-locale-content]').forEach((el) => {
    el.hidden = el.dataset.localeContent !== locale;
  });
  document.querySelectorAll<HTMLTimeElement>('time[datetime]').forEach((el) => {
    if (el.closest('.archive-month a')) return;
    const date = new Date(el.dateTime);
    if (Number.isFinite(date.getTime()))
      el.textContent = new Intl.DateTimeFormat(locale, {
        timeZone: siteConfig.timeZone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(date);
  });
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as keyof typeof dictionaries.en;
    el.textContent = dictionaries[locale][key] || el.textContent;
  });
  document.querySelectorAll<HTMLElement>('[data-localized]').forEach((el) => {
    const values = JSON.parse(el.dataset.localized!);
    el.textContent = values[locale] || values['zh-CN'];
  });
  document.querySelectorAll<HTMLElement>('[data-archive-month]').forEach((el) => {
    el.textContent = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(`2026-${el.dataset.archiveMonth}-01T00:00:00Z`),
    );
  });
  const language = languages.find((l) => l.code === locale);
  document.querySelectorAll<HTMLElement>('[data-language-code]').forEach((el) => {
    el.textContent = language?.short ?? locale;
  });
  document.querySelectorAll<HTMLElement>('[data-locale]').forEach((el) => {
    el.setAttribute('aria-checked', String(el.dataset.locale === locale));
  });
  window.dispatchEvent(new CustomEvent('v7:locale', { detail: locale }));
}
