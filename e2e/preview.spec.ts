import { writeFileSync, mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('health endpoint answers', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok' });
});

test('routine screen renders with no axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel('Name')).toBeVisible();
  await expect(page.getByLabel('Brand')).toBeVisible();
  await expect(page.getByLabel('Step')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Session' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add product to routine' })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/axe.json', JSON.stringify(results, null, 2) + '\n');
  expect(results.violations).toEqual([]);
});
