import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, parseMotionDoc, findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { instanceTracks } from '@feega/motion-core/motion/layout/resolve';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable, inheritedModeOf, layerModeOf, resolveVariables, setActiveMode, setLayerMode } from './variables';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { duplicateInPlace } from './duplicate-in-place';

function ok(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const SURFACE = { type: VarType.Colour, values: { Light: '#ffffff', Dark: '#101010' } } as const;
const INK = { type: VarType.Colour, values: { Light: '#111111', Dark: '#f0f0f0' } } as const;

const clip = (id: string, component: MotionClip['component'], props: Record<string, unknown>, parent: string | null = null) => ({ ...newClip({ id, from: 0, durationInFrames: 30, component, props }), parent });

function boards(): MotionDoc {
  const base = newMotionDoc(MotionFormat.Square);
  const clips = [
    clip('light', 'Shape', { shape: 'rect', fill: '#000000' }),
    clip('l-card', 'Shape', { shape: 'rect', fill: '#000000' }, 'light'),
    clip('dark', 'Shape', { shape: 'rect', fill: '#000000' }),
    clip('d-group', 'Shape', { shape: 'rect', fill: '#000000' }, 'dark'),
    clip('d-card', 'Shape', { shape: 'rect', fill: '#000000' }, 'd-group')
  ];
  const doc = { ...base, tracks: [{ id: 'v1', kind: 'visual', name: '', clips }] } as MotionDoc;
  const themed = ok(defineVariable(ok(defineVariable(doc, 'Theme', 'surface', SURFACE, ['Light', 'Dark'])), 'Theme', 'ink', INK));
  return ['light', 'l-card', 'dark', 'd-group', 'd-card'].reduce((d, id) => ok(bindVariable(d, id, 'fill', 'Theme/surface')), themed);
}

const fill = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip.props.fill;

describe('a mode below the frame', () => {
  it('a board set to Dark resolves itself and every descendant in Dark', () => {
    const doc = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    expect(['dark', 'd-group', 'd-card'].map((id) => fill(doc, id))).toEqual(['#101010', '#101010', '#101010']);
    expect(['light', 'l-card'].map((id) => fill(doc, id))).toEqual(['#ffffff', '#ffffff']);
  });

  it('the nearest ancestor override wins over a farther one', () => {
    const dark = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    const doc = ok(setLayerMode(dark, 'd-group', 'Theme', 'Light'));
    expect(['dark', 'd-group', 'd-card'].map((id) => fill(doc, id))).toEqual(['#101010', '#ffffff', '#ffffff']);
  });

  it('a layer without an override follows the frame mode, and an override stays put when the frame mode changes', () => {
    const doc = ok(setActiveMode(ok(setLayerMode(boards(), 'light', 'Theme', 'Light')), 'Theme', 'Dark'));
    expect(fill(doc, 'l-card')).toBe('#ffffff');
    expect(fill(doc, 'd-card')).toBe('#101010');
  });

  it('clearing the override returns the subtree to the frame mode', () => {
    const doc = ok(setLayerMode(ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark')), 'dark', 'Theme', null));
    expect(fill(doc, 'd-card')).toBe('#ffffff');
    expect(findClip(doc, 'dark')!.clip.modes).toBeUndefined();
  });

  it('an edit to a variable reaches both boards, each in its own mode', () => {
    const doc = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    const edited = ok(defineVariable(doc, 'Theme', 'surface', { type: VarType.Colour, values: { Light: '#eeeeee', Dark: '#222222' } }));
    expect([fill(edited, 'l-card'), fill(edited, 'd-card')]).toEqual(['#eeeeee', '#222222']);
  });

  it('an alias resolves in the mode the layer sees', () => {
    const doc = ok(defineVariable(boards(), 'Theme', 'card', { type: VarType.Colour, values: { Light: { alias: 'Theme/ink' }, Dark: { alias: 'Theme/ink' } } }));
    const bound = ok(setLayerMode(ok(bindVariable(doc, 'd-card', 'fill', 'Theme/card')), 'dark', 'Theme', 'Dark'));
    expect(fill(bound, 'd-card')).toBe('#f0f0f0');
  });

  it('an unknown collection or mode is refused, and an override whose mode vanished falls back to the frame', () => {
    expect(setLayerMode(boards(), 'dark', 'Nope', 'Dark').ok).toBe(false);
    expect(setLayerMode(boards(), 'dark', 'Theme', 'Sepia').ok).toBe(false);
    const doc = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    const shrunk = { ...doc, variables: { Theme: { ...doc.variables!.Theme, modes: ['Light'], vars: { surface: { type: VarType.Colour, values: { Light: '#ffffff' } }, ink: { type: VarType.Colour, values: { Light: '#111111' } } } } } } as MotionDoc;
    expect(fill(resolveVariables(shrunk), 'd-card')).toBe('#ffffff');
  });

  it('the panel reads the override of a layer and nothing for one without', () => {
    const doc = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    expect(layerModeOf(doc, 'dark', 'Theme')).toBe('Dark');
    expect(layerModeOf(doc, 'd-card', 'Theme')).toBeNull();
    expect(inheritedModeOf(doc, 'd-card', 'Theme')).toBe('Dark');
    expect(inheritedModeOf(doc, 'dark', 'Theme')).toBe('Light');
  });

  it('the override survives a save and a reload', () => {
    const doc = ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark'));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));
    expect(parsed.ok && findClip(parsed.doc, 'dark')!.clip.modes).toEqual({ Theme: 'Dark' });
  });

  it('a duplicated Dark board stays Dark and follows the next edit in Dark', () => {
    let n = 0;
    const copied = duplicateInPlace(ok(setLayerMode(boards(), 'dark', 'Theme', 'Dark')), 'dark', () => `copy${n++}`, null);
    if (!copied.ok) {
      throw new Error(copied.error);
    }
    expect(findClip(copied.doc, copied.id)!.clip.modes).toEqual({ Theme: 'Dark' });
    const edited = ok(defineVariable(copied.doc, 'Theme', 'surface', { type: VarType.Colour, values: { Light: '#eeeeee', Dark: '#333333' } }));
    const copies = edited.tracks[0].clips.filter((c) => c.id.startsWith('copy')).map((c) => c.props.fill);
    expect(new Set(copies)).toEqual(new Set(['#333333']));
  });

  it('a document without overrides resolves exactly as before', () => {
    const doc = boards();
    expect(resolveVariables(doc)).toEqual(doc);
    expect(JSON.stringify(resolveVariables(doc)).includes('modeValues')).toBe(false);
  });
});

function withInstance(): MotionDoc {
  const doc = boards();
  const inner = [clip('btn-bg', 'Shape', { shape: 'rect', fill: '#000000', width: 0.2, height: 0.1 }), clip('btn-label', 'Shape', { shape: 'rect', fill: '#000000', width: 0.1, height: 0.05 }, 'btn-bg')];
  const comps = { button: { name: 'Button', durationInFrames: 30, tracks: [{ id: 'cv', kind: 'visual', name: '', clips: inner }] } };
  const host = clip('d-btn', 'Precomp', { comp: 'button' }, 'd-group');
  const withComp = { ...doc, comps, tracks: [{ ...doc.tracks[0], clips: [...doc.tracks[0].clips, host] }] } as MotionDoc;
  const bound = { ...withComp, comps: { button: { ...comps.button, tracks: [{ ...comps.button.tracks[0], clips: [{ ...inner[0], bind: { fill: 'Theme/surface' } }, { ...inner[1], bind: { fill: 'Theme/ink' } }] }] } } } as MotionDoc;
  return resolveVariables(bound);
}

const innerFill = (doc: MotionDoc, hostId: string, innerId: string) => {
  const host = findClip(doc, hostId)!.clip;
  const tracks = instanceTracks(doc, host, doc.comps.button, { width: doc.width, height: doc.height });
  return tracks.flatMap((t) => t.clips).find((c) => c.id === innerId)!.props.fill;
};

describe('a component instance under a mode override', () => {
  it('the main resolves in the frame mode and an instance on a Dark board shows the main in Dark', () => {
    const doc = ok(setLayerMode(withInstance(), 'dark', 'Theme', 'Dark'));
    expect(doc.comps.button.tracks[0].clips[0].props.fill).toBe('#ffffff');
    expect([innerFill(doc, 'd-btn', 'btn-bg'), innerFill(doc, 'd-btn', 'btn-label')]).toEqual(['#101010', '#f0f0f0']);
  });

  it("an instance's own override still wins over the mode", () => {
    const doc = ok(setLayerMode(withInstance(), 'dark', 'Theme', 'Dark'));
    const host = findClip(doc, 'd-btn')!.clip;
    const overridden = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'd-btn' ? { ...host, props: { ...host.props, overrides: { 'btn-bg': { fill: '#ff0000' } } } } : c)) })) } as MotionDoc;
    expect(innerFill(resolveVariables(overridden), 'd-btn', 'btn-bg')).toBe('#ff0000');
  });

  it('back in the frame mode the instance carries no mode values', () => {
    const doc = ok(setLayerMode(ok(setLayerMode(withInstance(), 'dark', 'Theme', 'Dark')), 'dark', 'Theme', null));
    expect(findClip(doc, 'd-btn')!.clip.props.modeValues).toBeUndefined();
    expect(innerFill(doc, 'd-btn', 'btn-bg')).toBe('#ffffff');
  });

  it('the instance with mode values still parses', () => {
    const doc = ok(setLayerMode(withInstance(), 'dark', 'Theme', 'Dark'));
    expect(parseMotionDoc(JSON.parse(JSON.stringify(doc))).ok).toBe(true);
  });
});
