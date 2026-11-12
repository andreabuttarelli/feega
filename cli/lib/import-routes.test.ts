import { describe, expect, it } from 'bun:test';
import { routesPlan, RoutesStep } from './import-routes.ts';

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
