import { applyLocale, currentLocale, currentUI } from '../i18n/client';
import siteConfig from '../../site.config.json';
const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>('#theme-toggle');
const scheme = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = (theme: string) => {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-changing');
    setTimeout(() => root.classList.remove('theme-changing'), 450);
  }
  root.dataset.theme = theme;
  themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));
  window.dispatchEvent(new CustomEvent('v7:theme', { detail: theme }));
};
if (themeButton) {
  themeButton.hidden = false;
  themeButton.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('v7-theme', theme);
    } catch {
      /* The current page still switches without storage. */
    }
    applyTheme(theme);
  });
}
scheme.addEventListener('change', (event) => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('v7-theme');
  } catch {
    /* Use system preference. */
  }
  if (stored !== 'dark' && stored !== 'light') applyTheme(event.matches ? 'dark' : 'light');
});
window.addEventListener('storage', (event) => {
  if (event.key === 'v7-theme')
    applyTheme(
      event.newValue === 'dark' || event.newValue === 'light'
        ? event.newValue
        : scheme.matches
          ? 'dark'
          : 'light',
    );
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
if (hero && !reducedMotion.matches)
  void import('gsap').then(({ gsap }) =>
    gsap.fromTo(
      hero.children,
      { opacity: 0.6, y: 5 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'all' },
    ),
  );
const menu = document.querySelector<HTMLDetailsElement>('#mobile-nav');
menu?.addEventListener('toggle', () => {
  const bottom = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom;
  if (bottom) root.style.setProperty('--header-height', `${Math.round(bottom)}px`);
  root.classList.toggle('menu-open', menu.open);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.open) {
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }
});
document.addEventListener('click', (event) => {
  if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
});

// The header stays reachable: it slides away while reading downwards and returns on the way up.
const header = document.querySelector<HTMLElement>('[data-site-header]');
if (header) {
  let last = scrollY;
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.max(0, scrollY);
    const busy = root.classList.contains('menu-open') || header.querySelector('details[open]');
    header.classList.toggle('is-scrolled', y > 8);
    if (!busy && !reducedMotion.matches && Math.abs(y - last) > 6)
      header.classList.toggle('is-hidden', y > last && y > 240);
    if (busy || y < 240) header.classList.remove('is-hidden');
    last = y;
  };
  addEventListener(
    'scroll',
    () => {
      if (!ticking) requestAnimationFrame(update);
      ticking = true;
    },
    { passive: true },
  );
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  update();
}

// Language menu: a small menu of radio items, operable with the keyboard like a native one.
const languageMenu = document.querySelector<HTMLElement>('[data-language-menu]');
const languageButton = languageMenu?.querySelector<HTMLButtonElement>('#language-toggle');
const languageList = languageMenu?.querySelector<HTMLElement>('#language-options');
if (languageMenu && languageButton && languageList) {
  languageMenu.hidden = false;
  const options = () =>
    Array.from(languageList.querySelectorAll<HTMLButtonElement>('[data-locale]'));
  const setOpen = (open: boolean, focus: 'current' | 'button' | false = false) => {
    languageList.hidden = !open;
    languageButton.setAttribute('aria-expanded', String(open));
    if (open && focus === 'current')
      (options().find((o) => o.dataset.locale === currentLocale()) ?? options()[0])?.focus();
    if (!open && focus === 'button') languageButton.focus();
  };
  languageButton.addEventListener('click', () => setOpen(languageList.hidden !== false, 'current'));
  languageButton.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true, 'current');
    }
  });
  languageList.addEventListener('keydown', (event) => {
    const list = options();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (move) {
      event.preventDefault();
      list[(index + move + list.length) % list.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      list[event.key === 'Home' ? 0 : list.length - 1]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false, event.key === 'Escape' ? 'button' : false);
    }
  });
  languageList.addEventListener('click', (event) => {
    const option = (event.target as Element).closest<HTMLButtonElement>('[data-locale]');
    if (!option) return;
    const locale = option.dataset.locale === 'en' ? 'en' : 'zh-CN';
    try {
      localStorage.setItem('v7-locale', locale);
    } catch {
      /* Current page still changes. */
    }
    applyLocale(locale);
    setOpen(false, 'button');
  });
  document.addEventListener('click', (event) => {
    if (!languageList.hidden && !languageMenu.contains(event.target as Node)) setOpen(false);
  });
}
applyLocale(currentLocale());
document.querySelectorAll<HTMLButtonElement>('[data-copy-link]').forEach((button) =>
  button.addEventListener('click', async () => {
    const label = button.querySelector('span');
    if (!label) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyLink!);
      label.textContent = currentUI().linkCopied;
    } catch {
      label.textContent = currentUI().linkCopyError;
    }
    setTimeout(() => {
      label.textContent = currentUI().copyLink;
    }, 2200);
  }),
);
document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
  if (
    !/^https?:/.test(link.href) ||
    new URL(link.href).origin === location.origin ||
    new URL(link.href).origin === new URL(siteConfig.siteURL).origin
  )
    return;
  if (siteConfig.links.externalNewTab) {
    link.target = '_blank';
    link.rel = Array.from(
      new Set([...link.rel.split(' ').filter(Boolean), 'noopener', 'noreferrer']),
    ).join(' ');
  }
  if (link.closest('.prose,.friends-list')) link.classList.add('external-link');
});
const more = document.querySelector<HTMLDetailsElement>('.more-nav');
document.addEventListener('click', (event) => {
  if (more?.open && !more.contains(event.target as Node)) more.open = false;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && more?.open) {
    more.open = false;
    more.querySelector('summary')?.focus();
  }
});
const days = document.querySelector<HTMLElement>('[data-started-at]');
if (days)
  days.textContent = String(
    Math.max(0, Math.floor((Date.now() - new Date(days.dataset.startedAt!).getTime()) / 86400000)),
  );
