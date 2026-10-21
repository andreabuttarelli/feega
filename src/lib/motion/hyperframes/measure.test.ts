// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEASURE_REPLY, MEASURE_REQUEST, Pose, kindsOf, measureClips, measureScript } from './measure';

type R = { left: number; top: number; width: number; height: number };

const ROOT: R = { left: 10, top: 20, width: 200, height: 100 };

function rectOf(el: Element): R {
  if (el.id === 'root') {
    return ROOT;
  }
  const own = (el as HTMLElement).dataset.rect?.split(',').map(Number);
  if (!own) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const turned = (el as HTMLElement).closest('.kf') as HTMLElement | null;
  const shift = turned && turned.style.transform !== 'none' && turned.style.transform ? 50 : 0;
  return { left: own[0] + shift, top: own[1], width: own[2], height: own[3] };
}

function stage() {
  document.body.innerHTML = `<div id="root">
    <div class="layer" data-clip="a"><div class="fx" id="fx-a"><div class="kp"><div class="kf" style="transform: rotate(30deg)"><div class="ks">
      <span data-rect="30,40,20,10" data-part="lines:1">Hi</span><i data-rect="60,30,40,20"></i>
    </div></div></div></div></div>
    <div class="layer" data-clip="empty"><div class="fx"></div></div>
  </div>`;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const r = rectOf(this);
    return {
      ...r,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON: () => r
    } as DOMRect;
  });
  return document.getElementById('root')!;
}

afterEach(() => vi.restoreAllMocks());

describe('measuring the clips in the preview', () => {
  it('reads the untransformed content box as a fraction of the frame', () => {
    const boxes = measureClips(stage());

    expect(boxes.a).toEqual({ left: 0.1, top: 0.1, width: 0.35, height: 0.2 });
  });

  it('puts the transforms back as they were', () => {
    const root = stage();
    measureClips(root);

    expect((root.querySelector('.kf') as HTMLElement).style.transform).toBe('rotate(30deg)');
  });

  it('a text with its own box measures the box, not the ink, so its selection is the text box', () => {
    const root = stage();
    root.insertAdjacentHTML('beforeend', '<div class="layer" data-clip="t"><div class="box" data-box data-rect="20,30,180,60"><div data-rect="70,50,40,10">Hi</div></div></div>');

    expect(measureClips(root).t).toEqual({ left: 0.05, top: 0.1, width: 0.9, height: 0.6 });
  });

  it('a line of text is as wide as its words, not as its block', () => {
    const root = stage();
    root.querySelector('span')!.setAttribute('data-rect', '10,40,200,10');
    Range.prototype.getBoundingClientRect = function () {
      return { left: 30, top: 40, width: 20, height: 10, right: 50, bottom: 50, x: 30, y: 40, toJSON: () => ({}) } as DOMRect;
    };

    expect(measureClips(root).a.left).toBeCloseTo(0.1, 5);
  });

  it('measures each tagged part of a clip as its own box, keyed clip#part', () => {
    const boxes = measureClips(stage());

    expect(boxes['a#lines:1']).toEqual({ left: 0.1, top: 0.2, width: 0.1, height: 0.1 });
  });

  it('finds a template text by its value where the template drew it, so it can be picked and typed into', () => {
    const root = stage();
    root.insertAdjacentHTML('beforeend', `<div class="layer" data-clip="t" data-texts='{"headline":"Big sale","note":"gone"}'><h1><span data-rect="30,40,40,20"><b>Big</b> sale</span></h1></div>`);
    const boxes = measureClips(root);

    expect(boxes['t#headline']).toEqual({ left: 0.1, top: 0.2, width: 0.2, height: 0.2 });
    expect(root.querySelector('[data-part="headline"]')!.tagName).toBe('SPAN');
    expect(boxes['t#note']).toBeUndefined();
  });

  it('posed, reads the box where the element is drawn now, transforms included', () => {
    const { a } = measureClips(stage(), kindsOf(Pose.Posed));
    expect(a.left + a.width).toBeCloseTo(0.7, 5);
  });

  it('a clip with nothing drawn has no box', () => {
    expect(measureClips(stage()).empty).toBeUndefined();
  });

  it('answers the editor with the boxes', () => {
    stage();
    const replies: unknown[] = [];
    const source = { postMessage: (m: unknown) => replies.push(m) };
    new Function(measureScript().replace(/^<script>|<\/script>$/g, ''))();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: MEASURE_REQUEST, id: 'q' },
        source: source as unknown as Window
      })
    );

    expect(replies).toEqual([
      {
        type: MEASURE_REPLY,
        id: 'q',
        boxes: { a: { left: 0.1, top: 0.1, width: 0.35, height: 0.2 }, 'a#lines:1': { left: 0.1, top: 0.2, width: 0.1, height: 0.1 } },
        stage: { width: 0, height: 0 }
      }
    ]);
  });

  it('answers a posed request with the drawn boxes', () => {
    stage();
    const replies: { boxes: Record<string, R> }[] = [];
    const source = { postMessage: (m: { boxes: Record<string, R> }) => replies.push(m) };
    new Function(measureScript().replace(/^<script>|<\/script>$/g, ''))();
    window.dispatchEvent(new MessageEvent('message', { data: { type: MEASURE_REQUEST, id: 'p', pose: Pose.Posed }, source: source as unknown as Window }));

    const a = replies.at(-1)!.boxes.a;
    expect(a.left + a.width).toBeCloseTo(0.7, 5);
  });
});
