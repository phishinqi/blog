import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('empty friends list offers four fields and saves structured entries', async ({ page }) => {
  const config = JSON.parse(readFileSync('cms.config.github.json', 'utf8'));
  config.backend = {
    name: 'local',
    local: {
      kind: 'memory',
      files: {
        'data/friends.json': JSON.stringify({ friends: [] }),
      },
    },
  };
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(
      /(<script[^>]*id="v7-config"[^>]*>).*?(<\/script>)/s,
      (_, before, after) => before + JSON.stringify(config).replace(/</g, '\\u003c') + after,
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto('/admin/');
  await page.getByRole('button', { name: '友链', exact: true }).click();
  await page.getByRole('button', { name: '添加 友链', exact: true }).click();
  const values = {
    name: 'Example',
    link: 'https://example.com',
    avatar: 'https://example.com/avatar.png',
    desc: 'A friend',
  };
  for (const [key, value] of Object.entries(values))
    await page.locator(`#friends-0-${key}-field`).fill(value);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '作者', exact: true }).click();
  await page.getByRole('button', { name: '友链', exact: true }).click();
  for (const [key, value] of Object.entries(values))
    await expect(page.locator(`#friends-0-${key}-field`)).toHaveValue(value);
});
