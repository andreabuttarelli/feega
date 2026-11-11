// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { UI_LOOP_PORTS } from './catalog';
import { defaultsOf, playAt } from './play';

const portOf = (id: string) => UI_LOOP_PORTS.find((p) => p.id === id)!;

const numbers = (text: string) => (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

function springOde(seconds: number, stiffness: number, damping: number) {
  const step = 0.0005;
  let x = 0;
  let v = 0;
  for (let n = 0; n < Math.round(seconds / step); n++) {
    const a = (s: number, u: number) => -stiffness * (s - 1) - damping * u;
    const k1 = [v, a(x, v)];
    const k2 = [v + (step / 2) * k1[1], a(x + (step / 2) * k1[0], v + (step / 2) * k1[1])];
    const k3 = [v + (step / 2) * k2[1], a(x + (step / 2) * k2[0], v + (step / 2) * k2[1])];
    const k4 = [v + step * k3[1], a(x + step * k3[0], v + step * k3[1])];
    x += (step / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    v += (step / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return x;
}

describe('css keyframes and framer springs, reproduced numerically', () => {
  it('number ticker follows an overdamped spring (damping 60, stiffness 100) like framer', () => {
    const port = portOf('magicui-number-ticker');
    for (const frame of [15, 30, 45, 60]) {
      const root = playAt(port, { ...defaultsOf(port), decimalPlaces: 3, value: 1000 }, [frame]);
      const shown = Number((root.textContent ?? '').replace(/,/g, ''));
      expect(shown).toBeCloseTo(1000 * springOde(frame / port.fps, 100, 60), 1);
    }
  });

  it('number ticker groups thousands like en-US', () => {
    const port = portOf('magicui-number-ticker');
    expect(playAt(port, defaultsOf(port), [400]).textContent).toBe('100,000');
    expect(playAt(port, { ...defaultsOf(port), value: 1234567.5, decimalPlaces: 1 }, [400]).textContent).toBe('1,234,567.5');
  });

  it('ripple eases each ring between scale 1 and 0.9 on the css ease curve', () => {
    const port = portOf('magicui-ripple');
    const root = playAt(port, defaultsOf(port), [15]);
    const first = root.querySelector('div > div > div') as HTMLElement;
    expect(numbers(first.style.transform).pop()).toBeCloseTo(1 - 0.1 * 0.8024, 3);
  });

  it('ripple staggers rings by 0.06 s: ring 1 is a bit behind ring 0', () => {
    const port = portOf('magicui-ripple');
    const rings = [...playAt(port, defaultsOf(port), [15]).querySelectorAll('div > div > div')] as HTMLElement[];
    expect(numbers(rings[1].style.transform).pop()!).toBeGreaterThan(numbers(rings[0].style.transform).pop()!);
  });

  it('marquee slides by a share of its own width plus the gap, linearly', () => {
    const port = portOf('magicui-marquee');
    const root = playAt(port, defaultsOf(port), [300]);
    const copy = root.querySelector('div > div > div > div') as HTMLElement;
    expect(copy.style.transform).toBe('translateX(calc(-25% - 4px))');
  });

  it('meteors travel along their angle and fade after 70 percent', () => {
    const port = portOf('magicui-meteors');
    const [head] = [...playAt(port, { ...defaultsOf(port), number: 1, minDelay: 0, maxDelay: 0, minDuration: 10, maxDuration: 10, scale: 1 }, [150]).querySelectorAll('span')] as HTMLElement[];
    expect(head.style.transform).toContain('rotate(-215deg)');
    expect(head.style.transform).toContain('translateX(-250px)');
  });

  it('meteors hold full opacity until 70 percent of the run, then fade out', () => {
    const port = portOf('magicui-meteors');
    const props = { ...defaultsOf(port), number: 1, minDelay: 0, maxDelay: 0, minDuration: 10, maxDuration: 10, scale: 1 };
    const opacityAt = (frame: number) => Number(([...playAt(port, props, [frame]).querySelectorAll('span')][0] as HTMLElement).style.opacity);
    expect(opacityAt(150)).toBe(1);
    expect(opacityAt(210)).toBeCloseTo(1, 6);
    expect(opacityAt(255)).toBeCloseTo(0.5, 2);
  });

  it('word rotate waits for the exit, then drops the next word in, on the framer easeOut curve', () => {
    const port = portOf('magicui-word-rotate');
    const at = (frame: number) => playAt(port, defaultsOf(port), [frame]).querySelector('h1') as HTMLElement;
    expect(at(0).textContent).toBe('Word');
    expect(at(75).textContent).toBe('Word');
    expect(at(80).textContent).toBe('Word');
    expect(at(80).style.opacity).not.toBe('1');
    expect(at(90).textContent).toBe('Rotate');
    expect(at(90).style.opacity).toBe('1');
  });

  it('typing animation reveals one character per type speed', () => {
    const port = portOf('magicui-typing-animation');
    const text = (frame: number) => playAt(port, defaultsOf(port), [frame]).querySelector('span')!.textContent;
    expect(text(0)).toBe('');
    expect(text(3)).toBe('T');
    expect(text(30)).toBe('Typing Ani');
  });

  it('animated list pops in one item per delay', () => {
    const port = portOf('magicui-animated-list');
    const shown = (frame: number) => [...playAt(port, defaultsOf(port), [frame]).querySelectorAll<HTMLElement>('div > div > div > div')].filter((el) => el.style.display !== 'none').length;
    expect(shown(0)).toBe(1);
    expect(shown(31)).toBe(2);
    expect(shown(100)).toBe(4);
  });
});
