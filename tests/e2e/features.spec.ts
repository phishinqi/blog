import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { siteUrl } from './site-config';

test('interface language persists at the same URL and search follows it', async ({ page }) => {
  await page.goto('/about/');
  await page.locator('#language-toggle').click();
  await page.getByRole('menuitemradio', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.locator('#language-toggle')).toBeFocused();
  await expect(page.locator('[data-language-code]')).toHaveText('EN');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('main h1')).toHaveText('About');
  await expect(page.locator('[data-locale-content="en"]')).toBeVisible();
  await expect(page.locator('[data-locale-content="zh-CN"]')).not.toBeVisible();
  await page.locator('[data-search-trigger]').click();
  await expect(page.locator('#search-dialog-title')).toHaveText('Search');
  await page.keyboard.press('Escape');
  await page.goto('/moments/');
  await expect(page.locator('main h1')).toHaveText('Moments');
  // Keyboard: ArrowDown opens on the current language; ArrowUp moves; Enter chooses.
  await page.locator('#language-toggle').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('main h1')).toHaveText('动态');
  await expect(page.locator('[data-locale="zh-CN"]')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#language-options')).toBeHidden();
});
test('nested files retain URLs, descendants aggregate, and coauthors match metadata', async ({
  page,
}) => {
  await page.goto('/categories/technology/');
  await expect(page.locator('.post-item a[href="/posts/astro-content/"]').last()).toBeVisible();
  await page.goto('/categories/astro/');
  await expect(page.locator('.post-item')).toHaveCount(1);
  await page.goto('/posts/small-components/');
  await expect(page.locator('.article-heading .post-authors a')).toHaveCount(2);
  const data = JSON.parse(
    await page.locator('script[type="application/ld+json"]').first().innerText(),
  );
  expect(data.author.map((a: { name: string }) => a.name)).toEqual(['V7', 'Guest']);
  await page.locator('.article-heading a[href="/authors/guest/"]').click();
  await expect(page.locator('.post-item')).toHaveCount(1);
});
test('cover variants and gallery keyboard interactions work', async ({ page }) => {
  await page.goto('/posts/image-and-space/');
  await expect(page.locator('.article-cover img')).toHaveAttribute('srcset', /640w/);
  await page.goto('/albums/paper/');
  const trigger = page.locator('[data-viewer-item]').first();
  await trigger.click();
  await expect(page.locator('.viewer')).toBeVisible();
  await expect(page.locator('.viewer-count')).toHaveText('1 / 7');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.viewer-count')).toHaveText('2 / 7');
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer')).not.toBeVisible();
  // Focus returns to the tile of the photo that was on screen.
  await expect(page.locator('[data-viewer-item]').nth(1)).toBeFocused();
});
test('new pages have headings, mobile layouts and accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of [
    '/friends/',
    '/moments/',
    '/timeline/',
    '/roadmap/',
    '/albums/',
    '/albums/paper/',
    '/photos/',
    '/authors/v7/',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ['serious', 'critical'].includes(v.impact || '')),
    ).toEqual([]);
  }
});
test('permalink uses canonical origin and stays stable', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/posts/astro-content/');
  await page.locator('[data-copy-link]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    siteUrl('/posts/astro-content/'),
  );
  await expect(page.locator('[data-copy-link]')).toContainText('链接已复制');
});

test('the editor page mounts and offers a way in', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto('/admin/');
  expect(response?.status()).toBe(200);
  // The bundle loads and the editor renders; a build that dropped its assets would fail here,
  // which is the failure mode this page actually has.
  await expect(page.locator('.v7-cms')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.connect h1')).toBeVisible();
  expect(errors).toEqual([]);
});
