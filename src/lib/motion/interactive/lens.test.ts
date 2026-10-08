// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { setExpression } from '../expression/ops';
import { InputKey } from '../expression/inputs';
import { GLASS_NUMBER_KEYS } from '../glass/model';
import { BLOB_NUMBER_KEYS } from '../blob/model';
import { Lens, addLens } from '../glass/ops';
import { composeHtml } from '../hyperframes/compose';
import { installEngine } from '../engine/testing';
import { BLOB_LIVE } from '../hyperframes/blob-live';
import { INPUT_MESSAGE } from './runtime';
import { Liveness } from './settings';
import { liveLanes } from './spec';

function ok(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const FOLLOW_X = 'input.smooth(input.pointer.x, 0)';
const FOLLOW_Y = 'input.smooth(input.pointer.y, 0)';
const KEYS: Record<Lens, readonly string[]> = { [Lens.Glass]: GLASS_NUMBER_KEYS, [Lens.Blob]: BLOB_NUMBER_KEYS };

function headline(): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Landscape);
  return ok(addClip({ ...doc, durationInFrames: 90 }, { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Make your brand move.' } }, 'h1'));
}

function lensScene(lens: Lens): MotionDoc {
  const placed = ok(addLens(headline(), lens, { from: 0, durationInFrames: 90, props: {}, path: [], spring: { stiffness: 100, damping: 10 }, fadeIn: 0, fadeOut: 0 }, { clip: 'drop', track: 'lens' }));
  return ok(setExpression(ok(setExpression(placed, 'drop', 'centerX', FOLLOW_X)), 'drop', 'centerY', FOLLOW_Y));
}

type Frame = FrameRequestCallback;
let frames: Frame[] = [];

function run(html: string): void {
  const page = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = page.body.innerHTML;
  window.requestAnimationFrame = (cb: Frame) => frames.push(cb);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { load: async () => [], ready: Promise.resolve() } });
  installEngine();
  for (const script of [...page.querySelectorAll('script')].filter((s) => !s.src && !s.type)) {
    try {
      window.eval(script.textContent ?? '');
    } catch {
      continue;
    }
  }
}

function point(x: number, y: number): void {
  window.dispatchEvent(new MessageEvent('message', { data: { type: INPUT_MESSAGE, values: { [InputKey.PointerX]: x, [InputKey.PointerY]: y, [InputKey.Hover]: 1 } } }));
  const due = frames;
  frames = [];
  due.forEach((cb) => cb(performance.now()));
}

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Live });

afterEach(() => {
  frames = [];
  document.body.innerHTML = '';
});

describe('a liquid lens in the interactive export', () => {
  it.each([Lens.Glass, Lens.Blob])('every number of %s is a live lane', (lens) => {
    const doc = KEYS[lens].reduce((d, key) => ok(setExpression(d, 'drop', key, 'value + input.pointer.x * 0')), lensScene(lens));

    expect(
      liveLanes(doc)
        .map((l) => l.key)
        .sort()
    ).toEqual([...KEYS[lens]].sort());
  });

  it('the glass lens follows the cursor: its filter and chrome move', () => {
    run(compose(lensScene(Lens.Glass)));

    point(0.2, 0.3);
    const left = document.getElementById('lgm-drop')!.getAttribute('x');
    const body = document.getElementById('lgc-drop')!.getAttribute('transform');
    point(0.8, 0.7);

    expect(Number(left)).toBeLessThan(Number(document.getElementById('lgm-drop')!.getAttribute('x')));
    expect(body).not.toBe(document.getElementById('lgc-drop')!.getAttribute('transform'));
  });

  it('the 3D drop ships in the live export and follows the cursor through its uniforms', () => {
    const html = compose(lensScene(Lens.Blob));
    run(html);
    const row = () => (window as unknown as Record<string, Record<string, { row: number[] }>>)[BLOB_LIVE].drop.row;

    expect(html).toContain('id="lb-drop"');
    point(0.2, 0.3);
    const [x1, y1] = row();
    point(0.8, 0.7);
    const [x2, y2] = row();

    expect(x1).toBeCloseTo(0.2 * 1920);
    expect(y1).toBeCloseTo(0.3 * 1080);
    expect(x2).toBeCloseTo(0.8 * 1920);
    expect(y2).toBeCloseTo(0.7 * 1080);
  });

  it('refuses live input on a property the export cannot drive, instead of freezing it', () => {
    const doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Particles', from: 0, durationInFrames: 30 }, 'p'));

    const result = setExpression(doc, 'p', 'emitterX', 'input.pointer.x');

    expect(result).toEqual({ ok: false, error: expect.stringContaining('emitterX') });
    expect(setExpression(doc, 'p', 'emitterX', 'value + 0.1').ok).toBe(true);
  });
});
