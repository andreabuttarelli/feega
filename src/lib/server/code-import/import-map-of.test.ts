import { describe, expect, it } from 'vitest';
import { PageState } from '$lib/canvas/import-map';
import { mapOf } from './import-map-of';
import { CodeImportOutcome, Missed, type CodeImported } from './import-code';
import { Locked } from './sign-in';
import { RouteKind, Router } from './routes-discover';
import type { RoutesFound } from './routes-found';

const route = (path: string, kind = RouteKind.Static, selected = true) => ({ path, file: `src/routes${path}/+page.svelte`, router: Router.SvelteKit, kind, params: [], selected, candidates: [] });

const FOUND: RoutesFound = {
  ok: true,
  framework: 'sveltekit' as never,
  app: '',
  routes: [route('/'), route('/pricing'), route('/about', RouteKind.Static, false), route('/account'), route('/blog/[slug]', RouteKind.Dynamic, false), route('/broken')]
};

const DONE = {
  outcome: CodeImportOutcome.Ok,
  frameId: 'f1',
  name: 'app',
  undo: [],
  skipped: [],
  truncated: false,
  pages: ['/', '/ · dark', '/pricing'],
  links: ['/blog/hello'],
  boards: [
    { label: '/', route: '/', cond: 'light@1280', clip: 'b1' },
    { label: '/ · dark', route: '/', cond: 'dark@1280', clip: 'b2' },
    { label: '/pricing', route: '/pricing', cond: 'light@1280', clip: 'b3' }
  ],
  missed: [{ label: '/broken', reason: Missed.Unopened }],
  locked: [{ label: '/account', reason: Locked.NoAccount }],
  components: 2,
  variants: 3,
  instances: 4,
  design: { tokens: 10, styles: 2, byClass: 5, byRule: 3, byValue: 1, unbound: 4 },
  library: { components: [{ name: 'Button', captured: true }, { name: 'Callout', captured: false }], uncaptured: ['Callout'] }
} as unknown as CodeImported & { outcome: CodeImportOutcome.Ok };

describe('the import map of one import', () => {
  it('gives every discovered route a state, and every imported page its boards', () => {
    const map = mapOf(FOUND, DONE, { asked: ['/', '/pricing', '/account', '/broken'], rev: 'abc' });

    const state = Object.fromEntries(map.pages.map((p) => [p.path, p.state]));
    expect(state).toEqual({
      '/': PageState.Imported,
      '/pricing': PageState.Imported,
      '/broken': PageState.Failed,
      '/account': PageState.Locked,
      '/about': PageState.NotSelected,
      '/blog/[slug]': PageState.NeedsValue
    });
    expect(map.pages.find((p) => p.path === '/')?.boards).toEqual([
      { cond: 'light@1280', clip: 'b1' },
      { cond: 'dark@1280', clip: 'b2' }
    ]);
    expect(map.pages.find((p) => p.path === '/broken')?.reason).toBe(Missed.Unopened);
    expect(map.rev).toBe('abc');
  });

  it('counts bound layers across the three kinds of evidence and keeps the code-only components', () => {
    const map = mapOf(FOUND, DONE, { asked: ['/'], rev: null });

    expect(map.design).toEqual({ tokens: 10, styles: 2, bound: 9, unbound: 4 });
    expect(map.library).toEqual({ captured: ['Button'], uncaptured: ['Callout'] });
  });

  it('says why the route list is missing when discovery could not run', () => {
    const map = mapOf({ ok: false, error: 'unreadable', detail: 'no file list', apps: [] }, DONE, { asked: ['/'], rev: null });

    expect(map.unrun).toBe('unreadable: no file list');
    expect(map.pages.map((p) => p.path)).toEqual(['/', '/pricing', '/broken', '/account']);
  });
});
