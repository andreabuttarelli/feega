import { describe, expect, it } from 'vitest';
import { CLIP_TEXT, PartEdit, editablePart, partAt, partBoxes, partText, writePartText } from './poster-parts';
import { TYPE_GRID_CLIP, TYPE_GRID_POSTER_TEMPLATE } from './template/type-grid-poster/template';
import { MotionFormat, findClip, newMotionDoc } from './doc';
import { addClip } from './timeline';

const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
const clip = findClip(doc, TYPE_GRID_CLIP)!.clip;

describe('poster parts', () => {
  it('keeps clip boxes and part boxes apart, parts listed under their clip', () => {
    const split = partBoxes({ poster: { left: 0, top: 0, width: 10, height: 10 }, 'poster#lines:1': { left: 1, top: 1, width: 2, height: 2 } });

    expect(Object.keys(split.clips)).toEqual(['poster']);
    expect(split.parts.poster).toEqual([{ part: 'lines:1', box: { left: 1, top: 1, width: 2, height: 2 } }]);
  });

  it('picks the smallest part under the pointer', () => {
    const parts = [
      { part: 'lines', box: { left: 0, top: 0, width: 100, height: 100 } },
      { part: 'lines:1', box: { left: 10, top: 10, width: 20, height: 10 } }
    ];

    expect(partAt(parts, [15, 15])).toBe('lines:1');
    expect(partAt(parts, [90, 90])).toBe('lines');
    expect(partAt(parts, [200, 200])).toBeNull();
  });

  it('a text field line is editable as text; a colour, a font or a media field is not', () => {
    expect(editablePart(doc, clip, 'lines:1')).toBe(PartEdit.Text);
    expect(editablePart(doc, clip, 'footer2')).toBe(PartEdit.Text);
    expect(editablePart(doc, clip, 'media:0')).toBe(PartEdit.None);
    expect(editablePart(doc, clip, 'nope')).toBe(PartEdit.None);
  });

  it('reads and writes one line of a multi-line field, or the whole field', () => {
    const lines = String(clip.props.lines).split('\n');
    expect(partText(clip, 'lines:1')).toBe(lines[1]);

    const one = writePartText(doc, clip.id, 'lines:1', 'NEW LINE');
    expect(one.ok && String(findClip(one.doc, clip.id)!.clip.props.lines).split('\n')).toEqual([lines[0], 'NEW LINE', ...lines.slice(2)]);

    const whole = writePartText(doc, clip.id, 'footer1', 'Today');
    expect(whole.ok && findClip(whole.doc, clip.id)!.clip.props.footer1).toBe('Today');
  });

  it('refuses to write a part that is not text', () => {
    expect(writePartText(doc, clip.id, 'media:0', 'x').ok).toBe(false);
  });
});

describe('a drawn text clip edits in place like a poster part', () => {
  const drawn = () => {
    const made = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, props: { text: 'Text' } }, 't1');
    if (!made.ok) {
      throw new Error(made.error);
    }
    return made.doc;
  };

  it('its whole text is one editable part, written back to its text prop', () => {
    const doc = drawn();
    const clip = findClip(doc, 't1')!.clip;

    expect(editablePart(doc, clip, CLIP_TEXT)).toBe(PartEdit.Text);
    const written = writePartText(doc, 't1', CLIP_TEXT, 'Hello');
    expect(written.ok && findClip(written.doc, 't1')!.clip.props.text).toBe('Hello');
  });

  it('a clip without text has nothing to edit', () => {
    const made = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0 }, 's1');
    const doc = made.ok ? made.doc : newMotionDoc(MotionFormat.Landscape);
    expect(editablePart(doc, findClip(doc, 's1')!.clip, CLIP_TEXT)).toBe(PartEdit.None);
  });
});
