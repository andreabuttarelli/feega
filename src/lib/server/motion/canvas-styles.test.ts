import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { defineStyle } from '$lib/motion/styles';
import { StyleKind } from '$lib/motion/styles-model';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { canvasStyle, type StyleFrames } from './canvas-styles';

const RED = { kind: StyleKind.Colour, color: '#ff0000' } as const;
const BLUE = { kind: StyleKind.Colour, color: '#0000ff' } as const;

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const textDoc = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a' } }, 't'));

function frames(docs: Record<string, MotionDoc>): StyleFrames & { docs: Record<string, MotionDoc> } {
  const versions: Record<string, number> = Object.fromEntries(Object.keys(docs).map((id) => [id, 1]));
  return {
    docs,
    ids: async () => Object.keys(docs),
    read: async (id) => (docs[id] ? { version: versions[id], doc: docs[id] } : null),
    write: async (id, version, doc) => {
      if (versions[id] !== version) {
        return { outcome: RevisionOutcome.Conflict };
      }
      versions[id] += 1;
      docs[id] = doc;
      return { outcome: RevisionOutcome.Written, head: { version: versions[id], doc, summary: null, actorKind: 'user' } };
    }
  };
}

describe('the canvas styles library over MCP', () => {
  it('lists every frame style', async () => {
    const store = frames({ a: must(defineStyle(textDoc(), 'Brand', RED)), b: textDoc() });
    expect(await canvasStyle(store, {})).toEqual({ ok: true, styles: { Brand: RED } });
  });

  it('defining restyles every frame that has the style', async () => {
    const a = must(defineStyle(textDoc(), 'Brand', RED));
    const store = frames({ a: must({ ok: true, doc: { ...a, tracks: a.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, styleRef: 'Brand' })) })) } }), b: textDoc() });
    const out = await canvasStyle(store, { name: 'Brand', style: BLUE });
    expect(out).toMatchObject({ ok: true, frames: ['a'] });
    expect(findClip(store.docs.a, 't')!.clip.props.color).toBe('#0000ff');
    expect(store.docs.b.styles).toBeUndefined();
  });

  it('applying a canvas style to an element of another frame copies it there', async () => {
    const store = frames({ a: must(defineStyle(textDoc(), 'Brand', RED)), b: textDoc() });
    const out = await canvasStyle(store, { name: 'Brand', ids: ['b:t'] });
    expect(out).toMatchObject({ ok: true });
    expect(findClip(store.docs.b, 't')!.clip.styleRef).toBe('Brand');
  });

  it('renaming changes the name in every frame that has it, keeping elements linked', async () => {
    const linked = (d: MotionDoc) => ({ ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, styleRef: 'Brand' })) })) });
    const store = frames({ a: linked(must(defineStyle(textDoc(), 'Brand', RED))), b: linked(must(defineStyle(textDoc(), 'Brand', RED))), c: textDoc() });
    const out = await canvasStyle(store, { name: 'Brand', to: 'Primary' });

    expect(out).toMatchObject({ ok: true, frames: ['a', 'b'] });
    expect(store.docs.a.styles).toEqual({ Primary: RED });
    expect(findClip(store.docs.b, 't')!.clip.styleRef).toBe('Primary');
    expect(store.docs.c.styles).toBeUndefined();
  });

  it('refuses a new name another frame already uses', async () => {
    const store = frames({ a: must(defineStyle(textDoc(), 'Brand', RED)), b: must(defineStyle(textDoc(), 'Primary', BLUE)) });

    expect(await canvasStyle(store, { name: 'Brand', to: 'Primary' })).toMatchObject({ ok: false });
    expect(store.docs.a.styles).toEqual({ Brand: RED });
  });

  it('an effect style of one frame lands on an element of another', async () => {
    const lifted = { kind: StyleKind.Effect, effects: [{ id: 'sh', kind: 'drop-shadow', enabled: true, params: { blur: 20 } }] } as const;
    const store = frames({ a: must(defineStyle(textDoc(), 'Lifted', lifted)), b: textDoc() });
    const out = await canvasStyle(store, { name: 'Lifted', ids: ['b:t'] });
    expect(out).toMatchObject({ ok: true });
    expect(findClip(store.docs.b, 't')!.clip.effects).toMatchObject([{ kind: 'drop-shadow', params: { blur: 20 } }]);
    expect(findClip(store.docs.b, 't')!.clip.effectStyleRef).toBe('Lifted');
  });

  it('renaming an effect style changes it in every frame, keeping the effect slot linked', async () => {
    const lifted = { kind: StyleKind.Effect, effects: [{ id: 'sh', kind: 'drop-shadow', enabled: true, params: { blur: 20 } }] } as const;
    const linked = (d: MotionDoc) => ({ ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, effectStyleRef: 'Lifted' })) })) });
    const store = frames({ a: linked(must(defineStyle(textDoc(), 'Lifted', lifted))), b: linked(must(defineStyle(textDoc(), 'Lifted', lifted))) });
    const out = await canvasStyle(store, { name: 'Lifted', to: 'Raised' });

    expect(out).toMatchObject({ ok: true, frames: ['a', 'b'] });
    expect(findClip(store.docs.b, 't')!.clip.effectStyleRef).toBe('Raised');
  });
});
