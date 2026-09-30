import { currentLocale, currentUI } from '../i18n/client';
import siteConfig from '../../site.config.json';

interface Localized {
  'zh-CN': string;
  en: string;
}
export interface ViewerItem {
  id: string;
  src: string;
  srcset?: string;
  width: number;
  height: number;
  alt: string;
  title?: string;
  caption?: string;
  date?: string;
  location?: string;
  kind?: 'photo' | 'artwork';
  tags?: Array<{ id: string; label: Localized }>;
  author?: { id: string; name: string };
  album?: { slug: string; title: string };
  license?: { label: Localized; href?: string };
  specs?: Record<string, string | undefined>;
}
interface Source {
  root: HTMLElement;
  items: ViewerItem[];
}

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
  close: svg('<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>'),
  previous: svg('<path d="M15 6l-6 6l6 6"/>'),
  next: svg('<path d="M9 6l6 6l-6 6"/>'),
  info: svg(
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>',
  ),
  link: svg(
    '<path d="M9 15l6 -6"/><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464"/><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463"/>',
  ),
  zoomIn: svg(
    '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M7 10l6 0"/><path d="M10 7l0 6"/><path d="M21 21l-6 -6"/>',
  ),
  zoomOut: svg(
    '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M7 10l6 0"/><path d="M21 21l-6 -6"/>',
  ),
};
const MAX_SCALE = 4;
const INFO_KEY = 'v7-viewer-info';
const hashFor = (id: string) => `#photo-${id}`;
const idFromHash = () => decodeURIComponent(location.hash.match(/^#photo-(.+)$/)?.[1] ?? '');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function button(className: string, html: string) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.innerHTML = html;
  return el;
}

class Viewer {
  private dialog = document.createElement('dialog');
  private count = document.createElement('p');
  private zoomButton = button('viewer-tool', icons.zoomIn);
  private infoButton = button('viewer-tool', icons.info);
  private copyButton = button('viewer-tool', icons.link);
  private closeButton = button('viewer-tool', icons.close);
  private previousButton = button('viewer-nav viewer-previous', icons.previous);
  private nextButton = button('viewer-nav viewer-next', icons.next);
  private stage = document.createElement('div');
  private preview = document.createElement('img');
  private image = document.createElement('img');
  private info = document.createElement('aside');
  private toast = document.createElement('p');
  private source?: Source;
  private list: ViewerItem[] = [];
  private index = 0;
  private pushed = false;
  private zoom = { scale: 1, x: 0, y: 0 };

  constructor() {
    const top = document.createElement('div');
    top.className = 'viewer-top';
    const tools = document.createElement('div');
    tools.className = 'viewer-tools';
    tools.append(this.zoomButton, this.infoButton, this.copyButton, this.closeButton);
    this.count.className = 'viewer-count';
    this.count.setAttribute('aria-live', 'polite');
    top.append(this.count, tools);
    this.stage.className = 'viewer-stage';
    this.preview.className = 'viewer-preview';
    this.preview.alt = '';
    this.preview.setAttribute('aria-hidden', 'true');
    this.image.className = 'viewer-image';
    this.image.draggable = false;
    this.preview.draggable = false;
    this.stage.append(this.preview, this.image, this.previousButton, this.nextButton);
    this.info.className = 'viewer-info';
    this.info.id = 'viewer-info';
    this.infoButton.setAttribute('aria-controls', this.info.id);
    const main = document.createElement('div');
    main.className = 'viewer-main';
    main.append(this.stage, this.info);
    this.toast.className = 'viewer-toast';
    this.toast.setAttribute('role', 'status');
    this.dialog.className = 'viewer';
    this.dialog.append(top, main, this.toast);
    document.body.append(this.dialog);
    let infoOpen = matchMedia('(min-width: 960px)').matches;
    try {
      const stored = localStorage.getItem(INFO_KEY);
      if (stored) infoOpen = stored === 'open';
    } catch {
      /* Default by screen size. */
    }
    this.setInfo(infoOpen);
    this.bind();
  }

  private labels() {
    const ui = currentUI();
    this.dialog.setAttribute('aria-label', ui.viewer);
    for (const [el, label] of [
      [this.infoButton, ui.photoInfo],
      [this.copyButton, ui.copyPhotoLink],
      [this.closeButton, ui.close],
      [this.previousButton, ui.previousPhoto],
      [this.nextButton, ui.nextPhoto],
    ] as const) {
      el.setAttribute('aria-label', label);
      el.title = label;
    }
    this.info.setAttribute('aria-label', ui.photoInfo);
    this.updateZoomButton();
  }

  open(source: Source, id: string, push = true) {
    this.source = source;
    this.list = source.items.filter((item) => {
      const tile = source.root.querySelector(`[data-viewer-item="${CSS.escape(item.id)}"]`);
      return tile && !tile.closest('[hidden]');
    });
    const index = this.list.findIndex((item) => item.id === id);
    if (index < 0) return;
    this.labels();
    if (!this.dialog.open) {
      this.dialog.showModal();
      document.documentElement.classList.add('viewer-open');
      this.closeButton.focus();
    }
    this.pushed = push;
    this.show(index, push ? 'push' : 'replace');
  }

  private show(index: number, history: 'push' | 'replace' = 'replace') {
    const count = this.list.length;
    this.index = (index + count) % count;
    const item = this.list[this.index]!;
    this.resetZoom();
    const tile = this.source?.root.querySelector<HTMLImageElement>(
      `[data-viewer-item="${CSS.escape(item.id)}"] img`,
    );
    this.preview.src = tile?.currentSrc || tile?.src || '';
    this.preview.hidden = !this.preview.src;
    this.image.classList.remove('is-ready');
    this.image.removeAttribute('srcset');
    this.image.alt = item.alt;
    this.image.width = this.preview.width = item.width;
    this.image.height = this.preview.height = item.height;
    this.image.onload = () => {
      this.image.classList.add('is-ready');
      this.preview.hidden = true;
    };
    this.image.sizes = this.infoOpen() && innerWidth >= 960 ? 'calc(100vw - 22rem)' : '100vw';
    if (item.srcset) this.image.srcset = item.srcset;
    this.image.src = item.src;
    this.count.textContent = `${this.index + 1} / ${count}`;
    this.previousButton.hidden = this.nextButton.hidden = count < 2;
    this.renderInfo(item);
    const url = new URL(location.href);
    url.hash = hashFor(item.id);
    if (history === 'push') window.history.pushState({ v7viewer: true }, '', url);
    else window.history.replaceState(window.history.state, '', url);
    for (const offset of [1, -1]) {
      const next = this.list[(this.index + offset + count) % count];
      if (!next || count < 2) continue;
      const img = new Image();
      img.sizes = this.image.sizes;
      if (next.srcset) img.srcset = next.srcset;
      img.src = next.src;
    }
  }

  close() {
    if (!this.dialog.open) return;
    if (this.pushed && window.history.state?.v7viewer) window.history.back();
    else {
      const url = new URL(location.href);
      url.hash = '';
      window.history.replaceState(window.history.state, '', url);
      this.finish();
    }
  }

  private finish() {
    const item = this.list[this.index];
    this.dialog.close();
    document.documentElement.classList.remove('viewer-open');
    this.image.removeAttribute('src');
    this.image.removeAttribute('srcset');
    if (item)
      this.source?.root
        .querySelector<HTMLElement>(`[data-viewer-item="${CSS.escape(item.id)}"]`)
        ?.focus();
  }

  private infoOpen() {
    return this.dialog.classList.contains('info-open');
  }
  private setInfo(open: boolean) {
    this.dialog.classList.toggle('info-open', open);
    this.infoButton.setAttribute('aria-expanded', String(open));
    this.info.hidden = !open;
  }

  private renderInfo(item: ViewerItem) {
    const ui = currentUI();
    const locale = currentLocale();
    this.info.replaceChildren();
    const add = <K extends keyof HTMLElementTagNameMap>(
      parent: HTMLElement,
      tag: K,
      text?: string,
      className?: string,
    ) => {
      const el = document.createElement(tag);
      if (text) el.textContent = text;
      if (className) el.className = className;
      parent.append(el);
      return el;
    };
    if (item.kind)
      add(this.info, 'p', item.kind === 'artwork' ? ui.kindArtwork : ui.kindPhoto, 'viewer-kind');
    add(this.info, 'h2', item.title || item.alt, 'viewer-title');
    if (item.caption) add(this.info, 'p', item.caption, 'viewer-caption');
    const rows: Array<[string, string | HTMLElement | undefined]> = [];
    const link = (href: string, text: string) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      return a;
    };
    if (item.date)
      rows.push([
        ui.photoDate,
        new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
          new Date(`${item.date}T00:00:00Z`),
        ),
      ]);
    rows.push([ui.location, item.location]);
    const specLabels: Record<string, string> = {
      camera: ui.camera,
      lens: ui.lens,
      exposure: ui.exposure,
      film: ui.film,
      editing: ui.editing,
      device: ui.device,
      software: ui.software,
      medium: ui.medium,
    };
    for (const [key, value] of Object.entries(item.specs ?? {}))
      rows.push([specLabels[key] ?? key, value]);
    if (item.author) rows.push([ui.creator, link(`/authors/${item.author.id}/`, item.author.name)]);
    if (item.album) rows.push([ui.inAlbum, link(`/albums/${item.album.slug}/`, item.album.title)]);
    if (item.license) {
      const label = item.license.label[locale] || item.license.label['zh-CN'];
      const value = item.license.href ? link(item.license.href, label) : label;
      if (value instanceof HTMLAnchorElement) value.rel = 'license noopener noreferrer';
      rows.push([ui.license, value]);
    }
    const list = document.createElement('dl');
    for (const [label, value] of rows) {
      if (!value) continue;
      const row = add(list, 'div');
      add(row, 'dt', label);
      const dd = add(row, 'dd');
      dd.append(value);
    }
    if (list.childElementCount) this.info.append(list);
    if (item.tags?.length) {
      const tags = add(this.info, 'ul', undefined, 'viewer-tags');
      for (const tag of item.tags) {
        const li = add(tags, 'li');
        const label = tag.label[locale] || tag.label['zh-CN'];
        li.append(
          siteConfig.features.albums
            ? link(`/photos/?tag=${encodeURIComponent(tag.id)}`, label)
            : label,
        );
      }
    }
  }

  // Zoom keeps the point under the pointer still; panning is clamped to the image's edges.
  private fitted() {
    const item = this.list[this.index]!;
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const fit = Math.min(w / item.width, h / item.height);
    return { w, h, iw: item.width * fit, ih: item.height * fit };
  }
  private apply(animate = false) {
    const { scale } = this.zoom;
    const { w, h, iw, ih } = this.fitted();
    const maxX = Math.max(0, (iw * scale - w) / 2);
    const maxY = Math.max(0, (ih * scale - h) / 2);
    this.zoom.x = Math.min(maxX, Math.max(-maxX, this.zoom.x));
    this.zoom.y = Math.min(maxY, Math.max(-maxY, this.zoom.y));
    this.transform(`translate3d(${this.zoom.x}px, ${this.zoom.y}px, 0) scale(${scale})`, animate);
    this.stage.classList.toggle('is-zoomed', scale > 1);
    this.updateZoomButton();
  }
  private transform(value: string, animate: boolean) {
    for (const img of [this.image, this.preview]) {
      img.style.transition = animate && !reduced() ? 'transform 220ms ease' : 'none';
      img.style.transform = value;
    }
  }
  private zoomAt(scale: number, clientX?: number, clientY?: number, animate = false) {
    const next = Math.min(MAX_SCALE, Math.max(1, scale));
    const rect = this.stage.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - (rect.left + rect.width / 2);
    const py = (clientY ?? rect.top + rect.height / 2) - (rect.top + rect.height / 2);
    const ratio = next / this.zoom.scale;
    this.zoom =
      next === 1
        ? { scale: 1, x: 0, y: 0 }
        : {
            scale: next,
            x: px - (px - this.zoom.x) * ratio,
            y: py - (py - this.zoom.y) * ratio,
          };
    this.apply(animate);
  }
  private resetZoom() {
    this.zoom = { scale: 1, x: 0, y: 0 };
    this.transform('', false);
    this.stage.classList.remove('is-zoomed');
    this.updateZoomButton();
  }
  private toggleZoom(clientX?: number, clientY?: number) {
    if (this.zoom.scale > 1) this.zoomAt(1, undefined, undefined, true);
    else this.zoomAt(2.5, clientX, clientY, true);
  }
  private updateZoomButton() {
    const zoomed = this.zoom.scale > 1;
    const label = zoomed ? currentUI().zoomOut : currentUI().zoomIn;
    this.zoomButton.innerHTML = zoomed ? icons.zoomOut : icons.zoomIn;
    this.zoomButton.setAttribute('aria-label', label);
    this.zoomButton.title = label;
  }

  private async copy() {
    const item = this.list[this.index];
    if (!item) return;
    const path = item.album ? `/albums/${item.album.slug}/` : location.pathname;
    try {
      await navigator.clipboard.writeText(`${location.origin}${path}${hashFor(item.id)}`);
      this.flash(currentUI().photoLinkCopied);
    } catch {
      this.flash(currentUI().linkCopyError);
    }
  }
  private flash(text: string) {
    this.toast.textContent = text;
    this.toast.classList.add('is-visible');
    setTimeout(() => this.toast.classList.remove('is-visible'), 2000);
  }

  private bind() {
    this.closeButton.addEventListener('click', () => this.close());
    this.previousButton.addEventListener('click', () => this.show(this.index - 1));
    this.nextButton.addEventListener('click', () => this.show(this.index + 1));
    this.zoomButton.addEventListener('click', () => this.toggleZoom());
    this.copyButton.addEventListener('click', () => void this.copy());
    this.infoButton.addEventListener('click', () => {
      const open = !this.infoOpen();
      this.setInfo(open);
      try {
        localStorage.setItem(INFO_KEY, open ? 'open' : 'closed');
      } catch {
        /* Session-only choice. */
      }
      if (this.zoom.scale > 1) requestAnimationFrame(() => this.apply());
    });
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    this.dialog.addEventListener('keydown', (event) => {
      if ((event.target as Element).closest('.viewer-info a')) return;
      const actions: Record<string, () => void> = {
        ArrowRight: () => this.show(this.index + 1),
        ArrowLeft: () => this.show(this.index - 1),
        '+': () => this.zoomAt(this.zoom.scale * 1.6, undefined, undefined, true),
        '=': () => this.zoomAt(this.zoom.scale * 1.6, undefined, undefined, true),
        '-': () => this.zoomAt(this.zoom.scale / 1.6, undefined, undefined, true),
        '0': () => this.zoomAt(1, undefined, undefined, true),
        i: () => this.infoButton.click(),
      };
      const action = actions[event.key];
      if (action && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        action();
      }
    });
    this.stage.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoomAt(
          this.zoom.scale * Math.exp(-event.deltaY * 0.0015),
          event.clientX,
          event.clientY,
        );
      },
      { passive: false },
    );
    this.stage.addEventListener('dblclick', (event) => {
      if ((event.target as Element).closest('button')) return;
      this.toggleZoom(event.clientX, event.clientY);
    });
    // One pointer pans (zoomed) or swipes (not zoomed); two pointers pinch.
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, tx: 0, ty: 0, time: 0 };
    let pinch = { distance: 0, scale: 1 };
    let moved = false;
    let lastTap = { time: 0, x: 0, y: 0 };
    const distance = () => {
      const [a, b] = Array.from(pointers.values());
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    this.stage.addEventListener('pointerdown', (event) => {
      if ((event.target as Element).closest('button')) return;
      this.stage.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        start = {
          x: event.clientX,
          y: event.clientY,
          tx: this.zoom.x,
          ty: this.zoom.y,
          time: Date.now(),
        };
        moved = false;
      } else if (pointers.size === 2) pinch = { distance: distance(), scale: this.zoom.scale };
    });
    this.stage.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (pointers.size === 2 && pinch.distance) {
        const [a, b] = Array.from(pointers.values());
        this.zoomAt(
          (pinch.scale * distance()) / pinch.distance,
          (a!.x + b!.x) / 2,
          (a!.y + b!.y) / 2,
        );
      } else if (pointers.size === 1 && this.zoom.scale > 1) {
        this.zoom.x = start.tx + dx;
        this.zoom.y = start.ty + dy;
        this.apply();
      } else if (pointers.size === 1 && moved && event.pointerType !== 'mouse') {
        const vertical = Math.abs(dy) > Math.abs(dx);
        this.transform(
          vertical ? `translate3d(0, ${Math.max(0, dy)}px, 0)` : `translate3d(${dx}px, 0, 0)`,
          false,
        );
      }
    });
    const end = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      const wasPinch = pointers.size > 1;
      pointers.delete(event.pointerId);
      if (wasPinch || pointers.size) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (this.zoom.scale > 1) return;
      if (moved && event.pointerType !== 'mouse') {
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy))
          this.show(this.index + (dx < 0 ? 1 : -1));
        else if (dy > 90 && dy > Math.abs(dx)) this.close();
        else this.transform('', true);
        return;
      }
      if (moved) return;
      if (event.pointerType !== 'mouse') {
        const now = Date.now();
        if (
          now - lastTap.time < 300 &&
          Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30
        ) {
          this.toggleZoom(event.clientX, event.clientY);
          lastTap = { time: 0, x: 0, y: 0 };
          return;
        }
        lastTap = { time: now, x: event.clientX, y: event.clientY };
      }
    };
    this.stage.addEventListener('pointerup', end);
    this.stage.addEventListener('pointercancel', end);
    window.addEventListener('popstate', () => {
      const id = idFromHash();
      if (this.dialog.open && !id) this.finish();
      else if (this.dialog.open && id) {
        const index = this.list.findIndex((item) => item.id === id);
        if (index >= 0) this.show(index);
      }
    });
    addEventListener('resize', () => {
      if (this.dialog.open && this.zoom.scale > 1) this.apply();
    });
    window.addEventListener('v7:locale', () => {
      if (!this.dialog.open) return;
      this.labels();
      this.renderInfo(this.list[this.index]!);
    });
  }
}

let viewer: Viewer | undefined;
const sources = new Map<HTMLElement, Source>();

/** Makes every [data-viewer-item] link inside `root` open in the shared viewer. */
export function register(root: HTMLElement) {
  const data = root.querySelector('script[data-viewer-items]')?.textContent;
  if (!data || sources.has(root)) return;
  const source = { root, items: JSON.parse(data) as ViewerItem[] };
  sources.set(root, source);
  root.addEventListener('click', (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-viewer-item]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button)
      return;
    event.preventDefault();
    viewer ??= new Viewer();
    viewer.open(source, link.dataset.viewerItem!);
  });
}

let checkedHash = false;
/** Opens the photo named in the address (#photo-id), if it is on this page. */
export function openFromHash() {
  const id = idFromHash();
  if (!id || checkedHash) return;
  checkedHash = true;
  for (const source of sources.values())
    if (source.items.some((item) => item.id === id)) {
      viewer ??= new Viewer();
      viewer.open(source, id, false);
      return;
    }
}
