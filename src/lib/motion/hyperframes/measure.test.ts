// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEASURE_REPLY, MEASURE_REQUEST, measureClips, measureScript } from './measure';

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
      <span data-rect="30,40,20,10">Hi</span><i data-rect="60,30,40,20"></i>
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

  it('a line of text is as wide as its words, not as its block', () => {
    const root = stage();
    root.querySelector('span')!.setAttribute('data-rect', '10,40,200,10');
    Range.prototype.getBoundingClientRect = function () {
      return { left: 30, top: 40, width: 20, height: 10, right: 50, bottom: 50, x: 30, y: 40, toJSON: () => ({}) } as DOMRect;
    };

    expect(measureClips(root).a.left).toBeCloseTo(0.1, 5);
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
        boxes: { a: { left: 0.1, top: 0.1, width: 0.35, height: 0.2 } }
      }
    ]);
  });
});
