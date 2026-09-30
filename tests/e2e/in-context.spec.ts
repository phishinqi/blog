/**
 * The contract between the theme and the editor's in-context mode.
 *
 * Two halves have to agree: the theme renders `data-v7-field="…"` on the elements showing each
 * field, and the editor is configured with `preview.editAttribute` naming that attribute plus a
 * `pathTemplate` it can address. A rename on either side breaks the feature silently — the preview
 * just stops responding to clicks, with nothing in the console.
 *
 * The editor's own suite covers the protocol against a fixture; this covers the wiring in this
 * repository, and does it against the built output so it runs in CI like every other test here.
 * The marks are development-only, so the attribute itself is asserted from `cms.config.json`
 * rather than from rendered HTML.
 */
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const config = async () =>
  JSON.parse(await readFile(resolve('cms.config.json'), 'utf8')) as {
    preview?: { editAttribute?: string; pathTemplate?: string; devServerURL?: string };
  };

test('the editor is told which attribute marks an editable field', async () => {
  const preview = (await config()).preview;
  expect(preview?.editAttribute, 'in-context editing is off without it').toBe('data-v7-field');
  // Without a path template the editor cannot address an entry on the site, so clicking would have
  // nowhere to point even though the frame loaded.
  expect(preview?.pathTemplate).toBe('/posts/{{slug}}/');
});

test('the template marks exactly the fields the editor resolves picks against', async () => {
  const template = await readFile(resolve('src/layouts/PostLayout.astro'), 'utf8');
  const attribute = (await config()).preview!.editAttribute!;
  // Every field the template marks must exist as a form field, or a pick focuses nothing.
  const marked = [...template.matchAll(/mark\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  expect(marked.length, 'PostLayout should mark at least title and description').toBeGreaterThan(0);
  for (const field of ['title', 'description']) expect(marked).toContain(field);
  // The attribute name is written once, through the helper, so it cannot drift per element.
  expect(template).toContain(`'${attribute}'`);
});

test('a production build carries the marks, so the deployed editor can find them', async ({
  page,
}) => {
  // The deployed editor previews the deployed site, same-origin, so the marks have to be in the
  // built HTML. A bare data attribute renders as nothing and Pagefind is told what to read.
  await page.goto('/posts/start-here/');
  await expect(page.locator('[data-v7-field="title"]')).toHaveCount(1);
  await expect(page.locator('[data-v7-field="description"]')).toHaveCount(1);
});

test('the generated config previews the deployed site, never localhost', async () => {
  // A deployed editor pointing at localhost makes every visitor's browser try to reach its own
  // machine: "connection refused", which looks like a broken feature.
  const hosted = JSON.parse(await readFile(resolve('cms.config.github.json'), 'utf8')) as {
    preview?: { devServerURL?: string; editAttribute?: string };
    backend?: { authBase?: string };
  };
  const origin = hosted.preview?.devServerURL;
  expect(origin, 'the deployed editor needs a preview origin').toBeTruthy();
  expect(origin).not.toContain('localhost');
  expect(origin).not.toContain('127.0.0.1');
  // Same origin as the editor is what makes the frame embeddable and the bridge injectable.
  expect(origin).toBe(hosted.backend?.authBase);
  expect(hosted.preview?.editAttribute).toBe('data-v7-field');
});

test('the site allows being framed by itself, which the editor depends on', async () => {
  // Read from the file, not from a response: `_headers` is a Cloudflare Pages feature and
  // `astro preview` does not apply it, so a request here would prove nothing either way. The live
  // check is `curl -sI https://v7.soyonagasaki.com/posts/start-here/ | grep -i x-frame-options`.
  const headers = await readFile(resolve('public/_headers'), 'utf8');
  const value = /^\s*X-Frame-Options:\s*(\S+)/m.exec(headers)?.[1];
  // DENY would make the editor's own preview iframe refuse to render the site.
  expect(value?.toUpperCase()).toBe('SAMEORIGIN');
});

test('the built admin page contains no localhost reference', async ({ request }) => {
  const response = await request.get('/admin/');
  const html = await response.text();
  expect(html).not.toContain('localhost:4321');
  expect(html).not.toContain('127.0.0.1:4321');
});
