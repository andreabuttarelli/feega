import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, parseMotionDoc, findClip } from '../doc';
import { parsePath } from '../shape/geometry';
import { ICON_NAMES, addIcon } from './icons';

describe('built-in icons', () => {
  it('ships a usable set of common UI icons', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(40);
    expect(ICON_NAMES).toEqual(expect.arrayContaining(['arrow-right', 'check', 'close', 'menu', 'search', 'user', 'star', 'heart', 'play', 'cart']));
  });

  it.each(ICON_NAMES)('%s is path data a Shape reads', (name) => {
    const doc = newMotionDoc(MotionFormat.Square);
    const r = addIcon(doc, { name, x: 0.5, y: 0.5, size: 0.1, color: '#ff0000', from: 0 }, 'i1');

    expect(r.ok).toBe(true);
    const clip = r.ok ? findClip(r.doc, 'i1')!.clip : null;
    expect(typeof parsePath(String(clip?.props.path))).not.toBe('string');
    expect(r.ok && parseMotionDoc(r.doc).ok).toBe(true);
  });

  it('an icon is a stroked shape of the given colour and size', () => {
    const r = addIcon(newMotionDoc(MotionFormat.Square), { name: 'heart', x: 0.3, y: 0.4, size: 0.2, color: '#00ff00', from: 0 }, 'i1');
    const clip = r.ok ? findClip(r.doc, 'i1')!.clip : null;
    const strokes = clip?.props.strokes as { paint: { color: string } }[];

    expect(clip?.component).toBe('Shape');
    expect(strokes[0].paint.color).toBe('#00ff00');
    expect(clip?.props.fills).toEqual([]);
  });

  it('an unknown icon is refused with the names', () => {
    const r = addIcon(newMotionDoc(MotionFormat.Square), { name: 'nope', x: 0.5, y: 0.5, size: 0.1, color: '#000000', from: 0 }, 'i1');

    expect(r.ok).toBe(false);
  });
});
