import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('appearance settings explain units in Chinese and save numeric values', async ({ page }) => {
  const config = JSON.parse(readFileSync('cms.config.github.json', 'utf8'));
  const site = JSON.parse(readFileSync('site.config.json', 'utf8'));
  config.backend = {
    name: 'local',
    local: { kind: 'memory', files: { 'site.config.json': JSON.stringify(site) } },
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
  const speed = page.getByRole('spinbutton', { name: /^漂移速度（倍）/ });
  const amplitude = page.getByRole('spinbutton', { name: /^移动幅度（像素）/ });
  await expect(speed).toHaveAttribute('type', 'number');
  await expect(amplitude).toHaveAttribute('type', 'number');
  await expect(page.getByRole('spinbutton', { name: /^文章主标题字号（rem）/ })).toHaveAttribute(
    'type',
    'number',
  );
  await expect(page.getByRole('combobox', { name: /^显示范围/ }).locator('option')).toContainText([
    '—',
    '所有访客页面',
    '仅文章页',
    '关闭',
  ]);
  await speed.fill('1.5');
  await amplitude.fill('12');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '作者', exact: true }).click();
  await page.getByRole('button', { name: '站点设置', exact: true }).click();
  await expect(speed).toHaveValue('1.5');
  await expect(amplitude).toHaveValue('12');
});
