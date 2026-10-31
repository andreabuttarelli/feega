import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { applyStyle, defineStyle } from '$lib/motion/styles';
import { StyleKind } from '@feega/motion-core/motion/styles-model';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { canvasStyle, type StyleFrames } from './canvas-styles';
import { LibraryOp } from '$lib/motion/project-library-ops';
import type { Style } from '@feega/motion-core/motion/styles-model';
import type { Library } from '$lib/motion/style-library';

const RED = { kind: StyleKind.Colour, color: '#ff0000' } as const;
const BLUE = { kind: StyleKind.Colour, color: '#0000ff' } as const;

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const textDoc = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'a' } }, 't'));

function frames(docs: Record<string, MotionDoc>, saved: Library = {}): StyleFrames & { docs: Record<string, MotionDoc>; saved: Library } {
  const versions: Record<string, number> = Object.fromEntries(Object.keys(docs).map((id) => [id, 1]));
  return {
    docs,
    saved,
    project: {
      load: async () => ({ ...saved }),
      run: async (ask) => {
        const ran: Record<LibraryOp, () => void> = {
          [LibraryOp.Save]: () => ask.op === LibraryOp.Save && (saved[ask.name] = ask.value as Style),
          [LibraryOp.Adopt]: () => ask.op === LibraryOp.Adopt && Object.entries(ask.entries).forEach(([n, st]) => (saved[n] ??= st as Style)),
          [LibraryOp.Rename]: () => {
            if (ask.op === LibraryOp.Rename) {
              saved[ask.to] = saved[ask.name];
              delete saved[ask.name];
            }
          },
          [LibraryOp.Remove]: () => ask.op === LibraryOp.Remove && delete saved[ask.name]
        };
        ran[ask.op]();
        return { ok: true, entries: { ...saved } };
      }
    },
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
    const store = frames({ a: must(applyStyle(must(defineStyle(textDoc(), 'Brand', RED)), ['t'], 'Brand')), b: textDoc() });
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

  it('listing adopts the styles found in frames into the project library', async () => {
    const store = frames({ a: must(defineStyle(textDoc(), 'Brand', RED)) }, { Headline: { kind: StyleKind.Text, size: 0.2 } });

    expect(await canvasStyle(store, {})).toEqual({ ok: true, styles: { Headline: { kind: StyleKind.Text, size: 0.2 }, Brand: RED } });
    expect(store.saved.Brand).toEqual(RED);
  });

  it('defining saves the style to the project, so frames on other pages follow it', async () => {
    const store = frames({ b: textDoc() });

    await canvasStyle(store, { name: 'Brand', style: BLUE });

    expect(store.saved.Brand).toEqual(BLUE);
  });

  it('a project style applies to an element even when no frame on the canvas has it yet', async () => {
    const store = frames({ b: textDoc() }, { Brand: RED });

    expect(await canvasStyle(store, { name: 'Brand', ids: ['b:t'] })).toMatchObject({ ok: true });
    expect(findClip(store.docs.b, 't')!.clip.props.color).toBe('#ff0000');
  });

  it('removing a style takes it out of the project and detaches its elements', async () => {
    const linked = (d: MotionDoc) => ({ ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, styleRef: 'Brand' })) })) });
    const store = frames({ a: linked(must(defineStyle(textDoc(), 'Brand', RED))) }, { Brand: RED });

    expect(await canvasStyle(store, { name: 'Brand', remove: true })).toMatchObject({ ok: true, frames: ['a'] });
    expect(store.saved).toEqual({});
    expect(findClip(store.docs.a, 't')!.clip.styleRef).toBeUndefined();
  });
});
