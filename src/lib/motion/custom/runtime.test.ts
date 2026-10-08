// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import * as d3 from 'd3';
import Matter from 'matter-js';
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

  it('a boot run again by a preview patch reports only its own errors', () => {
    run('Broken', 'throw new Error("boom");');
    const { errors } = run('Broken', 'throw new Error("boom");');
    window.dispatchEvent(new ErrorEvent('error', { message: 'late' }));

    expect(errors.map((e) => e.message)).toEqual(['boom', 'late']);
  });

  it('records a component that throws instead of breaking the video', () => {
    const { errors, master } = run('Broken', 'throw new Error("boom");');

    expect(errors).toEqual([expect.objectContaining({ message: 'boom' })]);
    expect(master.duration()).toBeGreaterThanOrEqual(3);
  });
});

describe('a component scope of its own', () => {
  it('declares top and brand without colliding with the injected names', () => {
    const js = 'const top = 12; let brand = "Tappory"; function rand() { return 0.5; } root.dataset.v = brand + top + rand();';
    const { errors, root } = run('Leaderboard', js);

    expect(errors).toEqual([]);
    expect(root.dataset.v).toBe('Tappory120.5');
  });
});

describe('format', () => {
  it('formats numbers the same on every machine, whatever its locale', () => {
    const js = 'root.dataset.v = [format.number(1234567.891, { decimals: 2 }), format.number(-9876), format.compact(12400), format.compact(3_250_000), format.percent(0.4567), format.number(1234.5, { decimals: 1, group: ".", point: "," })].join("|");';

    expect(run('Stats', js).root.dataset.v).toBe('1,234,567.89|-9,876|12.4K|3.3M|46%|1.234,5');
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

  it('loads d3 for a component that names it', () => {
    const components = { C: { source: { html: '', css: '', js: 'const x = d3.scaleLinear()' } } } as never;

    expect([...librariesOf(components, ['C'])]).toEqual([Library.D3]);
  });

  it('loads p5 for a sketch', () => {
    const components = { S: { source: { html: '', css: '', js: 'p5((p) => { p.draw = () => p.circle(0, 0, 9); })' } } } as never;

    expect([...librariesOf(components, ['S'])]).toEqual([Library.P5]);
  });

  it('a p5 sketch never loops and redraws the timeline frame on every seek, reseeded', () => {
    class FakeP5 {
      frameCount = 0;
      looping = true;
      seeds: number[] = [];
      setup?: () => void;
      draw?: () => void;
      constructor(sketch: (p: FakeP5) => void, node: HTMLElement) {
        node.dataset.mounted = '';
        sketch(this);
        this.setup?.();
        this.redraw();
      }
      noLoop() {
        this.looping = false;
      }
      randomSeed(seed: number) {
        this.seeds.push(seed);
      }
      noiseSeed(seed: number) {
        this.seeds.push(seed);
      }
      redraw() {
        this.frameCount += 1;
        this.draw?.();
      }
    }
    (window as unknown as Record<string, unknown>).p5 = FakeP5;
    const js = 'const sketch = p5((p) => { p.draw = () => { root.dataset.f = String(p.frameCount); root.dataset.seed = String(p.seeds.at(-1)); }; }); root.dataset.looping = String(sketch.looping);';
    const { master, root, errors } = run('Sketch', js, 0);
    const frame = (t: number) => {
      master.seek(t);
      return `${root.dataset.f}/${root.dataset.seed}`;
    };

    const first = frame(1.5);
    frame(0.5);

    expect(errors).toEqual([]);
    expect(root.dataset.looping).toBe('false');
    expect(first).toBe(`45/${seedOf('c1')}`);
    expect(frame(0.5)).toBe(`15/${seedOf('c1')}`);
    expect(frame(1.5)).toBe(first);
  });

  it('loads PixiJS for a stage', () => {
    const components = { P: { source: { html: '', css: '', js: 'const app = new PIXI.Application({ width: 10, height: 10 })' } } } as never;

    expect([...librariesOf(components, ['P'])]).toEqual([Library.Pixi]);
  });

  it('a PixiJS application never starts its own ticker and keeps its frame for capture', () => {
    class Application {
      options: Record<string, unknown>;
      constructor(options: Record<string, unknown>) {
        this.options = options;
      }
    }
    class Graphics {}
    (window as unknown as Record<string, unknown>).PIXI = { Application, Graphics };
    const js = 'const app = new PIXI.Application({ width: 10, height: 10, autoStart: true }); root.dataset.options = JSON.stringify(app.options); root.dataset.graphics = String(typeof PIXI.Graphics);';
    const { root, errors } = run('Stage', js, 0);

    expect(errors).toEqual([]);
    expect(JSON.parse(root.dataset.options!)).toEqual({ width: 10, height: 10, autoStart: false, sharedTicker: false, preserveDrawingBuffer: true });
    expect(root.dataset.graphics).toBe('function');
  });

  it('loads matter.js for a physics scene', () => {
    const components = { M: { source: { html: '', css: '', js: 'const engine = Matter.Engine.create()' } } } as never;

    expect([...librariesOf(components, ['M'])]).toEqual([Library.Matter]);
  });

  it('a matter.js world steps at a fixed delta from the start, so any seek order lands on the same state', () => {
    (window as unknown as Record<string, unknown>).Matter = Matter;
    const js = 'const engine = Matter.Engine.create(); const ball = Matter.Bodies.circle(200, 0, 20, { restitution: 0.6 }); const ground = Matter.Bodies.rectangle(200, 400, 800, 40, { isStatic: true }); Matter.Composite.add(engine.world, [ball, ground]); const at = Matter.seekable(engine); root.dataset.runner = typeof Matter.Runner; tl.to({}, { duration, ease: "none", onUpdate() { const pose = at(this.time()).get(ball); root.dataset.pose = `${pose.x.toFixed(4)},${pose.y.toFixed(4)},${pose.angle.toFixed(4)}`; } }, 0);';
    const { master, root, errors } = run('Drop', js, 0, 4);
    const pose = (t: number) => {
      master.seek(t);
      return root.dataset.pose!;
    };

    const late = pose(3);
    const early = pose(0.5);
    const middle = pose(1.5);

    expect(errors).toEqual([]);
    expect(root.dataset.runner).toBe('undefined');
    expect(Number(middle.split(',')[1])).toBeGreaterThan(Number(early.split(',')[1]));
    expect(pose(1.5)).toBe(middle);
    expect(pose(3)).toBe(late);
    expect(pose(0.5)).toBe(early);
    const fresh = run('Drop', js, 0, 4);
    fresh.master.seek(0.5);
    expect(fresh.root.dataset.pose).toBe(early);
  });

  it('a d3 chart drawn from progress gives the same frame from any seek order', () => {
    (window as unknown as Record<string, unknown>).d3 = d3;
    const js = 'const svg = d3.select(root).append("svg"); const bars = svg.selectAll("rect").data([3, 9, 5]).join("rect"); const y = d3.scaleLinear().domain([0, 9]).range([0, 300]); tl.to({}, { duration: 2, ease: "none", onUpdate() { const p = this.progress(); bars.attr("height", (d) => y(d) * d3.easeCubicOut(p)).attr("fill", d3.interpolateRgb("#000", "#09f")(p)); } }, 0);';
    const { master, root, errors } = run('Bars', js, 0);
    const frame = (t: number) => {
      master.seek(t);
      return root.innerHTML;
    };

    const first = frame(1.3);
    frame(1.9);
    frame(0.2);

    expect(errors).toEqual([]);
    expect(first).toContain('<rect');
    expect(frame(1.3)).toBe(first);
  });
});
