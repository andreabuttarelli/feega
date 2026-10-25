import { describe, expect, it } from 'vitest';
import { libraryProps, shaderTree, effectValues, effectProblem } from './preset';
import { SHADER_EFFECTS, ShaderEffectId } from './catalogue';

describe('shader effect presets', () => {
  it('a generator stands alone with its defaults', () => {
    const tree = shaderTree(ShaderEffectId.Plasma, {}, null);

    expect(tree).toMatchObject({ id: 'fx', type: 'Plasma', children: [] });
    expect(tree.props.density).toBe(2);
  });

  it('a filter wraps the picture it is given', () => {
    const tree = shaderTree(ShaderEffectId.FlutedGlass, {}, 'https://x/a.png');

    expect(tree.children).toEqual([{ id: 'src', type: 'ImageTexture', props: { url: 'https://x/a.png', objectFit: 'cover' }, children: [] }]);
  });

  it('a filter with no picture wraps a mesh gradient', () => {
    expect(shaderTree(ShaderEffectId.ZoomBlur, {}, null).children[0].type).toBe('MeshGradient');
  });

  it('turns the gradient colours into evenly spaced stops', () => {
    const props = libraryProps(SHADER_EFFECTS[ShaderEffectId.MeshGradient], { colorA: '#000000', colorB: '#ffffff' });

    expect(props.stops).toEqual([
      { color: '#000000', position: 0 },
      { color: '#ffffff', position: 1 / 3 },
      { color: '#e04b9e', position: 2 / 3 },
      { color: '#ffdf8e', position: 1 }
    ]);
  });

  it('fills every knob from the catalogue', () => {
    expect(effectValues(ShaderEffectId.IrisWipe, { feather: 0.3 })).toEqual({ progress: 0.5, feather: 0.3 });
  });

  it('refuses a knob the effect does not have, naming the ones it has', () => {
    expect(effectProblem(ShaderEffectId.IrisWipe, { radius: 1 })).toBe('iris-wipe has no radius; it has progress, feather');
  });

  it('refuses a number out of range and a bad colour', () => {
    expect(effectProblem(ShaderEffectId.IrisWipe, { progress: 2 })).toBe('iris-wipe: progress takes 0..1');
    expect(effectProblem(ShaderEffectId.Plasma, { colorA: 'red' })).toBe('plasma: colorA takes #rrggbb or a brand colour');
  });
});
