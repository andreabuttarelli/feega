import { describe, expect, it } from 'vitest';
import { COMPONENTS, COMPONENT_IDS, AssetKind, Control, Group, defaultProps } from './components';
import { Ease } from './design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { clipFieldGroups, editAt, fieldGroups, fieldsOf, keyAt, keyedField, parseDecimal, partFieldKeys, partFocus, secondsLabel, toggleKey, valueAt } from './inspector';
import { addClip, setKeyframes, setTransform, type OpResult } from './timeline';
import { writeComponent } from './custom/ops';
import { PropFormat } from './custom/component';
import { TYPE_GRID_CLIP, TYPE_GRID_POSTER_TEMPLATE } from './template/type-grid-poster/template';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('properties inspector from the component schema', () => {
  it('every component describes every prop it takes', () => {
    for (const id of COMPONENT_IDS) {
      const optional = Object.entries(COMPONENTS[id].schema.shape).filter(([, field]) => field.safeParse(undefined).success && field.safeParse(undefined).data === undefined).map(([key]) => key);
      expect(fieldsOf(id).map((f) => f.key).sort()).toEqual([...new Set([...Object.keys(defaultProps(id)), ...optional])].sort());
    }
  });

  it('a colour is a colour picker with its default', () => {
    const color = fieldsOf('Title').find((f) => f.key === 'color');

    expect(color).toMatchObject({ control: Control.Color, fallback: 'brand.text', group: Group.Style });
  });

  it('a range carries its bounds and step', () => {
    const opacity = fieldsOf('Title').find((f) => f.key === 'opacity');

    expect(opacity).toMatchObject({ control: Control.Range, min: 0, max: 1, step: 0.01 });
  });

  it('a select carries its options; the font is a font picker', () => {
    expect(fieldsOf('Title').find((f) => f.key === 'align')?.options).toEqual(['left', 'center', 'right']);
    expect(fieldsOf('Title').find((f) => f.key === 'font')?.control).toBe(Control.Font);
  });

  it('the 3D model picker lists only 3D assets', () => {
    expect(fieldsOf('Model3D').find((f) => f.key === 'assetId')).toMatchObject({ control: Control.Asset, assetKind: AssetKind.Model3d });
  });

  it('groups come content first', () => {
    expect(fieldGroups('Title')[0].group).toBe(Group.Content);
  });

  it('seconds read rounded, with a dot, whatever the locale', () => {
    expect(secondsLabel(8)).toBe('0.27');
    expect(secondsLabel(9)).toBe('0.3');
    expect(secondsLabel(90)).toBe('3');
  });

  it('a decimal typed with a comma or a dot is the same number', () => {
    expect(parseDecimal('0,27')).toBe(0.27);
    expect(parseDecimal(' 1.5 ')).toBe(1.5);
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('value at the playhead', () => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 30, durationInFrames: 90, props: { color: '#000000' } }, 't'));
  const resolve = (v: string) => v;

  it('without keyframes a transform prop shows its base, or the rest value', () => {
    const clip = findClip(must(setTransform(doc, 't', { rotateY: 40 })), 't')!.clip;

    expect(valueAt(clip, 'rotateY', 50, resolve)).toBe(40);
    expect(valueAt(clip, 'scale', 50, resolve)).toBe(1);
  });

  it('with keyframes it shows the interpolated value at the playhead, in timeline frames', () => {
    const keyed = must(setKeyframes(doc, 't', 'rotateX', [{ frame: 0, value: 0, ease: Ease.Linear }, { frame: 20, value: 100, ease: Ease.Linear }]));

    expect(valueAt(findClip(keyed, 't')!.clip, 'rotateX', 40, resolve)).toBe(50);
  });

  it('a colour without keyframes shows its prop, with keyframes the mix', () => {
    const keyed = must(setKeyframes(doc, 't', 'color', [{ frame: 0, value: '#000000', ease: Ease.Linear }, { frame: 10, value: '#ffffff', ease: Ease.Linear }]));

    expect(valueAt(findClip(doc, 't')!.clip, 'color', 0, resolve)).toBe('#000000');
    expect(valueAt(findClip(keyed, 't')!.clip, 'color', 35, resolve)).toBe('#808080');
  });

  it('a 3D camera without keyframes shows the value its props imply', () => {
    const model = findClip(must(addClip(doc, { component: 'Model3D', from: 0, props: { zoom: 1.5, startAngle: 10 } }, 'm')), 'm')!.clip;

    expect(valueAt(model, 'dolly', 0, resolve)).toBe(1.5);
    expect(valueAt(model, 'orbit', 0, resolve)).toBe(10);
    expect(valueAt(model, 'fov', 0, resolve)).toBe(35);
  });

  it('knows whether a keyframe sits exactly on the playhead', () => {
    const keyed = findClip(must(setKeyframes(doc, 't', 'rotateX', [{ frame: 5, value: 0, ease: Ease.Linear }])), 't')!.clip;

    expect(keyAt(keyed, 'rotateX', 35)).toBe(true);
    expect(keyAt(keyed, 'rotateX', 36)).toBe(false);
  });
});

describe('editing at the playhead', () => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 30, durationInFrames: 90 }, 't'));
  const resolve = (v: string) => v;
  const clipOf = (d: MotionDoc, id = 't') => findClip(d, id)!.clip;

  it('a prop without keyframes edits its base value', () => {
    const next = must(editAt(doc, clipOf(doc), 'rotateY', 30, 50));

    expect(clipOf(next).transform.rotateY).toBe(30);
    expect(clipOf(next).keyframes).toEqual({});
  });

  it('a colour without keyframes edits the prop', () => {
    expect(clipOf(must(editAt(doc, clipOf(doc), 'color', '#123456', 50))).props.color).toBe('#123456');
  });

  it('a prop with keyframes gets a keyframe at the playhead', () => {
    const keyed = must(setKeyframes(doc, 't', 'rotateY', [{ frame: 0, value: 0, ease: Ease.Linear }]));
    const next = must(editAt(keyed, clipOf(keyed), 'rotateY', 90, 50));

    expect(clipOf(next).keyframes.rotateY.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [20, 90]
    ]);
  });

  it('a camera prop without keyframes is keyed straight away, it has no base of its own', () => {
    const model = must(addClip(doc, { component: 'Model3D', from: 0 }, 'm'));
    const next = must(editAt(model, clipOf(model, 'm'), 'fov', 50, 12));

    expect(clipOf(next, 'm').keyframes.fov).toEqual([{ frame: 12, value: 50, ease: Ease.Standard }]);
  });

  it('the diamond adds a keyframe with the value shown, and removes the one on the playhead', () => {
    const added = must(toggleKey(must(setTransform(doc, 't', { rotateX: 25 })), clipOf(must(setTransform(doc, 't', { rotateX: 25 }))), 'rotateX', 40, resolve));
    const removed = must(toggleKey(added, clipOf(added), 'rotateX', 40, resolve));

    expect(clipOf(added).keyframes.rotateX).toEqual([{ frame: 10, value: 25, ease: Ease.Standard }]);
    expect(clipOf(removed).keyframes).toEqual({});
  });
});

describe('which component props are keyframed from the inspector', () => {
  it('a colour prop is', () => {
    expect(keyedField('ProductCard', 'card')).toBe(true);
  });

  it('a layout prop named like a transform key is not: layout x is not the transform offset x', () => {
    for (const key of ['x', 'y', 'scale', 'opacity']) {
      expect(keyedField('ProductCard', key)).toBe(false);
    }
  });
});

describe('properties of a custom clip come from its props schema', () => {
  it('maps each schema prop to the inspector control that edits it', () => {
    const doc = must(
      writeComponent(newMotionDoc(MotionFormat.Landscape), 'Calendar', {
        source: { html: '', css: '', js: '' },
        propsSchema: {
          type: 'object',
          properties: {
            month: { type: 'string', title: 'Month', default: 'October' },
            note: { type: 'string', format: PropFormat.Textarea, default: '' },
            accent: { type: 'string', format: PropFormat.Color, default: 'brand.accent' },
            view: { type: 'string', enum: ['week', 'month'], default: 'month' },
            posts: { type: 'number', minimum: 0, maximum: 30, step: 1, default: 12 },
            picture: { type: 'string', format: PropFormat.Asset, default: '' },
            live: { type: 'boolean', default: true }
          }
        }
      })
    );
    const clip = findClip(must(addClip(doc, { component: 'Custom', from: 0, props: { name: 'Calendar' } }, 'k')), 'k')!.clip;

    const fields = clipFieldGroups(doc, clip).flatMap((g) => g.fields);

    expect(fields.map((f) => [f.key, f.control])).toEqual([
      ['month', Control.Text],
      ['note', Control.Textarea],
      ['accent', Control.Color],
      ['view', Control.Select],
      ['posts', Control.Range],
      ['picture', Control.Asset],
      ['live', Control.Toggle]
    ]);
    expect(fields[0].label).toBe('Month');
    expect(fields.find((f) => f.key === 'posts')).toMatchObject({ min: 0, max: 30, step: 1 });
  });
});

describe('fields shown for a selected poster part', () => {
  function posterClip() {
    const doc = must(
      writeComponent(newMotionDoc(MotionFormat.Landscape), 'Poster', {
        source: { html: '', css: '', js: '' },
        propsSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', title: 'Title', default: 'Title', group: 'Content' },
            caption: { type: 'string', title: 'Caption', default: 'Caption', group: 'Content' },
            font: { type: 'string', title: 'Font', default: 'Inter', group: 'Style' },
            ink: { type: 'string', title: 'Ink', format: PropFormat.Color, default: '#000', group: 'Style' },
            margin: { type: 'number', title: 'Margin', default: 4, group: 'Layout' },
            titleSize: { type: 'number', title: 'Title size', default: 8, group: 'Layout' },
            titleColour: { type: 'string', title: 'Title colour', format: PropFormat.Color, default: '#f00', group: 'Style' },
            titleX: { type: 'number', title: 'Title x', default: 0, group: 'Layout' },
            captionSize: { type: 'number', title: 'Caption size', default: 3, group: 'Layout' },
            captionWeight: { type: 'number', title: 'Caption weight', default: 400, group: 'Style' }
          }
        }
      })
    );
    const withClip = must(addClip(doc, { component: 'Custom', from: 0, props: { name: 'Poster' } }, 'k'));
    return { doc: withClip, clip: findClip(withClip, 'k')!.clip };
  }

  it('its own text field plus every poster-wide style and layout field', () => {
    const { doc, clip } = posterClip();
    expect(partFieldKeys(doc, clip, 'title')).toEqual(['title', 'titleColour', 'titleSize', 'titleX', 'font', 'ink', 'margin']);
  });

  it("never another part's own size or weight", () => {
    const { doc, clip } = posterClip();
    expect(partFieldKeys(doc, clip, 'title')).not.toContain('captionSize');
    expect(partFieldKeys(doc, clip, 'caption')).toEqual(['caption', 'captionWeight', 'captionSize', 'font', 'ink', 'margin']);
  });

  it('a part also claims its text, background, border and tag colours and its height', () => {
    const doc = must(
      writeComponent(newMotionDoc(MotionFormat.Landscape), 'Pills', {
        source: { html: '', css: '', js: '' },
        propsSchema: {
          type: 'object',
          properties: {
            pills: { type: 'string', title: 'Pills', default: 'A', group: 'Content' },
            pillsTextColor: { type: 'string', title: 'Text', format: PropFormat.Color, default: '#000', group: 'Style' },
            pillsBgColor: { type: 'string', title: 'Bg', format: PropFormat.Color, default: '#000', group: 'Style' },
            pillsHeight: { type: 'number', title: 'Height', default: 3, group: 'Layout' },
            paper: { type: 'string', title: 'Paper', format: PropFormat.Color, default: '#fff', group: 'Style' }
          }
        }
      })
    );
    const withClip = must(addClip(doc, { component: 'Custom', from: 0, props: { name: 'Pills' } }, 'k'));
    expect(partFieldKeys(withClip, findClip(withClip, 'k')!.clip, 'pills')).toEqual(['pills', 'pillsTextColor', 'pillsBgColor', 'pillsHeight', 'paper']);
  });

  it('a poster whose field names break the convention claims them through its table row', () => {
    const doc = must(
      writeComponent(newMotionDoc(MotionFormat.Landscape), 'CircleEventPoster', {
        source: { html: '', css: '', js: '' },
        propsSchema: {
          type: 'object',
          properties: {
            heading: { type: 'string', title: 'Name', default: 'A', group: 'Content' },
            nameSize: { type: 'number', title: 'Name size', default: 8, group: 'Layout' },
            ink: { type: 'string', title: 'Ink', format: PropFormat.Color, default: '#000', group: 'Style' }
          }
        }
      })
    );
    const withClip = must(addClip(doc, { component: 'Custom', from: 0, props: { name: 'CircleEventPoster' } }, 'k'));
    const clip = findClip(withClip, 'k')!.clip;
    expect(partFieldKeys(withClip, clip, 'heading')).toEqual(['heading', 'nameSize', 'ink']);
  });

  it("never another part's own text field", () => {
    const { doc, clip } = posterClip();
    expect(partFieldKeys(doc, clip, 'title')).not.toContain('caption');
  });
});

describe('seconds at another frame rate', () => {
  it('reads frames at the doc rate', () => {
    expect(secondsLabel(25, 25)).toBe('1');
    expect(secondsLabel(30, 60)).toBe('0.5');
  });
});

describe('a selected poster part shows only its own fields', () => {
  const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
  const clip = findClip(doc, TYPE_GRID_CLIP)!.clip;

  it('a marked line leaves the raw multi-line field out: its text has its own field', () => {
    expect(partFocus(doc, clip, 'lines:1')).not.toContain('lines');
    expect(partFocus(doc, clip, 'lines:1')).toContain('ink');
  });

  it('a whole text field keeps its own field', () => {
    expect(partFocus(doc, clip, 'footer1')[0]).toBe('footer1');
  });

  it('a photo and an arrow show their style, never the lines', () => {
    expect(partFocus(doc, clip, 'photos:0')).toEqual(expect.arrayContaining(['photoTint', 'photoGrain']));
    expect(partFocus(doc, clip, 'photos:0')).not.toContain('lines');
    expect(partFocus(doc, clip, 'arrow:4')[0]).toBe('arrowColor');
  });

  it('a photo shows only its own fields, never the whole poster style', () => {
    const focus = partFocus(doc, clip, 'photos:0');

    expect(focus).toEqual(expect.arrayContaining(['photoTint', 'photoGrain']));
    expect(focus).not.toContain('ink');
    expect(focus).not.toContain('paper');
    expect(focus).not.toContain('font');
    expect(focus).not.toContain('margin');
  });
});
