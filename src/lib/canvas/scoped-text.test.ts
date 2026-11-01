import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { apply2d } from '@feega/motion-core/motion/parent';
import { addClip, setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent, instanceOf } from '$lib/motion/main-component';
import { commitScoped, doubledOn, textScope } from './scoped-text';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const label = (doc: MotionDoc, id: string, text: string) => must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 90, props: { text, x: 0.3, y: 0.5 } }, id));

function button() {
  let n = 0;
  const main = must(createComponent(label(newMotionDoc(MotionFormat.Landscape), 't', 'Deploy'), ['t'], () => `i${++n}`, 'Button'));
  const host = main.tracks.flatMap((t) => t.clips)[0].id;
  const doc = must(setTransform(main, host, { x: 100 / main.width }));
  return { doc, host, text: `${host}__0__t` };
}

describe('textScope', () => {
  it('a text at the top of the frame is edited where it is', () => {
    const doc = label(newMotionDoc(MotionFormat.Landscape), 'h', 'Hello');
    const scope = textScope(doc, 'h', 0)!;

    expect(scope.id).toBe('h');
    expect(scope.view).toBe(doc);
    expect(apply2d(scope.place, [10, 20])).toEqual([10, 20]);
  });

  it('a text inside an imported button is reached through the instance, and its caret moves with the instance', () => {
    const { doc, text } = button();
    const scope = textScope(doc, text, 0)!;

    expect(findClip(scope.view, scope.id)?.clip.props.text).toBe('Deploy');
    expect(apply2d(scope.place, [10, 20])[0]).toBeCloseTo(110, 5);
  });

  it('knows nothing of an id that is in no comp', () => {
    expect(textScope(button().doc, 'nope', 0)).toBeNull();
  });
});

describe('commitScoped', () => {
  it('typing in an instance label writes an override on the instance, not the main', () => {
    const { doc, host, text } = button();
    const typed = must(commitScoped(doc, text, 'Ship', [], [], 0));

    expect(instanceOf(typed, host)!.overrides).toEqual({ t: { text: 'Ship' } });
    expect(findClip(typed, host)).not.toBeNull();
  });
});

describe('doubledOn', () => {
  it('a double click on the text already picked inside a button stays on the text, so it opens for typing', () => {
    expect(doubledOn(['b', 'b__0__t'], ['b__0__t'], 'b')).toBe('b__0__t');
  });

  it('elsewhere it is the clip under the pointer', () => {
    expect(doubledOn(['b', 'b__0__t'], ['x'], 'b')).toBe('b');
    expect(doubledOn(['b', 'b__0__t'], [], 'b')).toBe('b');
  });
});
