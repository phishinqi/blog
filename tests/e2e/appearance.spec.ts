import { test, expect } from '@playwright/test';

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
