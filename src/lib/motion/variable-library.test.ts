import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable, setActiveMode } from './variables';
import { adoptCollection, bindFromLibrary, syncedCollection, variableLibraryOf } from './variable-library';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = () => must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 's'));
const themed = (doc: MotionDoc, light = '#ffffff') => must(defineVariable(doc, 'Theme', 'surface', { type: VarType.Colour, values: { Light: light, Dark: '#101010' } }, ['Light', 'Dark']));

describe('the variables library shared by the frames of a canvas', () => {
  it('is every frame collection, the first frame winning a name', () => {
    const a = themed(shape());
    const b = themed(shape(), '#eeeeee');
    const c = must(defineVariable(shape(), 'Space', 'm', { type: VarType.Number, values: { Default: 8 } }));
    expect(Object.keys(variableLibraryOf([a, b, c]))).toEqual(['Theme', 'Space']);
    expect(variableLibraryOf([a, b]).Theme.vars.surface.values.Light).toBe('#ffffff');
  });

  it('binding a variable a frame lacks copies the collection in first', () => {
    const library = variableLibraryOf([themed(shape())]);
    const adopted = must(adoptCollection(shape(), 'Theme', library.Theme));
    const bound = must(bindVariable(adopted, 's', 'fill', 'Theme/surface'));
    expect(findClip(bound, 's')!.clip.props.fill).toBe('#ffffff');
  });

  it('adopting keeps the frame mode when the frame already has the collection', () => {
    const dark = must(setActiveMode(themed(shape()), 'Theme', 'Dark'));
    const adopted = must(adoptCollection(dark, 'Theme', variableLibraryOf([themed(shape(), '#eeeeee')]).Theme));
    expect(adopted.variables!.Theme.active).toBe('Dark');
    expect(adopted.variables!.Theme.vars.surface.values.Light).toBe('#ffffff');
  });

  it('editing a collection re-resolves the frames that own it, each in its own mode', () => {
    const light = must(bindVariable(themed(shape()), 's', 'fill', 'Theme/surface'));
    const dark = must(setActiveMode(light, 'Theme', 'Dark'));
    const edited = variableLibraryOf([themed(shape(), '#cccccc')]).Theme;
    expect(findClip(syncedCollection(light, 'Theme', edited)!, 's')!.clip.props.fill).toBe('#cccccc');
    expect(findClip(syncedCollection(dark, 'Theme', edited)!, 's')!.clip.props.fill).toBe('#101010');
  });

  it('a frame without the collection is left alone', () => {
    expect(syncedCollection(shape(), 'Theme', variableLibraryOf([themed(shape())]).Theme)).toBeNull();
  });

  it('binding from the library copies the collection in and binds in one step', () => {
    const library = variableLibraryOf([themed(shape())]);
    const bound = must(bindFromLibrary(shape(), library, 's', 'fill', 'Theme/surface'));
    expect(findClip(bound, 's')!.clip.bind).toEqual({ fill: 'Theme/surface' });
    expect(findClip(bound, 's')!.clip.props.fill).toBe('#ffffff');
  });

  it('binding a variable no collection offers is refused', () => {
    expect(bindFromLibrary(shape(), {}, 's', 'fill', 'Theme/surface')).toMatchObject({ ok: false });
  });
});
