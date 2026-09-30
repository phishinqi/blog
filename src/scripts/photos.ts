import { register, openFromHash } from './viewer';
import { watch, filter, revealImages } from './masonry';

document.querySelectorAll<HTMLElement>('[data-photo-browser]').forEach((browser) => {
  const list = browser.querySelector<HTMLElement>('[data-masonry]');
  if (list) filter(browser, watch(list));
  revealImages(browser);
  register(browser);
});
openFromHash();
