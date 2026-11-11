// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { hfKit } from './kit';

const K = hfKit();
const at = (name: string, p: number) => K.ease(name)(p);

describe('gsap eases match the values gsap computes', () => {
  it.each([
    ['none', 0.3, 0.3],
    ['power1.in', 0.5, 0.25],
    ['power1.out', 0.5, 0.75],
    ['power2.out', 0.5, 0.875],
    ['power2.in', 0.5, 0.125],
    ['power3.out', 0.5, 0.9375],
    ['power4.out', 0.5, 0.96875],
    ['power2.inOut', 0.25, 0.0625],
    ['power2.inOut', 0.75, 0.9375],
    ['power3.inOut', 0.25, 0.03125],
    ['sine.in', 0.5, 1 - Math.SQRT1_2],
    ['sine.out', 0.5, Math.SQRT1_2],
    ['sine.inOut', 0.5, 0.5],
    ['expo.out', 0.5, 1 - 2 ** -5],
    ['expo.in', 0.5, 2 ** -5],
    ['expo.inOut', 0.5, 0.5],
    ['circ.out', 0.5, Math.sqrt(0.75)],
    ['circ.in', 0.5, 1 - Math.sqrt(0.75)],
    ['back.out(1.7)', 0.5, 1.0875],
    ['back.in(1.7)', 0.5, -0.0875],
    ['back.out', 0.5, 0.25 * (2.70158 * -0.5 + 1.70158) + 1],
    ['elastic.out(1,0.3)', 0.5, 1 + 2 ** -5 * 0.5],
    ['elastic.out', 0.25, 1 + 2 ** -2.5 * Math.sin((0.25 - 0.075) * ((2 * Math.PI) / 0.3))],
    ['bounce.out', 0.5, 0.765625],
    ['bounce.out', 0.95, 7.5625 * (0.95 - 2.625 / 2.75) ** 2 + 0.984375],
    ['steps(4)', 0.5, 0.5],
    ['steps(4)', 0.19, 0.0],
    ['steps(4)', 0.21, 0.25],
    ['steps(4)', 1, 1]
  ])('%s at %d is %d', (name, p, want) => {
    expect(at(name, p)).toBeCloseTo(want, 6);
  });

  it.each(['power1', 'power2', 'power3', 'power4', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce'])('%s starts at 0 and lands on 1 in every direction', (name) => {
    for (const kind of ['in', 'out', 'inOut']) {
      expect(at(`${name}.${kind}`, 0)).toBeCloseTo(0, 6);
      expect(at(`${name}.${kind}`, 1)).toBeCloseTo(1, 6);
    }
  });

  it('a bare name means ease out, like gsap', () => {
    expect(at('power3', 0.4)).toBe(at('power3.out', 0.4));
  });
});

const box = () => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
};

describe('timeline', () => {
  it('a to-tween holds the starting state before it begins and the end state after it', () => {
    const el = box();
    const tl = K.timeline();
    tl.set(el, { opacity: 0, y: 20 }, 0);
    tl.to(el, { opacity: 1, y: 0, duration: 1, ease: 'none' }, 1);
    tl.render(0.5);
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toContain('translate(0px, 20px)');
    tl.render(1.5);
    expect(el.style.opacity).toBe('0.5');
    expect(el.style.transform).toContain('translate(0px, 10px)');
    tl.render(5);
    expect(el.style.opacity).toBe('1');
  });

  it('a from-tween shows its from values before it starts', () => {
    const el = box();
    const tl = K.timeline();
    tl.from(el, { opacity: 0, scale: 0.5, duration: 1, ease: 'none' }, 2);
    tl.render(0);
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toContain('scale(0.5, 0.5)');
    tl.render(2.5);
    expect(el.style.opacity).toBe('0.5');
    tl.render(3);
    expect(el.style.opacity).toBe('1');
  });

  it('a later tween starts from where the earlier one left the value', () => {
    const el = box();
    const tl = K.timeline();
    tl.to(el, { x: 100, duration: 1, ease: 'none' }, 0);
    tl.to(el, { x: 0, duration: 1, ease: 'none' }, 0.5);
    tl.render(0.5);
    expect(el.style.transform).toContain('translate(50px, 0px)');
    tl.render(1);
    expect(el.style.transform).toContain('translate(25px, 0px)');
    tl.render(1.5);
    expect(el.style.transform).toContain('translate(0px, 0px)');
  });

  it('stagger delays each target by its index', () => {
    const els = [box(), box(), box()];
    const tl = K.timeline();
    tl.set(els, { opacity: 0 }, 0);
    tl.to(els, { opacity: 1, duration: 1, ease: 'none', stagger: 0.5 }, 0);
    tl.render(0.5);
    expect(els.map((e) => e.style.opacity)).toEqual(['0.5', '0', '0']);
    tl.render(1);
    expect(els.map((e) => e.style.opacity)).toEqual(['1', '0.5', '0']);
  });

  it('stagger from the centre starts the middle first', () => {
    const els = [box(), box(), box()];
    const tl = K.timeline();
    tl.set(els, { opacity: 0 }, 0);
    tl.to(els, { opacity: 1, duration: 1, ease: 'none', stagger: { each: 0.5, from: 'center' } }, 0);
    tl.render(0.5);
    expect(els.map((e) => e.style.opacity)).toEqual(['0', '0.5', '0']);
  });

  it('position strings resolve against the previous tween and labels', () => {
    const el = box();
    const tl = K.timeline();
    tl.to(el, { x: 10, duration: 1, ease: 'none' }, 0);
    tl.to(el, { y: 10, duration: 1, ease: 'none' }, '>');
    tl.to(el, { rotation: 90, duration: 1, ease: 'none' }, '<0.5');
    tl.addLabel('end', '+=1');
    tl.to(el, { scale: 2, duration: 1, ease: 'none' }, 'end');
    expect(tl.duration()).toBe(4.5);
    tl.render(1.5);
    expect(el.style.transform).toContain('rotate(0deg)');
    tl.render(2);
    expect(el.style.transform).toContain('rotate(45deg)');
    tl.render(4);
    expect(el.style.transform).toContain('scale(1.5, 1.5)');
  });

  it('colours and complex strings interpolate', () => {
    const el = box();
    const tl = K.timeline();
    tl.set(el, { backgroundColor: '#000000', clipPath: 'inset(0 100% 0 0)' }, 0);
    tl.to(el, { backgroundColor: '#ffffff', clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'none' }, 0);
    tl.render(0.5);
    expect(el.style.backgroundColor).toBe('rgb(128, 128, 128)');
    expect(el.style.clipPath).toBe('inset(0 50% 0 0)');
  });

  it('repeat with yoyo bounces and relative values add to the start', () => {
    const el = box();
    const tl = K.timeline();
    tl.to(el, { x: 100, duration: 1, ease: 'none', repeat: 3, yoyo: true }, 0);
    tl.render(0.25);
    expect(el.style.transform).toContain('translate(25px, 0px)');
    tl.render(1.25);
    expect(el.style.transform).toContain('translate(75px, 0px)');
    tl.render(2.25);
    expect(el.style.transform).toContain('translate(25px, 0px)');
    const rel = box();
    const tl2 = K.timeline();
    tl2.set(rel, { x: 10 }, 0);
    tl2.to(rel, { x: '+=40', duration: 1, ease: 'none' }, 0);
    tl2.render(1);
    expect(rel.style.transform).toContain('translate(50px, 0px)');
  });

  it('plain objects tween and report through onUpdate, rendering is repeatable in any order', () => {
    const counter = { v: 0 };
    const seen: number[] = [];
    const tl = K.timeline();
    tl.to(counter, { v: 100, duration: 2, ease: 'none', onUpdate: () => seen.push(Math.round(counter.v)) }, 0);
    tl.render(1);
    tl.render(2);
    tl.render(0.5);
    expect(seen).toEqual([50, 100, 25]);
  });

  it('autoAlpha hides at zero', () => {
    const el = box();
    const tl = K.timeline();
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, ease: 'none' }, 0);
    tl.render(0);
    expect(el.style.visibility).toBe('hidden');
    tl.render(0.5);
    expect(el.style.visibility).toBe('inherit');
  });
});
