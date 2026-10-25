import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable } from '$lib/motion/variables';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { canvasVariable, type VariableFrames } from './canvas-variables';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const shape = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's'));
const SURFACE = { type: VarType.Colour, values: { Light: '#ffffff', Dark: '#101010' } } as const;
const themed = () => must(defineVariable(shape(), 'Theme', 'surface', SURFACE, ['Light', 'Dark']));

function frames(docs: Record<string, MotionDoc>): VariableFrames & { docs: Record<string, MotionDoc> } {
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

const fillOf = (doc: MotionDoc) => findClip(doc, 's')!.clip.props.fill;

describe('the canvas variables library over MCP', () => {
  it('lists every frame collection', async () => {
    const store = frames({ a: themed(), b: shape() });
    const out = await canvasVariable(store, {});
    expect(out).toMatchObject({ ok: true, variables: { Theme: { modes: ['Light', 'Dark'] } } });
  });

  it('defining a value updates every frame that owns the collection and recolours them in their own mode', async () => {
    const bound = must(bindVariable(themed(), 's', 'fill', 'Theme/surface'));
    const store = frames({ a: bound, b: bound, c: shape() });
    store.docs.b = must({ ok: true, doc: { ...bound, variables: { Theme: { ...bound.variables!.Theme, active: 'Dark' } } } });
    const out = await canvasVariable(store, { collection: 'Theme', name: 'surface', type: VarType.Colour, values: { Light: '#cccccc', Dark: '#202020' } });
    expect(out).toMatchObject({ ok: true, frames: ['a', 'b'] });
    expect(fillOf(store.docs.a)).toBe('#cccccc');
    expect(fillOf(store.docs.b)).toBe('#202020');
    expect(store.docs.c.variables).toBeUndefined();
  });

  it('defining a collection no frame has needs the frames to put it in', async () => {
    const store = frames({ a: shape(), b: shape() });
    const missing = await canvasVariable(store, { collection: 'Theme', name: 'surface', type: VarType.Colour, values: { Default: '#ffffff' } });
    expect(missing).toMatchObject({ ok: false });
    const out = await canvasVariable(store, { collection: 'Theme', name: 'surface', type: VarType.Colour, values: { Default: '#ffffff' }, frames: ['b'] });
    expect(out).toMatchObject({ ok: true, frames: ['b'] });
    expect(store.docs.a.variables).toBeUndefined();
  });

  it('switching the mode of a frame leaves the others', async () => {
    const bound = must(bindVariable(themed(), 's', 'fill', 'Theme/surface'));
    const store = frames({ a: bound, b: bound });
    const out = await canvasVariable(store, { collection: 'Theme', mode: 'Dark', frames: ['a'] });
    expect(out).toMatchObject({ ok: true, frames: ['a'] });
    expect(fillOf(store.docs.a)).toBe('#101010');
    expect(fillOf(store.docs.b)).toBe('#ffffff');
  });

  it('switching with no frame named switches every frame that owns the collection', async () => {
    const bound = must(bindVariable(themed(), 's', 'fill', 'Theme/surface'));
    const store = frames({ a: bound, b: bound });
    await canvasVariable(store, { collection: 'Theme', mode: 'Dark' });
    expect([fillOf(store.docs.a), fillOf(store.docs.b)]).toEqual(['#101010', '#101010']);
  });

  it('binding an element of a frame without the collection copies it there', async () => {
    const store = frames({ a: themed(), b: shape() });
    const out = await canvasVariable(store, { collection: 'Theme', name: 'surface', ids: ['b:s'], target: 'fill' });
    expect(out).toMatchObject({ ok: true });
    expect(findClip(store.docs.b, 's')!.clip.bind).toEqual({ fill: 'Theme/surface' });
    expect(fillOf(store.docs.b)).toBe('#ffffff');
  });
});
