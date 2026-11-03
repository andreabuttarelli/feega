import { describe, expect, it } from 'vitest';
import { findClip, MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { VarType } from '@feega/motion-core/motion/variables-model';
import { bindVariable, defineVariable, setActiveMode } from './variables';
import { adoptCollection, bindFromLibrary, colourTokens, recolour, recolouredCollection, syncedCollection, variableLibraryOf } from './variable-library';

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

describe('a colour token changed once repaints everything bound to it', () => {
  it('recolouring the bound token repaints the fill in the frame mode and hands back the collection to share', () => {
    const bound = must(bindVariable(themed(shape()), 's', 'fill', 'Theme/surface'));
    const { result, collection } = recolour(bound, variableLibraryOf([bound]), 'Theme/surface', '#123456');

    expect(findClip(must(result), 's')!.clip.props.fill).toBe('#123456');
    expect(collection?.vars.surface.values).toEqual({ Light: '#123456', Dark: '#101010' });
  });

  it('the shared collection repaints another frame bound to the same token', () => {
    const here = must(bindVariable(themed(shape()), 's', 'fill', 'Theme/surface'));
    const there = must(bindVariable(themed(shape()), 's', 'fill', 'Theme/surface'));
    const { collection } = recolour(here, variableLibraryOf([here]), 'Theme/surface', '#00ff00');

    expect(findClip(syncedCollection(there, 'Theme', collection!)!, 's')!.clip.props.fill).toBe('#00ff00');
  });

  it('a token only the library holds is copied into the frame first', () => {
    const library = variableLibraryOf([themed(shape())]);
    const { result } = recolour(shape(), library, 'Theme/surface', '#abcdef');

    expect(must(result).variables!.Theme.vars.surface.values.Light).toBe('#abcdef');
  });

  it('a token nobody holds is refused', () => {
    expect(recolour(shape(), {}, 'Theme/surface', '#abcdef').result).toMatchObject({ ok: false });
  });

  it('lists the colour tokens with the colour each shows, numbers left out', () => {
    const library = variableLibraryOf([must(defineVariable(themed(shape()), 'Space', 'm', { type: VarType.Number, values: { Default: 8 } }))]);

    expect(colourTokens(library)).toEqual([{ key: 'Theme/surface', collection: 'Theme', name: 'surface', colour: '#ffffff' }]);
  });
});

describe('a colour token edited from the styles panel', () => {
  it('changes the first mode of the shared collection, the other modes kept', () => {
    const library = variableLibraryOf([themed(shape())]);

    expect(recolouredCollection(library.Theme, 'surface', '#222222')?.vars.surface.values).toEqual({ Light: '#222222', Dark: '#101010' });
  });

  it('a name the collection lacks changes nothing', () => {
    expect(recolouredCollection(variableLibraryOf([themed(shape())]).Theme, 'ink', '#222222')).toBeNull();
  });
});
