import { describe, expect, it } from 'vitest';
import { LibFramework, type InsertItem } from '@feega/live-edit/library-insert';
import { CloudError, CloudFailure } from './cloud-api';
import { INCLUDED_IN_CLOUD } from './library';
import { ProRefusal, SIGN_IN_FOR_PRO, frameworkOf, withProFiles } from './pro-insert';

const EMPTY: InsertItem = { id: 'hover-reveal', component: 'HoverReveal', fonts: [], files: { svelte: [], react: [], vue: [], astro: [] } };

const files = (path: string) => async () => [{ path, content: '<div />' }];
const failing = (failure: CloudFailure) => async () => Promise.reject(new CloudError(failure, 'nope', 402));

describe('withProFiles', () => {
  it('puts the fetched files in the slot of the project framework', async () => {
    const out = await withProFiles(EMPTY, LibFramework.Svelte, files('HoverReveal.svelte'));

    expect(out).toEqual({ ok: true, item: { ...EMPTY, files: { ...EMPTY.files, svelte: [{ name: 'HoverReveal.svelte', text: '<div />' }] } } });
  });

  it('asks the server for that framework only', async () => {
    const asked: string[] = [];

    await withProFiles(EMPTY, LibFramework.Vue, async (id, framework) => {
      asked.push(`${id}:${framework}`);

      return [];
    });

    expect(asked).toEqual(['hover-reveal:vue']);
  });

  it('asks to sign in when the user is not signed in', async () => {
    expect(await withProFiles(EMPTY, LibFramework.Svelte, failing(CloudFailure.NotSignedIn))).toEqual({ ok: false, reason: SIGN_IN_FOR_PRO, refusal: ProRefusal.SignIn });
  });

  it('keeps the Cloud lock when the plan does not include it', async () => {
    expect(await withProFiles(EMPTY, LibFramework.Svelte, failing(CloudFailure.PlanRequired))).toEqual({ ok: false, reason: INCLUDED_IN_CLOUD, refusal: ProRefusal.Plan });
  });

  it('reports any other failure with the server message and no prompt', async () => {
    expect(await withProFiles(EMPTY, LibFramework.Svelte, failing(CloudFailure.Http))).toEqual({ ok: false, reason: 'nope', refusal: null });
  });

  it('reports a network failure', async () => {
    const out = await withProFiles(EMPTY, LibFramework.Svelte, async () => Promise.reject(new Error('fetch failed')));

    expect(out).toEqual({ ok: false, reason: 'fetch failed', refusal: null });
  });
});

describe('frameworkOf', () => {
  it('reads the framework the library inserts for', () => {
    expect(frameworkOf(JSON.stringify({ dependencies: { '@sveltejs/kit': '2', svelte: '5' } }))).toBe(LibFramework.Svelte);
    expect(frameworkOf(JSON.stringify({ dependencies: { next: '15', react: '19' } }))).toBe(LibFramework.React);
    expect(frameworkOf(JSON.stringify({ dependencies: { nuxt: '3' } }))).toBe(LibFramework.Vue);
    expect(frameworkOf(JSON.stringify({ dependencies: { astro: '5' } }))).toBe(LibFramework.Astro);
  });

  it('is null for a project the library does not support', () => {
    expect(frameworkOf(JSON.stringify({ dependencies: { express: '4' } }))).toBeNull();
    expect(frameworkOf(null)).toBeNull();
  });
});
