import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ building: false, browser: false }));
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_APP_URL: 'https://oh.feega.app' } }));

const { reroute } = await import('./hooks');

const at = (href: string) => reroute({ url: new URL(href), fetch } as Parameters<typeof reroute>[0]);

describe('reroute', () => {
  it('the app host keeps its own routes', () => {
    expect(at('https://oh.feega.app/login')).toBeUndefined();
  });
});
