import { describe, expect, it } from 'vitest';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { ProviderCall } from '$lib/server/connections/account-links';
import { openPullRequest, rebased } from './repo-sync';

const text = (id: string, at: string, now: string, was: string) => ({ id, component: 'Text', props: { text: now }, source: { at, was: { text: was } } });
const docOf = (...clips: unknown[]) => ({ width: 100, height: 100, tracks: [{ clips }], comps: {} }) as unknown as MotionDoc;
const textsOf = (doc: MotionDoc) => doc.tracks[0].clips.map((c) => c.props.text);

describe('rebased', () => {
  it('una modifica locale sopravvive a un pull che non tocca quell’elemento, anche se le righe si spostano', () => {
    const local = docOf(text('a', 'p.svelte:5:2', 'Mio titolo', 'Titolo'));
    const upstream = docOf(text('x', 'p.svelte:9:2', 'Titolo', 'Titolo'), text('y', 'p.svelte:3:2', 'Riga nuova', 'Riga nuova'));
    const done = rebased(local, upstream);
    expect(textsOf(done.doc)).toEqual(['Mio titolo', 'Riga nuova']);
    expect(done.carried).toBe(1);
    expect(done.conflicts).toEqual([]);
  });

  it('se GitHub ha cambiato la stessa cosa vince GitHub, e il conflitto viene detto', () => {
    const local = docOf(text('a', 'p.svelte:5:2', 'Mio titolo', 'Titolo'));
    const upstream = docOf(text('x', 'p.svelte:5:2', 'Titolo da GitHub', 'Titolo da GitHub'));
    const done = rebased(local, upstream);
    expect(textsOf(done.doc)).toEqual(['Titolo da GitHub']);
    expect(done.conflicts[0]).toMatch(/p\.svelte:5/);
  });
});

describe('rebased con condizioni', () => {
  it('una modifica fatta sotto dark torna sul clip dark, non su quello chiaro con la stessa riga', () => {
    const fill = (id: string, at: string, color: string, cond?: string) => ({ id, component: 'Rectangle', props: { fills: [{ type: 'solid', color }] }, source: { at, ...(cond ? { cond } : {}), was: { fill: '#ffffff' } } });
    const local = docOf(fill('a', 'p.svelte:5:2', '#ffffff'), fill('b', 'p.svelte:5:2', '#101010', 'dark@1280'));
    const upstream = docOf(fill('y', 'p.svelte:8:2', '#ffffff', 'dark@1280'), fill('x', 'p.svelte:8:2', '#ffffff'));
    const done = rebased(local, upstream);
    const colours = done.doc.tracks[0].clips.map((c) => (c.props.fills as { color: string }[])[0].color);
    expect(colours).toEqual(['#101010', '#ffffff']);
    expect(done.carried).toBe(1);
  });
});

describe('openPullRequest', () => {
  it('apre un branch nuovo e la PR verso il default, mai un commit sul default', async () => {
    const calls: ProviderCall[] = [];
    const call = async (request: ProviderCall) => {
      calls.push(request);
      const answers: Record<string, unknown> = { '/repos/o/r': { default_branch: 'main' }, '/repos/o/r/contents/a.svelte': { sha: 'blob1' }, '/repos/o/r/pulls': { html_url: 'https://github.com/o/r/pull/7', number: 7 } };
      return { status: 200, data: answers[request.endpoint] ?? {}, headers: {}, file: null };
    };
    const pr = await openPullRequest(call, { owner: 'o', repo: 'r', ref: null }, { base: 'abc123', branch: 'feega/edit-1', title: 'Edit from feega', files: [{ path: 'a.svelte', before: 'x', after: 'y' }] });
    expect(pr).toEqual({ url: 'https://github.com/o/r/pull/7', branch: 'feega/edit-1' });
    const writes = calls.filter((c) => c.method && c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${c.endpoint}`)).toEqual(['POST /repos/o/r/git/refs', 'PUT /repos/o/r/contents/a.svelte', 'POST /repos/o/r/pulls']);
    expect(writes[1].body).toMatchObject({ branch: 'feega/edit-1', sha: 'blob1' });
    expect(writes[2].body).toMatchObject({ head: 'feega/edit-1', base: 'main' });
  });

  it('rifiuta un branch uguale a quello di default', async () => {
    const call = async () => ({ status: 200, data: { default_branch: 'main' }, headers: {}, file: null });
    await expect(openPullRequest(call, { owner: 'o', repo: 'r', ref: null }, { base: 'a', branch: 'main', title: 't', files: [] })).resolves.toBeNull();
  });
});

describe('baselined', () => {
  it('dopo la scrittura nella cartella il valore scritto diventa la base, così la modifica non si riscrive due volte', async () => {
    const { baselined } = await import('$lib/canvas/code-look');
    const done = baselined(docOf(text('a', 'p.svelte:5:2', 'Mio titolo', 'Titolo')));
    expect(done.tracks[0].clips[0].source).toEqual({ at: 'p.svelte:5:2', was: { text: 'Mio titolo' } });
  });
});
