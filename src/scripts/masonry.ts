// Shortest-column masonry. Every tile's aspect ratio is known from the markup, so positions are
// computed without waiting for images. DOM order stays the reading and tab order; without
// JavaScript the list falls back to CSS columns.
const ratio = (tile: HTMLElement) => {
  const [w, h] = tile.style.getPropertyValue('--ratio').split('/').map(Number);
  return w && h ? h / w : 1;
};

export function layout(list: HTMLElement) {
  const tiles = Array.from(list.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.hidden,
  );
  const width = list.clientWidth;
  if (!width) return;
  const columns = width >= 640 ? 3 : 2;
  const gap = parseFloat(getComputedStyle(list).columnGap) || 12;
  const column = (width - gap * (columns - 1)) / columns;
  const heights = new Array<number>(columns).fill(0);
  for (const tile of tiles) {
    const index = heights.indexOf(Math.min(...heights));
    tile.style.width = `${column}px`;
    tile.style.transform = `translate(${index * (column + gap)}px, ${heights[index]}px)`;
    heights[index]! += column * ratio(tile) + gap;
  }
  list.style.height = `${Math.max(0, Math.max(...heights) - gap)}px`;
  if (!list.classList.contains('is-laid-out')) {
    list.classList.add('is-laid-out');
    // Only later changes (filtering, resizing) animate; the first placement is instant.
    requestAnimationFrame(() => requestAnimationFrame(() => list.classList.add('is-animated')));
  }
}

export function watch(list: HTMLElement) {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => layout(list));
  };
  new ResizeObserver(schedule).observe(list);
  layout(list);
  return schedule;
}

// Lazy images fade in over their placeholder colour once decoded.
export function revealImages(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>('.photo-frame img').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
}

/** Tag buttons show or hide tiles; the choice is mirrored in ?tag= so it can be shared. */
export function filter(browser: HTMLElement, relayout: () => void) {
  const group = browser.querySelector<HTMLElement>('[data-photo-filter]');
  if (!group) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-tag]'));
  const tiles = Array.from(browser.querySelectorAll<HTMLElement>('.photo-tile'));
  const apply = (tag: string, updateURL: boolean) => {
    if (!buttons.some((b) => b.dataset.tag === tag)) tag = '';
    for (const button of buttons)
      button.setAttribute('aria-pressed', String(button.dataset.tag === tag));
    for (const tile of tiles) tile.hidden = !!tag && !tile.dataset.tags?.split(' ').includes(tag);
    relayout();
    if (updateURL) {
      const url = new URL(location.href);
      if (tag) url.searchParams.set('tag', tag);
      else url.searchParams.delete('tag');
      history.replaceState(history.state, '', url);
    }
  };
  group.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tag]');
    if (button) apply(button.dataset.tag!, true);
  });
  apply(new URLSearchParams(location.search).get('tag') ?? '', false);
}
