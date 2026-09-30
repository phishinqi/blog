import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('real Chinese and English queries, URL hydration and no-results state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/search/?q=公式');
  const input = page.getByRole('searchbox');
  await expect(input).toHaveValue('公式');
  await expect(page.locator('.search-result').first()).toBeVisible();
  await expect(page.locator('.search-results')).toContainText('让公式与流程图');
  await input.fill('progressive');
  await expect(page.locator('.search-results')).toContainText('A smaller web');
  await expect(page).toHaveURL(/q=progressive/);
  await input.fill('UnpublishedSentinelSecret');
  await expect(page.locator('.search-status')).toContainText('没有');
  await input.fill('');
  await expect(page).toHaveURL(/\/search\/$/);
  await expect(page.locator('.search-results')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keyboard dialog traps focus, restores trigger, and shares search results', async ({
  page,
}) => {
  await page.goto('/');
  // Wait for the idle-hydrated React island, not an arbitrary sleep.
  await page
    .locator('astro-island[component-export="default"]')
    .first()
    .waitFor({ state: 'attached' });
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].some((el) => !el.hasAttribute('ssr')),
  );
  const trigger = page.locator('[data-search-trigger]');
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await dialog.getByRole('searchbox').fill('progressive');
  await expect(dialog.locator('.search-results')).toContainText('A smaller web');
  const last = dialog.getByRole('link', { name: /完整搜索页/ });
  await last.focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: '关闭搜索' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(
    audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact || '')),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '关闭搜索' }).click();
  await expect(trigger).toBeFocused();
});

test('search failure can be retried and stale responses do not overwrite a new query', async ({
  page,
}) => {
  await page.route('**/pagefind/wasm.*', (route) => route.abort());
  await page.goto('/search/?q=公式');
  await expect(page.getByRole('button', { name: /^重试/ })).toBeVisible({ timeout: 15000 });
  await page.unroute('**/pagefind/wasm.*');
  await page.getByRole('button', { name: /^重试/ }).click();
  await expect(page.locator('.search-results')).toContainText('让公式与流程图');
  await page.getByRole('searchbox').fill('公式');
  await page.getByRole('searchbox').fill('progressive');
  await expect(page.locator('.search-results')).toContainText('A smaller web');
  await expect(page.locator('.search-results')).not.toContainText('让公式与流程图');
});
