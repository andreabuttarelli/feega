import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-seal' } }));

const { sealSecret, openSecret } = await import('./seal');

describe('a sealed secret hides its text and opens only in its own context', () => {
  it('opens back to the text and does not show it', () => {
    const sealed = sealSecret('figma', 'figd_abc');
    expect(sealed).not.toContain('figd');
    expect(openSecret('figma', sealed)).toBe('figd_abc');
  });

  it('refuses another context, a tampered seal and garbage', () => {
    const sealed = sealSecret('figma', 'figd_abc');
    expect(openSecret('other', sealed)).toBeNull();
    expect(openSecret('figma', `${sealed.slice(0, -2)}xx`)).toBeNull();
    expect(openSecret('figma', 'garbage')).toBeNull();
  });
});
