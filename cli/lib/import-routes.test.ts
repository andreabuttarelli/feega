import { describe, expect, it } from 'bun:test';
import { codeSource, routesPlan, RoutesStep } from './import-routes.ts';

describe('routesPlan: what --routes asks of import-code', () => {
  it.each([
    { name: 'discover lists the pages, imports nothing', spec: 'discover', route: ['/'], expected: { step: RoutesStep.Discover } },
    { name: 'all imports every static page found', spec: 'all', route: ['/'], expected: { step: RoutesStep.Import, routes: 'all' } },
    { name: 'a list, by commas or spaces', spec: '/, /pricing /blog/hello', route: ['/'], expected: { step: RoutesStep.Import, routes: ['/', '/pricing', '/blog/hello'] } },
    { name: 'no --routes keeps the typed --route pages', spec: undefined, route: ['/', '/x'], expected: { step: RoutesStep.Import, routes: ['/', '/x'] } }
  ])('$name', ({ spec, route, expected }) => {
    expect(routesPlan(spec, route)).toEqual(expected);
  });
});

describe('codeSource: where import-code reads the code from', () => {
  it.each([
    { name: 'a GitHub link', repo: 'https://github.com/a/b', into: undefined, expected: { repo: 'https://github.com/a/b' } },
    { name: 'a local folder', repo: '/Users/me/app', into: undefined, expected: { folder: '/Users/me/app' } },
    { name: '--into a frame: no source, the frame knows its code', repo: undefined, into: 'f1', expected: { into: 'f1' } },
    { name: 'neither', repo: undefined, into: undefined, expected: null },
    { name: 'both is refused', repo: 'https://github.com/a/b', into: 'f1', expected: null }
  ])('$name', ({ repo, into, expected }) => {
    expect(codeSource(repo, into)).toEqual(expected);
  });
});
