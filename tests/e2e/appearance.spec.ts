import { test, expect } from '@playwright/test';
import { siteUrl } from './site-config';

test('star fields vary by page and stay out of the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.star-field-art circle').first()).toBeAttached();
  const homeStars = await page
    .locator('.star-field-art circle')
    .evaluateAll((stars) =>
      stars.slice(0, 5).map((star) => [star.getAttribute('cx'), star.getAttribute('cy')]),
    );

  await page.goto('/posts/');
  const postHref = await page
    .locator('.post-item h2 a, .post-item h3 a')
    .first()
    .getAttribute('href');
  await page.goto(postHref!);
  await expect(page.locator('.star-field-art circle').first()).toBeAttached();
  const postStars = await page
    .locator('.star-field-art circle')
    .evaluateAll((stars) =>
      stars.slice(0, 5).map((star) => [star.getAttribute('cx'), star.getAttribute('cy')]),
    );
  expect(postStars).not.toEqual(homeStars);

  await page.goto('/admin/');
  await expect(page.locator('.star-field-art')).toHaveCount(0);
});

test('stars drift, react to a mouse, and keep short live connections', async ({ page }) => {
  await page.goto('/');
  const star = page.locator('.star-field-art circle').first();
  await expect(star).toBeAttached();
  expect(await page.locator('.star-field-art circle').count()).toBeGreaterThan(20);
  const position = () =>
    star.evaluate((element) => ({
      x: Number(element.getAttribute('cx')),
      y: Number(element.getAttribute('cy')),
    }));
  const initial = await position();
  await expect.poll(async () => (await position()).x).not.toBe(initial.x);
  const bounds = await star.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.waitForTimeout(350);
  const nearMouse = await position();
  expect(Math.hypot(nearMouse.x - initial.x, nearMouse.y - initial.y)).toBeGreaterThan(2);
  const lengths = await page
    .locator('.star-field-art line:not([style*="display: none"])')
    .evaluateAll((lines) =>
      lines.map((line) =>
        Math.hypot(
          Number(line.getAttribute('x2')) - Number(line.getAttribute('x1')),
          Number(line.getAttribute('y2')) - Number(line.getAttribute('y1')),
        ),
      ),
    );
  expect(lengths.length).toBeGreaterThan(0);
  expect(Math.max(...lengths)).toBeLessThan(155);
});

test('reduced motion freezes stars and mouse response', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const star = page.locator('.star-field-art circle').first();
  await expect(star).toBeAttached();
  const before = await star.evaluate((element) => [
    element.getAttribute('cx'),
    element.getAttribute('cy'),
  ]);
  await page.mouse.move(80, 250);
  await page.waitForTimeout(300);
  expect(
    await star.evaluate((element) => [element.getAttribute('cx'), element.getAttribute('cy')]),
  ).toEqual(before);
});

test('copyright defaults to visible and follows the interface language', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/');
  const href = await page.locator('.post-item h2 a, .post-item h3 a').first().getAttribute('href');
  await page.goto(href!);
  const notice = page.locator('.article-copyright');
  await expect(notice).toBeVisible();
  await expect(notice.locator('div[data-locale-content="zh-CN"]')).toContainText('除另有注明外');
  await expect(notice.locator('a:visible')).toHaveAttribute(
    'href',
    siteUrl(new URL(page.url()).pathname),
  );
  await notice.locator('[data-copy-link]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    siteUrl(new URL(page.url()).pathname),
  );
  await expect(notice.locator('[data-copy-link]')).toContainText('链接已复制');
  await page.locator('#language-toggle').click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(notice.locator('div[data-locale-content="en"]')).toBeVisible();
  await expect(notice.locator('div[data-locale-content="en"]')).toContainText(
    'Unless otherwise noted',
  );
  await expect(notice.locator('div[data-locale-content="zh-CN"]')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await notice.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(notice.locator('[data-copy-link]')).toBeVisible();
});

test('wrapped headings fill earlier rows and fit the last row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/posts/');
  const postHref = await page
    .locator('.post-item h2 a, .post-item h3 a')
    .first()
    .getAttribute('href');
  await page.goto(postHref!);
  const heading = page.locator('.article-heading h1');
  await heading.locator('.heading-ink').evaluate((ink) => {
    ink.textContent = '从伦敦出发前往遥远的地方，穿过许多不熟悉的城市与夜晚';
  });
  await heading.hover();
  await expect
    .poll(async () => heading.evaluate((element) => getComputedStyle(element).backgroundSize))
    .toMatch(/^100% /);
  const layout = await heading.evaluate((element) => {
    const ink = element.querySelector('.heading-ink')!;
    const range = document.createRange();
    range.selectNodeContents(ink);
    const rows = [...range.getClientRects()];
    return { count: rows.length, lastWidth: rows.at(-1)!.width, headingWidth: element.clientWidth };
  });
  expect(layout.count).toBeGreaterThan(1);
  expect(layout.lastWidth).toBeLessThan(layout.headingWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
