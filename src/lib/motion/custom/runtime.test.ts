// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { installEngine, testTimeline, type TestTimeline } from '../engine/testing';
import { ERRORS, REGISTRY, bootScript, definitionScript, librariesOf, Library, seedOf, type CustomRun } from './runtime';

const ENV = { assets: {}, brand: { name: 'feega', colors: { accent: '#0099ff' }, logoUrl: null } };

function run(name: string, js: string, at = 1, length = 2): { master: TestTimeline; errors: { message: string }[]; root: HTMLElement } {
  document.body.innerHTML = `<div id="cc-c1"><div class="dot"></div></div>`;
  const w = window as unknown as Record<string, unknown>;
  const master = testTimeline(installEngine());
  w.__master = master;
  const runs: CustomRun[] = [{ id: 'c1', name, start: at, length, fps: 30, values: { label: 'Hi' }, seed: seedOf('c1') }];
  const definition = definitionScript(name, js).replace(/^<script>|<\/script>$/g, '');
  window.eval(definition);
  window.eval(bootScript(runs, ENV, 'window.__master'));
  return { master, errors: (w[ERRORS] as { message: string }[]) ?? [], root: document.getElementById('cc-c1')! };
}

afterEach(() => {
  const w = window as unknown as Record<string, unknown>;
  delete w[REGISTRY];
  delete w[ERRORS];
});

describe('a custom component at runtime', () => {
  it('animates on a child timeline placed at the clip start, seekable both ways', () => {
    const { master, root } = run('Dot', 'tl.fromTo(root.querySelector(".dot"),{x:0},{x:100,duration:1,ease:"none"});');
    const dot = root.querySelector('.dot') as HTMLElement;

    master.seek(1.5);
    const forward = dot.style.transform;
    master.seek(2.9);
    master.seek(1.5);

    expect(forward).toContain('50px');
    expect(dot.style.transform).toBe(forward);
  });

  it('gets its props and a rand that repeats for the same clip', () => {
    const first = run('Echo', 'root.dataset.label = props.label; root.dataset.r = String(rand());').root.dataset;
    const again = run('Echo', 'root.dataset.label = props.label; root.dataset.r = String(rand());').root.dataset;

    expect(first.label).toBe('Hi');
    expect(first.r).toBe(again.r);
  });

  it('has no timers, no network and no clock even if the static check is bypassed', () => {
    const { root } = run('Probe', 'root.dataset.t = typeof setTimeout + typeof fetch + typeof window + typeof requestAnimationFrame;');

    expect(root.dataset.t).toBe('undefinedundefinedundefinedundefined');
    expect(run('Clock', 'Date.now();').errors.at(-1)?.message).toContain('Date.now');
    expect(run('Dice', 'Math.random();').errors.at(-1)?.message).toContain('rand()');
    expect(run('Math', 'root.dataset.v = String(Math.max(1, 2));').root.dataset.v).toBe('2');
  });

  it('records a component that throws instead of breaking the video', () => {
    const { errors, master } = run('Broken', 'throw new Error("boom");');

    expect(errors).toEqual([expect.objectContaining({ message: 'boom' })]);
    expect(master.duration()).toBeGreaterThanOrEqual(3);
  });
});

describe('callbacks under the HyperFrames seek', () => {
  it('an onUpdate on tl still runs when the runtime seeks with events suppressed', () => {
    const { master, root } = run('Typer', 'tl.to({}, { duration: 1, ease: "none", onUpdate() { root.dataset.p = String(Math.round(this.progress() * 10)); } });', 0);

    master.totalTime(0.5, true);

    expect(root.dataset.p).toBe('5');
  });
});

describe('libraries', () => {
  it('loads only the libraries the used code names', () => {
    const components = { A: { source: { html: '', css: '', js: 'motion.split(root)' } }, B: { source: { html: '', css: '', js: 'lottie.loadAnimation({})' } } } as never;

    expect([...librariesOf(components, ['A'])]).toEqual([]);
    expect([...librariesOf(components, ['B'])]).toEqual([Library.Lottie]);
  });
});
