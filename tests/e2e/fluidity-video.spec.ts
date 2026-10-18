import { test, expect } from '@playwright/test';
import { recordsVideo } from './fixtures/fluidity-report';

test('WebKit non registra video: lo screencast di Playwright porta rAF a 1 fps anche su about:blank', () => {
  expect(recordsVideo('webkit')).toBe(false);
  expect(recordsVideo('chromium')).toBe(true);
});
