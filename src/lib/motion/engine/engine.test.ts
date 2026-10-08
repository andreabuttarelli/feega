// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { ENGINE_GLOBAL, engineScript, motionEngine } from './engine';

type Tl = Record<string, (...args: unknown[]) => unknown>;

const engine = () => motionEngine(window as unknown as Window & Record<string, unknown>);
const timeline = () => engine().timeline() as unknown as Tl;

const PROGRESS = [0, 0.1, 0.25, 0.333, 0.5, 0.6, 0.75, 0.9, 0.99, 1];

const GSAP_CURVES: Record<string, number[]> = {
  'power1.out': [0, 0.19, 0.4375, 0.555111, 0.75, 0.84, 0.9375, 0.99, 0.9999, 1],
  'power2.inOut': [0, 0.004, 0.0625, 0.147704148, 0.5, 0.744, 0.9375, 0.996, 0.999996, 1],
  'power3.out': [0, 0.3439, 0.68359375, 0.8020737777, 0.9375, 0.9744, 0.99609375, 0.9999, 0.99999999, 1],
  'power4.in': [0, 0.00001, 0.0009765625, 0.0040946913, 0.03125, 0.07776, 0.2373046875, 0.59049, 0.9509900499, 1],
  'sine.inOut': [0, 0.0244717419, 0.1464466094, 0.2495466873, 0.5, 0.6545084972, 0.8535533906, 0.9755282581, 0.9997532802, 1],
  'expo.inOut': [0, 0.000416225, 0.01171875, 0.0474589019, 0.5, 0.8737856, 0.98828125, 0.999583775, 0.9999887822, 1],
  'circ.inOut': [0, 0.0101020514, 0.0669872981, 0.1270241295, 0.5, 0.8, 0.9330127019, 0.9898979486, 0.99989999, 1],
  'back.out(2.5)': [0, 0.4735, 0.9296875, 1.0736291295, 1.1875, 1.176, 1.1015625, 1.0215, 1.0002465, 1],
  'back.inOut': [0, -0.02322528, -0.04384875, 0.0216615629, 0.5, 0.85290112, 1.04384875, 1.02322528, 1.0003295097, 1],
  'elastic.out': [0, 1.25, 0.9116116524, 0.9233785755, 1.015625, 0.984375, 1.0055242717, 0.998046875, 1.0003234338, 1],
  'elastic.inOut': [0, 0.0003391566, 0.0119694444, -0.0024120835, 0.5, 1.1174615776, 0.9880305556, 0.9996608434, 0.9997541229, 1],
  'elastic.out(1.4, 0.5)': [0, 1.3114121391, 1.1767766953, 0.9659067452, 0.96875, 1.0097316293, 1.0055242717, 0.9975764487, 0.9988330693, 1],
  'bounce.out': [0, 0.075625, 0.47265625, 0.8385980625, 0.765625, 0.7725, 0.97265625, 0.988125, 0.99388125, 1],
  'bounce.inOut': [0, 0.03, 0.1171875, 0.078178875, 0.5, 0.65125, 0.8828125, 0.97, 0.9946375, 1],
  'steps(5)': [0, 0, 0.2, 0.2, 0.6, 0.6, 0.8, 1, 1, 1],
  'Power2.easeOut': [0, 0.271, 0.578125, 0.703259037, 0.875, 0.936, 0.984375, 0.999, 0.999999, 1],
  sine: [0, 0.156434465, 0.3826834324, 0.4995464816, 0.7071067812, 0.8090169944, 0.9238795325, 0.9876883406, 0.9998766325, 1],
  none: [0, 0.1, 0.25, 0.333, 0.5, 0.6, 0.75, 0.9, 0.99, 1]
};

beforeEach(() => {
  document.body.innerHTML = '<div id="a"></div><div id="b"></div><svg><path id="p" d="M0 0L10 10"></path></svg>';
});

const el = (id: string) => document.getElementById(id) as HTMLElement;

describe('eases', () => {
  it.each(Object.entries(GSAP_CURVES))('%s follows the curve the old timeline drew', (name, values) => {
    const ease = engine().parseEase(name);

    PROGRESS.forEach((p, i) => expect(ease(p)).toBeCloseTo(values[i], 8));
  });

  it('a registered curve is used by name', () => {
    const e = engine();
    e.registerEase('half', () => 0.5);

    expect(e.parseEase('half')(0.9)).toBe(0.5);
  });
});

describe('what a seek writes', () => {
  it('composes transforms like the old timeline: 3D while moving, 2D at rest', () => {
    const tl = timeline();
    tl.fromTo('#a', { x: 0, y: 0 }, { x: 100, y: -50.5, duration: 1, ease: 'none', immediateRender: false }, 0);

    tl.totalTime(0.5, true);
    expect(el('a').style.transform).toBe('translate3d(50px, -25.25px, 0px)');

    tl.totalTime(1, true);
    expect(el('a').style.transform).toBe('translate(100px, -50.5px)');
  });

  it('keeps every component of an element when two tweens move different ones', () => {
    const tl = timeline();
    tl.fromTo('#a', { x: 0 }, { x: 100, duration: 1, ease: 'none', immediateRender: false }, 0);
    tl.fromTo('#a', { scale: 0 }, { scale: 2, duration: 1, ease: 'none', immediateRender: false }, 2);

    tl.totalTime(2.5, true);

    expect(el('a').style.transform).toBe('translate3d(100px, 0px, 0px)');
  });

  it('writes percent offsets, rotation, skew and scale in the old order', () => {
    const tl = timeline();
    tl.fromTo(
      '#a',
      {
        xPercent: 12,
        rotationY: 20,
        skewX: 5,
        scaleX: 0,
        transformPerspective: 800
      },
      {
        xPercent: 0,
        rotationY: 0,
        skewX: 0,
        scaleX: 1,
        transformPerspective: 800,
        duration: 1,
        ease: 'none',
        immediateRender: false
      },
      0
    );

    tl.totalTime(0.5, true);

    expect(el('a').style.transform).toBe('perspective(800px) translate(6%, 0%) translate3d(0px, 0px, 0px) rotateY(10deg) skew(2.5deg, 0deg) scale(0.5, 1)');
  });

  it('tweens strings with numbers and colours inside, and lands on the exact end string', () => {
    const tl = timeline();
    tl.fromTo(
      '#a',
      {
        filter: 'blur(24px)',
        '--kc-fill': '#ff0000',
        clipPath: 'inset(0 100% 0 0)'
      },
      {
        filter: 'blur(0px)',
        '--kc-fill': '#0000ff',
        clipPath: 'inset(0 0% 0 0)',
        duration: 1,
        ease: 'none',
        immediateRender: false
      },
      0
    );

    tl.totalTime(0.5, true);
    expect(el('a').style.filter).toBe('blur(12px)');
    expect(el('a').style.getPropertyValue('--kc-fill')).toBe('rgba(128,0,128,1)');

    tl.totalTime(1, true);
    expect(el('a').style.getPropertyValue('--kc-fill')).toBe('#0000ff');
  });

  it('adds px to bare numbers except on unitless properties', () => {
    const tl = timeline();
    tl.fromTo(
      '#a',
      { width: 1, opacity: 0, zIndex: 1 },
      {
        width: 3,
        opacity: 1,
        zIndex: 3,
        duration: 1,
        ease: 'none',
        immediateRender: false
      },
      0
    );

    tl.totalTime(0.5, true);

    expect(el('a').style.width).toBe('2px');
    expect(el('a').style.opacity).toBe('0.5');
    expect(el('a').style.zIndex).toBe('2');
  });

  it('tweens attributes and plain objects', () => {
    const state = { v: 0 };
    const tl = timeline();
    tl.fromTo(
      '#p',
      { attr: { 'stroke-width': 1, d: 'M0 0L10 10' } },
      {
        attr: { 'stroke-width': 3, d: 'M0 0L20 30' },
        duration: 1,
        ease: 'none',
        immediateRender: false
      },
      0
    );
    tl.to(state, { v: 10, duration: 1, ease: 'none' }, 0);

    tl.totalTime(0.5, true);

    expect(el('p').getAttribute('d')).toBe('M0 0L15 20');
    expect(el('p').getAttribute('stroke-width')).toBe('2');
    expect(state.v).toBe(5);
  });
});

describe('a frame depends only on its time', () => {
  function build(tl: Tl) {
    tl.fromTo('#a', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.2);
    tl.to('#a', { x: '+=100', duration: 1 }, 1);
    tl.set('#b', { opacity: 0.3 }, 0.5);
    tl.fromTo(
      '#b',
      { scale: 0.5 },
      {
        scale: 1,
        duration: 0.4,
        ease: 'back.out(1.7)',
        immediateRender: false
      },
      1.5
    );
    tl.set({}, {}, 3);
  }
  const state = () => [el('a').getAttribute('style'), el('b').getAttribute('style')];

  it('once every element was drawn, forward, backward and scrambled visits draw the same frame', () => {
    const tl = timeline();
    build(tl);
    const times = [0, 0.3, 0.7, 1.2, 1.7, 2.5, 3];
    tl.totalTime(3, true);
    const forward = times.map((t) => (tl.totalTime(t, true), state()));
    const backward = [...times]
      .reverse()
      .map((t) => (tl.totalTime(t, true), state()))
      .reverse();
    const order = [5, 1, 6, 0, 3, 2, 4];
    const scrambled: unknown[] = [];
    order.forEach((i) => {
      tl.totalTime(times[i], true);
      scrambled[i] = state();
    });

    expect(backward).toEqual(forward);
    expect(scrambled).toEqual(forward);
  });

  it('a fromTo shows its start at once, before its time comes', () => {
    const tl = timeline();
    tl.fromTo('#a', { opacity: 0 }, { opacity: 1, duration: 1 }, 1);

    expect(el('a').style.opacity).toBe('0');
  });

  it('a from tween lands on the value the element had', () => {
    el('a').style.opacity = '0.8';
    const tl = timeline();
    tl.from('#a', { opacity: 0, duration: 1, ease: 'none' }, 1);

    expect(el('a').style.opacity).toBe('0');
    tl.totalTime(2, true);
    expect(el('a').style.opacity).toBe('0.8');
  });

  it('a relative value counts from where the previous tween left it', () => {
    const tl = timeline();
    tl.set('#a', { x: 10 }, 0);
    tl.to('#a', { x: '+=100', duration: 1, ease: 'none' }, 1);

    tl.totalTime(1.5, true);
    expect(el('a').style.transform).toBe('translate3d(60px, 0px, 0px)');
  });
});

describe('callbacks', () => {
  it('onUpdate runs on every seek, suppressed or not, with the tween as this', () => {
    const seen: number[] = [];
    const tl = timeline();
    tl.to(
      {},
      {
        duration: 2,
        ease: 'none',
        onUpdate(this: { time: () => number; progress: () => number }) {
          seen.push(this.time(), this.progress());
        }
      },
      1
    );

    tl.totalTime(2, true);
    tl.totalTime(0.5, true);

    expect(seen).toEqual([1, 0.5, 0, 0]);
  });

  it('call() never runs: nothing may depend on it', () => {
    let ran = false;
    const tl = timeline();
    tl.call(() => (ran = true), [], 0.5);
    tl.set({}, {}, 1);

    tl.totalTime(1, true);

    expect(ran).toBe(false);
  });
});

describe('placement', () => {
  it('reads relative positions, labels and staggers', () => {
    const tl = timeline();
    tl.to('#a', { x: 1, duration: 1 }, 0.5);
    tl.to('#b', { x: 1, duration: 1 }, '+=0.5');
    tl.addLabel('mid', 1);
    tl.to('#a', { y: 1, duration: 1 }, '<');
    tl.to(['#a', '#b'], { opacity: 0, duration: 1, stagger: 0.25 }, 'mid+=1');

    const starts = (tl.getChildren() as { startTime: () => number }[]).map((c) => c.startTime());

    expect(starts).toEqual([0.5, 2, 2, 2, 2.25]);
    expect(tl.duration()).toBe(3.25);
  });

  it('a child timeline runs at its own time and reports where it sits', () => {
    const e = engine();
    const master = e.timeline() as unknown as Tl;
    const child = e.timeline() as unknown as Tl;
    child.fromTo('#a', { x: 0 }, { x: 100, duration: 1, ease: 'none', immediateRender: false }, 0);
    master.add(child, 2);

    master.totalTime(2.5, true);

    expect(child.time()).toBe(0.5);
    expect(el('a').style.transform).toBe('translate3d(50px, 0px, 0px)');
    expect((master.getChildren() as { startTime: () => number }[])[0].startTime()).toBe(2);
  });

  it('tweenFromTo maps the parent clock onto a window of the child', () => {
    const e = engine();
    const master = e.timeline() as unknown as Tl;
    const child = e.timeline() as unknown as Tl;
    child.fromTo('#a', { x: 0 }, { x: 100, duration: 2, ease: 'none', immediateRender: false }, 0);
    master.add(child.tweenFromTo(1, 2, { duration: 1 }), 3);

    master.totalTime(3.5, true);

    expect(child.time()).toBe(1.5);
  });
});

describe('split', () => {
  it('wraps chars inside words, keeping the text', () => {
    el('a').textContent = 'Hi you';
    const s = engine().split('#a', { type: 'chars,words' });

    expect(s.words.map((w) => w.textContent)).toEqual(['Hi', 'you']);
    expect(s.chars.map((c) => c.textContent).join('')).toBe('Hiyou');
    expect(el('a').textContent).toBe('Hi you');
  });

  it('is constructible like the class it replaces', () => {
    el('a').textContent = 'One line';
    const SplitText = engine().SplitText as new (t: unknown, v: object) => { lines: HTMLElement[] };

    expect(new SplitText(el('a'), { type: 'lines' }).lines.length).toBe(1);
  });
});

type Driver = Record<string, number>;
type Helpers = {
  drawPath: (path: Element) => Driver;
  morph: (path: Element, to: string, vars?: { points?: number }) => Driver;
  scramble: (el: Element, text: string, vars?: { seed?: number; chars?: string }) => Driver;
  flip: (targets: Element[], change: () => void) => Driver;
};

const SVG = 'http://www.w3.org/2000/svg';

function polygonOf(d: string): number[][] {
  const n = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
}

function measurePolygons() {
  const proto = window.SVGElement.prototype as unknown as Record<string, unknown>;
  const edges = (el: Element) => {
    const pts = polygonOf(el.getAttribute('d') ?? '');
    return pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
  };
  proto.getTotalLength = function (this: Element) {
    return edges(this).reduce((sum, [a, b]) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
  };
  proto.getPointAtLength = function (this: Element, at: number) {
    let left = at;
    for (const [a, b] of edges(this)) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (left <= length) {
        return { x: a[0] + ((b[0] - a[0]) * left) / length, y: a[1] + ((b[1] - a[1]) * left) / length };
      }
      left -= length;
    }
    return { x: 0, y: 0 };
  };
}

describe('seekable helpers', () => {
  const helpers = () => engine() as unknown as Helpers & { timeline: () => Tl };

  it('drawPath draws a stroke from progress, whatever the path length', () => {
    const svg = document.createElementNS(SVG, 'svg');
    const path = document.createElementNS(SVG, 'path');
    svg.appendChild(path);
    document.body.appendChild(svg);
    const m = helpers();
    const tl = m.timeline();
    const line = m.drawPath(path);
    tl.fromTo(line, { draw: 0 }, { draw: 1, duration: 1, ease: 'none' }, 0);

    tl.totalTime(0.25, true);
    const first = path.getAttribute('style');
    tl.totalTime(0.9, true);
    tl.totalTime(0.25, true);

    expect(path.getAttribute('pathLength')).toBe('1');
    expect((path as SVGElement).style.strokeDasharray).toBe('0.25 2');
    expect(path.getAttribute('style')).toBe(first);
  });

  it('morph resamples both shapes to the same points and blends them', () => {
    measurePolygons();
    const svg = document.createElementNS(SVG, 'svg');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', 'M0 0 L10 0 L10 10 L0 10 Z');
    svg.appendChild(path);
    document.body.appendChild(svg);
    const m = helpers();
    const tl = m.timeline();
    const shape = m.morph(path, 'M0 0 L20 0 L20 20 L0 20 Z', { points: 4 });
    tl.fromTo(shape, { morph: 0 }, { morph: 1, duration: 1, ease: 'none' }, 0);

    tl.totalTime(0.5, true);
    const half = path.getAttribute('d');
    tl.totalTime(1, true);
    tl.totalTime(0.5, true);

    expect(half).toBe('M0,0L15,0L15,15L0,15Z');
    expect(path.getAttribute('d')).toBe(half);
    expect(svg.children).toHaveLength(1);
  });

  it('scramble reveals the text left to right through seeded noise, the same at every visit', () => {
    el('a').textContent = '';
    const m = helpers();
    const tl = m.timeline();
    const text = m.scramble(el('a'), 'hello world', { seed: 7 });
    tl.fromTo(text, { reveal: 0 }, { reveal: 1, duration: 1, ease: 'none' }, 0);

    tl.totalTime(0.4, true);
    const first = el('a').textContent ?? '';
    tl.totalTime(0.9, true);
    tl.totalTime(0.4, true);

    expect(first).toHaveLength(11);
    expect(first.slice(0, 4)).toBe('hell');
    expect(first.slice(4)).not.toBe('o world');
    expect(first[5]).toBe(' ');
    expect(el('a').textContent).toBe(first);
    tl.totalTime(1, true);
    expect(el('a').textContent).toBe('hello world');
  });

  it('flip animates from the recorded layout to the new one', () => {
    const box = el('a');
    let rect = { left: 0, top: 0, width: 100, height: 100 };
    box.getBoundingClientRect = () => ({ ...rect, right: 0, bottom: 0, x: rect.left, y: rect.top, toJSON: () => rect }) as DOMRect;
    const m = helpers();
    const tl = m.timeline();
    const moved = m.flip([box], () => {
      rect = { left: 200, top: 50, width: 50, height: 50 };
    });
    tl.fromTo(moved, { flip: 0 }, { flip: 1, duration: 1, ease: 'none' }, 0);

    tl.totalTime(0.5, true);
    const half = box.style.transform;
    tl.totalTime(1, true);
    const done = box.style.transform;
    tl.totalTime(0.5, true);

    expect(half).toBe('translate(-100px, -25px) scale(1.5, 1.5)');
    expect(done).toBe('translate(0px, 0px) scale(1, 1)');
    expect(box.style.transform).toBe(half);
  });
});

describe('in the page', () => {
  it('installs itself on the window', () => {
    window.eval(engineScript());

    expect(typeof (window as unknown as Record<string, { timeline: unknown }>)[ENGINE_GLOBAL].timeline).toBe('function');
  });
});

describe('a revisited frame', () => {
  it.each([
    ['fromTo, only in the to vars', (tl: Tl) => tl.fromTo('#a', { scale: 0 }, { transformOrigin: '50% 0%', opacity: 0.5, scale: 1, duration: 1, ease: 'none' }, 0.5)],
    ['fromTo, in both vars', (tl: Tl) => tl.fromTo('#a', { transformOrigin: '0% 100%' }, { transformOrigin: '50% 50%', duration: 1, ease: 'none' }, 0.5)],
    ['to', (tl: Tl) => tl.to('#a', { transformOrigin: 'left top', duration: 1, ease: 'none' }, 0.5)],
    ['from', (tl: Tl) => tl.from('#a', { transformOrigin: 'right bottom', duration: 1, ease: 'none' }, 0.5)],
    ['set', (tl: Tl) => tl.set('#a', { transformOrigin: 'center top', display: 'block' }, 0.5)]
  ])('a prop in %s draws the same frame on every visit', (_mode, build) => {
    const tl = timeline();
    build(tl);
    const frames: string[] = [];
    const style = el('a').style;

    for (const t of [0.8, 0, 2, 0.8, 0.2, 0.8, 0]) {
      tl.totalTime(t, true);
      frames.push([style.transformOrigin, style.opacity, style.display, style.transform].join('|'));
    }

    expect(frames[3]).toBe(frames[0]);
    expect(frames[5]).toBe(frames[0]);
    expect(frames[6]).toBe(frames[1]);
  });
});
