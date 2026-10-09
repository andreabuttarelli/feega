import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { anchorBox } from './clicks';
import { Ease } from './design';
import { Isolate, focusUi } from './ui-focus';
import { pieceAnchors } from './ui-kit/anchors';
import { UiBlock, recreatedUi } from './ui-kit/kit';

const FPS = 30;

function film(clips: MotionClip[]): MotionDoc {
  return { ...newMotionDoc(MotionFormat.Landscape), fps: FPS, durationInFrames: 300, tracks: [{ id: 't1', kind: 'visual', name: 'V', clips }] as MotionDoc['tracks'] };
}

const promptBox = () => newClip({ id: 'ui', from: 30, durationInFrames: 240, component: 'Custom', props: { name: 'UiPromptBox' } });

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const centre = (b: { left: number; top: number; width: number; height: number }) => [b.left + b.width / 2, b.top + b.height / 2];

const clipOf = (doc: MotionDoc) => doc.tracks[0].clips[0] as MotionClip;

describe('focus_ui frames one part of a UI', () => {
  const focused = must(focusUi(film([promptBox()]), { clipId: 'ui', anchor: 'send', at: 60, frames: 15, fill: 0.3, isolate: Isolate.Context }));

  it('lands the anchor box in the centre of the frame', () => {
    const box = anchorBox(focused, 'ui', 'send', 60 + 15)!;

    expect(centre(box)[0]).toBeCloseTo(960, 0);
    expect(centre(box)[1]).toBeCloseTo(540, 0);
  });

  it('scales the part to the asked share of the frame', () => {
    const box = anchorBox(focused, 'ui', 'send', 60 + 15)!;

    expect(Math.max(box.width / 1920, box.height / 1080)).toBeCloseTo(0.3, 2);
  });

  it('moves on the house standard ease and leaves the frames before untouched', () => {
    const scale = clipOf(focused).keyframes.scale;

    expect(scale.map((k) => k.ease)).toEqual([Ease.Standard, Ease.Standard]);
    expect(scale[0]).toMatchObject({ frame: 30, value: 1 });
    expect(anchorBox(focused, 'ui', 'send', 50)!.width).toBeCloseTo(anchorBox(film([promptBox()]), 'ui', 'send', 50)!.width, 3);
  });

  it('chains beats: the field, then the send button', () => {
    const field = must(focusUi(film([promptBox()]), { clipId: 'ui', anchor: 'field', at: 45, frames: 15, fill: 0.7, isolate: Isolate.Context }));
    const send = must(focusUi(field, { clipId: 'ui', anchor: 'send', at: 120, frames: 15, fill: 0.4, isolate: Isolate.Context }));

    expect(centre(anchorBox(send, 'ui', 'field', 100)!)[0]).toBeCloseTo(960, 0);
    expect(centre(anchorBox(send, 'ui', 'send', 135)!)[0]).toBeCloseTo(960, 0);
  });

  it('isolating a part masks the clip down to that part alone', () => {
    const alone = must(focusUi(film([promptBox()]), { clipId: 'ui', anchor: 'progress', at: 60, frames: 15, fill: 0.8, isolate: Isolate.Part }));
    const clip = clipOf(alone);
    const width = clip.keyframes.maskWidth.at(-1)!.value as number;
    const height = clip.keyframes.maskHeight.at(-1)!.value as number;

    expect(clip.mask?.kind).toBe('rect');
    expect(width * 1920).toBeLessThan(1300);
    expect(height * 1080).toBeLessThan(60);
  });

  it('names the anchors when the part does not exist', () => {
    const missed = focusUi(film([promptBox()]), { clipId: 'ui', anchor: 'nope', at: 60, frames: 15, fill: 0.5, isolate: Isolate.Context });

    expect(missed.ok ? '' : missed.error).toMatch(/field, send, progress, done/);
  });
});

describe('every part a beat can isolate has an anchor', () => {
  it('the prompt box names its progress bar and its done state below the field', () => {
    const { anchors } = pieceAnchors('UiPromptBox', {})!;

    expect(anchors.progress.y).toBeGreaterThan(anchors.field.y + anchors.field.h);
    expect(anchors.progress.h).toBe(6);
    expect(anchors.done.y).toBeGreaterThan(anchors.progress.y);
  });

  it('the generated result names its picture and its copy', () => {
    const { anchors } = pieceAnchors('UiGeneratedResult', {})!;

    expect(Object.keys(anchors)).toEqual(['picture', 'copy']);
    expect(anchors.copy.x).toBeGreaterThan(anchors.picture.x + anchors.picture.w);
  });

  it('a recreated UI names every block, so any one of them can be isolated', () => {
    const piece = recreatedUi('UiRebuilt', {
      layout: 'app',
      colors: { ink: '#000000', muted: '#666666', paper: '#ffffff', line: '#eeeeee', accent: '#ff0000' },
      font: 'Inter',
      radius: 0,
      blocks: [{ kind: UiBlock.Heading, text: 'Hi' }, { kind: UiBlock.Input, text: 'a' }, { kind: UiBlock.Button, text: 'Go' }, { kind: UiBlock.Stat, text: '42%' }, { kind: UiBlock.Card, text: 'c' }]
    });

    expect(Object.keys(pieceAnchors(piece.name, {}, piece.js)!.anchors)).toEqual(['heading-0', 'input-0', 'button', 'stat-0', 'card-0']);
  });
});
