import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const serious = (violations: Array<{ impact?: string | null }>) =>
  violations.filter((v) => ['serious', 'critical'].includes(v.impact || ''));

test('masonry places tiles in the shortest column without overlap', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/albums/city-corners/');
  await expect(page.locator('[data-masonry]')).toHaveClass(/is-laid-out/);
  const boxes = await page
    .locator('.photo-tile')
    .evaluateAll((tiles) => tiles.map((t) => t.getBoundingClientRect().toJSON()));
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(3);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i]!, boxes[j]!];
      const overlap =
        a.x < b.x + b.width - 1 &&
        b.x < a.x + a.width - 1 &&
        a.y < b.y + b.height - 1 &&
        b.y < a.y + a.height - 1;
      expect(overlap, `tiles ${i} and ${j} overlap`).toBe(false);
    }
  // Tab order follows the source order.
  await page.locator('.photo-tile a').first().focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.photo-tile a').nth(1)).toBeFocused();
});

test('images load lazily over a placeholder colour', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto('/photos/');
  const images = page.locator('.photo-frame img');
  await expect(images.first()).toHaveAttribute('loading', 'lazy');
  await expect(images.first()).toHaveClass(/is-loaded/);
  expect(
    await page
      .locator('.photo-tile')
      .first()
      .evaluate((el) => el.style.getPropertyValue('--tone')),
  ).toMatch(/^#[0-9a-f]{6}$/);
  // Every tile defers loading and decoding to the browser.
  expect(await page.locator('.photo-frame img:not([loading="lazy"])').count()).toBe(0);
  expect(await page.locator('.photo-frame img:not([decoding="async"])').count()).toBe(0);
});

test('hover enlarges the image inside its tile and reveals details', async ({ page }) => {
  await page.goto('/albums/city-corners/');
  const tile = page.locator('.photo-tile').first();
  await tile.hover();
  await expect(tile.locator('.photo-overlay')).toHaveCSS('opacity', '1');
  await expect
    .poll(() =>
      tile.locator('img').evaluate((img) => new DOMMatrix(getComputedStyle(img).transform).a),
    )
    .toBeCloseTo(1.04, 2);
  await expect(tile.locator('a')).toHaveCSS('overflow', 'hidden');
});

test('tag filter hides tiles, lays out again and survives a reload', async ({ page }) => {
  await page.goto('/photos/');
  const total = await page.locator('.photo-tile').count();
  await page.locator('[data-photo-filter] button[data-tag="night"]').click();
  await expect(page).toHaveURL(/\?tag=night$/);
  await expect(page.locator('.photo-tile:visible')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('[data-tag="night"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.photo-tile:visible')).toHaveCount(3);
  await page.locator('[data-tag=""]').click();
  await expect(page.locator('.photo-tile:visible')).toHaveCount(total);
  await expect(page).toHaveURL(/\/photos\/$/);
});

test('viewer shows details, deep-links, zooms and closes with Back', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/photos/?tag=night');
  await page.locator('.photo-tile:visible a').first().click();
  const viewer = page.locator('.viewer');
  await expect(viewer).toBeVisible();
  // Filtering limits the sequence to the visible photos.
  await expect(page.locator('.viewer-count')).toHaveText('1 / 3');
  await expect(page).toHaveURL(/#photo-[a-z0-9-]+$/);
  const hash = new URL(page.url()).hash;
  const info = viewer.locator('.viewer-info');
  await expect(info).toContainText('示例城市');
  await expect(info).toContainText('保留所有权利');
  await expect(info.locator('a[href^="/albums/"]')).toBeVisible();
  await expect(viewer.locator('.viewer-image')).toHaveClass(/is-ready/);
  await viewer.getByRole('button', { name: '复制图片链接' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/albums/[a-z-]+/${hash}$`),
  );
  await page.locator('.viewer-stage').dblclick({ position: { x: 300, y: 300 } });
  await expect(page.locator('.viewer-stage')).toHaveClass(/is-zoomed/);
  await page.keyboard.press('0');
  await expect(page.locator('.viewer-stage')).not.toHaveClass(/is-zoomed/);
  await viewer.getByRole('button', { name: '图片信息' }).click();
  await expect(info).toBeHidden();
  await viewer.getByRole('button', { name: '图片信息' }).click();
  await page.goBack();
  await expect(viewer).not.toBeVisible();
  await expect(page).toHaveURL(/\?tag=night$/);
  // A shared link opens the same photo directly; closing returns focus to its tile.
  await page.goto(`/albums/city-corners/${hash}`);
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
  await expect(page.locator(`${hash} a`)).toBeFocused();
});

test('viewer switches photos with a touch swipe', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/albums/city-corners/');
  await page.locator('.photo-tile a').first().click();
  await expect(page.locator('.viewer-count')).toHaveText('1 / 8');
  const stage = page.locator('.viewer-stage');
  const box = (await stage.boundingBox())!;
  const y = box.y + box.height / 2;
  const touch = (clientX: number) => ({ pointerId: 1, pointerType: 'touch', clientX, clientY: y });
  await stage.dispatchEvent('pointerdown', touch(300));
  await stage.dispatchEvent('pointermove', touch(180));
  await stage.dispatchEvent('pointerup', touch(120));
  await expect(page.locator('.viewer-count')).toHaveText('2 / 8');
  await context.close();
});

test('photo pages pass accessibility checks in light and dark themes', async ({ page }) => {
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of ['/albums/', '/albums/city-corners/', '/photos/']) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(serious(results.violations), `${scheme} ${path}`).toEqual([]);
    }
    await page.locator('.photo-tile a').first().click();
    await expect(page.locator('.viewer-image')).toHaveClass(/is-ready/);
    // Let the opening fade finish so contrast is measured on the final colours.
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).include('.viewer').analyze();
    expect(serious(results.violations), `${scheme} viewer`).toEqual([]);
  }
});

test('footer links to the editor and the header hides while scrolling down', async ({ page }) => {
  await page.goto('/posts/long-lines/');
  await expect(page.locator('.site-footer a[href="/admin/"]')).toHaveText('写作');
  const header = page.locator('[data-site-header]');
  await page.mouse.wheel(0, 1500);
  await expect(header).toHaveClass(/is-hidden/);
  await page.mouse.wheel(0, -300);
  await expect(header).not.toHaveClass(/is-hidden/);
});
