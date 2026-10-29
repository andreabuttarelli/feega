import { describe, expect, it } from 'vitest';
import { COMPONENTS, defaultProps, type ComponentId } from './components';
import { newMotionDoc, MotionFormat } from './doc';
import { frameSurface, withSurface } from './surface';

const TOKEN = /^brand\./;

describe('default colours', () => {
  it('a new shape is filled with plain grey, not a brand token', () => {
    expect(defaultProps('Shape').fill).toBe('#D9D9D9');
  });

  it('a new text is plain black', () => {
    expect(defaultProps('Text').color).toBe('#000000');
  });

  it('a new frame surface is plain white', () => {
    const doc = withSurface(newMotionDoc(MotionFormat.Landscape), 'surface');

    expect(frameSurface(doc)?.props.fills).toEqual([expect.objectContaining({ color: '#FFFFFF' })]);
  });

  it('no component default is a brand token', () => {
    const tokens = (Object.keys(COMPONENTS) as ComponentId[]).flatMap((id) =>
      Object.entries(defaultProps(id))
        .filter(([, value]) => typeof value === 'string' && TOKEN.test(value))
        .map(([key]) => `${id}.${key}`)
    );

    expect(tokens).toEqual([]);
  });
});
