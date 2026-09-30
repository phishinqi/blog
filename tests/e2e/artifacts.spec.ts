import { test, expect } from '@playwright/test';
import { glob, readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

const root = resolve('dist');
async function publicPaths() {
  const files = [];
  for await (const path of glob('posts/*/index.html', { cwd: root }))
    files.push(`/${path.replaceAll(sep, '/').replace('index.html', '')}`);
  return files.sort();
}

test('public routes, RSS, sitemap and Pagefind contain exactly the same articles', async ({
  page,
  request,
}) => {
  const paths = await publicPaths();
  // Counted from the build rather than hard-coded, so adding posts does not break the suite.
  expect(paths.length).toBeGreaterThan(0);
  expect(paths).not.toContain('/posts/draft-example/');
  expect(paths).not.toContain('/posts/future-example/');
  const rss = await readFile(resolve(root, 'rss.xml'), 'utf8');
  const sitemap = await readFile(resolve(root, 'sitemap-0.xml'), 'utf8');
  await page.goto('/search/');
  const indexed = await page.evaluate(
    async ({ rss, sitemap }) => {
      const parse = (xml: string, selector: string) =>
        [...new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll(selector)]
          .map((el) => new URL(el.textContent!).pathname)
          .sort();
      const url = '/pagefind/pagefind.js';
      const engine = await import(/* @vite-ignore */ url);
      const all = await engine.search(null);
      const search = (
        await Promise.all(
          all.results.map((hit: { data(): Promise<{ url: string }> }) => hit.data()),
        )
      )
        .map((hit: { url: string }) => new URL(hit.url, location.origin).pathname)
        .sort();
      return {
        rss: parse(rss, 'item > link'),
        sitemap: parse(sitemap, 'loc').filter((path) => /^\/posts\/[^/]+\/$/.test(path)),
        search,
      };
    },
    { rss, sitemap },
  );
  expect(indexed.rss).toEqual(paths);
  expect(indexed.sitemap).toEqual(paths);
  expect(indexed.search).toEqual(paths);
  expect(JSON.parse(await readFile(resolve(root, 'pagefind/status.json'), 'utf8')).articles).toBe(
    paths.length,
  );
  for (const path of ['/posts/draft-example/', '/posts/future-example/', '/does-not-exist/'])
    expect((await request.get(path)).status()).toBe(404);
});

test('all built HTML links, fragment targets and local assets resolve', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  const documents: { route: string; html: string }[] = [];
  for await (const file of glob('**/*.html', { cwd: root })) {
    if (file.startsWith('cms' + sep)) continue;
    const route = `/${file.replaceAll(sep, '/').replace(/index\.html$/, '')}`;
    const html = await readFile(resolve(root, file), 'utf8');
    expect(html).not.toContain('UnpublishedSentinelSecret');
    documents.push({ route, html });
  }
  const refs = await page.evaluate((documents) => {
    const paths = new Set<string>();
    const ids: Record<string, string[]> = {};
    const anchors: { source: string; path: string; hash: string }[] = [];
    for (const { route, html } of documents) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      ids[route] = [...doc.querySelectorAll('[id]')].map((el) => el.id);
      for (const el of doc.querySelectorAll(
        'a[href], link[href], script[src], img[src], source[src]',
      )) {
        const url = new URL(
          el.getAttribute('href') || el.getAttribute('src')!,
          `https://example.com${route}`,
        );
        if (url.origin !== 'https://example.com') continue;
        const path = decodeURI(url.pathname);
        paths.add(path);
        if (el.tagName === 'A' && url.hash)
          anchors.push({ source: route, path, hash: decodeURIComponent(url.hash.slice(1)) });
      }
    }
    return { paths: [...paths], ids, anchors };
  }, documents);
  for (const path of refs.paths) {
    const response = await request.get(path);
    expect(response.ok(), `Broken local resource: ${path}`).toBe(true);
  }
  for (const anchor of refs.anchors)
    expect(
      refs.ids[anchor.path],
      `Broken anchor ${anchor.source} → ${anchor.path}#${anchor.hash}`,
    ).toContain(anchor.hash);
  for (const filename of await readdir(resolve(root, '_astro'))) {
    if (!filename.endsWith('.css')) continue;
    const css = await readFile(resolve(root, '_astro', filename), 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1]!.startsWith('data:')) continue;
      const target = new URL(match[1]!, `http://127.0.0.1:4321/_astro/${filename}`);
      expect(
        (await request.get(target.href)).ok(),
        `Missing CSS resource: ${relative(root, target.pathname)}`,
      ).toBe(true);
    }
  }
});

test('mixed-language search also works when the interface is English', async ({ page }) => {
  await page.goto('/search/');
  await page.evaluate(() => {
    document.documentElement.lang = 'en';
  });
  await page.getByRole('searchbox').fill('公式');
  await expect(page.locator('.search-results')).toContainText('让公式与流程图');
  await page.getByRole('searchbox').fill('progressive');
  await expect(page.locator('.search-results')).toContainText('A smaller web');
});
