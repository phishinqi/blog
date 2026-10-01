import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('media settings offers three destinations and persists independent repository settings', async ({
  page,
}) => {
  const config = JSON.parse(readFileSync('cms.config.github.json', 'utf8'));
  const site = JSON.parse(readFileSync('site.config.json', 'utf8'));
  config.backend = {
    name: 'local',
    local: {
      kind: 'memory',
      files: { 'site.config.json': JSON.stringify(site) },
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
  await page.getByRole('button', { name: '站点设置', exact: true }).click();
  const provider = page.locator('#media-provider-field');
  await expect(provider).toHaveValue(site.media.provider);
  await expect(provider.locator('option')).toContainText([
    '—',
    '博客仓库固定目录',
    'R2 Bucket',
    '独立 Media Repo',
  ]);
  await provider.selectOption('media-repo');
  await page.locator('#media-mediaRepo-field').fill('owner/images');
  await page.locator('#media-mediaPublicUrl-field').fill('https://img.example/images');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '作者', exact: true }).click();
  await page.getByRole('button', { name: '站点设置', exact: true }).click();
  await expect(provider).toHaveValue('media-repo');
  await expect(page.locator('#media-mediaRepo-field')).toHaveValue('owner/images');
});
