import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from './doc';
import { clickUi } from './cursor-ops';
import { cursorMisses, CURSOR_PIECE } from './clicks';
import { Space } from './camera';
import { writeComponent } from './custom/ops';
import { UI_KIT, UiKind } from './ui-kit/kit';

const box = newClip({ id: 'box', from: 30, durationInFrames: 120, component: 'Custom', props: { name: 'UiPromptBox', label: 'Say what should change', prompt: 'Add the autumn menu', done: 'Live in 9 seconds' }, keyframes: { scale: [{ frame: 0, value: 0.8, ease: 'linear' }, { frame: 120, value: 1.1, ease: 'linear' }] } as never });
const piece = UI_KIT[UiKind.PromptBox];

function film(): MotionDoc {
  const empty = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 };
  const written = writeComponent(empty, piece.name, { source: { html: piece.html, css: piece.css, js: piece.js }, propsSchema: { type: 'object', properties: {} } });
  const doc = written.ok ? written.doc : empty;
  return { ...doc, tracks: [{ id: 't1', kind: 'visual', name: 'V', clips: [box] }] as MotionDoc['tracks'] };
}

describe('click_ui', () => {
  it('lays a cursor whose clicks land on the anchors, even while the UI scales', () => {
    const made = clickUi(film(), [{ clipId: 'box', anchor: 'field', at: 2 }, { clipId: 'box', anchor: 'send', at: 3.5 }], { clip: 'cur', track: 'ct' });

    expect(made.ok).toBe(true);
    const doc = made.ok ? made.doc : film();
    const cursor = doc.tracks[0].clips[0];
    expect(cursor.props.name).toBe(CURSOR_PIECE);
    expect(cursor.space).toBe(Space.Screen);
    expect(doc.components[CURSOR_PIECE]).toBeDefined();
    expect(cursorMisses(doc)).toEqual([]);
  });

  it('names the anchors a clip has when asked for one it lacks', () => {
    const made = clickUi(film(), [{ clipId: 'box', anchor: 'submit', at: 2 }], { clip: 'cur', track: 'ct' });

    expect(made.ok ? '' : made.error).toContain('send');
  });

  it('refuses a click while the UI is off screen', () => {
    const made = clickUi(film(), [{ clipId: 'box', anchor: 'send', at: 9 }], { clip: 'cur', track: 'ct' });

    expect(made.ok).toBe(false);
  });
});
