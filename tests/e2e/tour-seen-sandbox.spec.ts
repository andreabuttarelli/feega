import { test, expect } from '@playwright/test';
import { skipTour } from './fixtures/session';

test('skipping the tour throws nothing inside a sandboxed preview frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await skipTour(page);
  await page.setContent('<html><body></body></html>');

  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        const frame = document.createElement('iframe');
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.srcdoc = '<p>preview</p>';
        frame.onload = () => done();
        document.body.appendChild(frame);
      })
  );

  expect(errors).toEqual([]);
});
