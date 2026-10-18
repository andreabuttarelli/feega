import { test, expect } from '@playwright/test';
import { refuseModelSpend } from './fixtures/session';

const SPENDING = ['/api/v1/projects/p1/agent', '/api/v1/projects/p1/motion/n1/agent', '/api/v1/org/nodes/n1/generate', '/p/p1/c/c1?/run'];

test.describe('a spec never reaches a real model', () => {
  test.skip(process.env.E2E_ALLOW_SPEND === '1', 'spesa permessa esplicitamente');

  test('an unmocked agent turn or generation is cut in the browser and reported', async ({ browser }) => {
    const page = await browser.newPage();
    const refused = await refuseModelSpend(page);
    await page.goto('/login');

    const reached = await page.evaluate(
      (urls) => Promise.all(urls.map((url) => fetch(url, { method: 'POST', body: '{}' }).then(() => true, () => false))),
      SPENDING
    );

    expect(reached, 'none of them left the browser').toEqual(SPENDING.map(() => false));
    expect(refused.map((url) => new URL(url).pathname + new URL(url).search)).toEqual(SPENDING);
    await page.close();
  });
});
