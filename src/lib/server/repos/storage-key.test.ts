import { describe, expect, it } from 'vitest';
import { storageName } from './storage-key';

const SUPABASE_KEY = /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/;

describe('storageName', () => {
  it('turns an imported page title into a name Supabase Storage accepts', () => {
    const name = storageName('Linear – The system for product development.png');

    expect(name).toMatch(SUPABASE_KEY);
    expect(name).toBe('Linear - The system for product development.png');
  });

  it('keeps letters without their accents and drops what has no ASCII form', () => {
    expect(storageName('Café 東京 ✨.jpg')).toBe('Cafe - -.jpg');
  });

  it('leaves an ASCII name as it is', () => {
    expect(storageName('Frame@2x.webp')).toBe('Frame@2x.webp');
  });
});
