import { describe, expect, it } from 'vitest';
import { EDITOR_PRELOAD } from './pages';

const pages = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'));

const routeOf = (file: string) => new RegExp(`^${file.replace('/src/routes', '').replace('/+page.svelte', '').replace(/\/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '[^/]+')}$`);

describe('the editor the home preloads', () => {
  it('is a page that exists, or the dev client logs that it matches no route', () => {
    expect(pages.some((file) => routeOf(file).test(EDITOR_PRELOAD))).toBe(true);
  });
});
