// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import * as d3 from 'd3';
import Matter from 'matter-js';
import './generative-entry';
import './twgl-entry';
import './fx-entry';
import './splitting-entry';
import './open-props-entry';
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

  it('loads the generative utilities for a component that uses gen', () => {
    const components = { G: { source: { html: '', css: '', js: 'const noise = gen.noise2D()' } } } as never;

    expect([...librariesOf(components, ['G'])]).toEqual([Library.Generative]);
  });

  it('seeds noise and poisson sampling per clip: the same clip draws the same field, two fields differ', () => {
    const js = 'const a = gen.noise2D(); const b = gen.noise2D(); const dots = gen.poisson({ shape: [200, 200], minDistance: 20 }).fill(); root.dataset.v = JSON.stringify([a(0.3, 0.7), b(0.3, 0.7), dots.length, dots[3]]);';
    const first = JSON.parse(run('Field', js).root.dataset.v!);
    const again = JSON.parse(run('Field', js).root.dataset.v!);

    expect(again).toEqual(first);
    expect(first[0]).not.toBe(first[1]);
    expect(first[2]).toBeGreaterThan(20);
  });

  it('hands over the geometry utilities: Delaunay, simplify, isect, RBush, KDBush, inside, ClipperLib', () => {
    const js = [
      'const d = gen.Delaunay.from([[0, 0], [10, 0], [0, 10], [10, 10]]);',
      'const cells = [...d.voronoi([0, 0, 10, 10]).cellPolygons()].length;',
      'const line = gen.simplify([{ x: 0, y: 0 }, { x: 1, y: 0.01 }, { x: 2, y: 0 }], 0.1).length;',
      'const hits = gen.isect.bush([{ from: { x: 0, y: 0 }, to: { x: 10, y: 10 } }, { from: { x: 0, y: 10 }, to: { x: 10, y: 0 } }]).run().length;',
      'const tree = new gen.RBush(); tree.insert({ minX: 0, minY: 0, maxX: 1, maxY: 1 });',
      'const index = new gen.KDBush(1); index.add(5, 5); index.finish();',
      'const near = index.range(0, 0, 9, 9).length;',
      'const where = gen.inside([[0, 0], [10, 0], [10, 10], [0, 10]], [5, 5]);',
      'root.dataset.v = [cells, line, hits, tree.search({ minX: 0, minY: 0, maxX: 2, maxY: 2 }).length, near, where, typeof gen.ClipperLib.Clipper].join();'
    ].join('');

    expect(run('Geometry', js).root.dataset.v).toBe('4,2,1,1,1,-1,function');
  });

  it('loads TWGL for a shader component', () => {
    const components = { T: { source: { html: '', css: '', js: 'const gl = twgl.webgl(canvas)' } } } as never;

    expect([...librariesOf(components, ['T'])]).toEqual([Library.Twgl]);
  });

  it('hands TWGL a WebGL context that keeps its frame for capture', () => {
    const asked: unknown[] = [];
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
      asked.push(args);
      return null;
    } as never;
    try {
      const { root, errors } = run('Shader', 'const canvas = document.createElement("canvas"); twgl.webgl(canvas); root.dataset.helpers = typeof twgl.createProgramInfo + typeof twgl.drawBufferInfo;');

      expect(errors).toEqual([]);
      expect(asked).toEqual([['webgl2', { preserveDrawingBuffer: true, antialias: true }]]);
      expect(root.dataset.helpers).toBe('functionfunction');
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
    }
  });

  it('loads fx for a component that uses it', () => {
    const components = { F: { source: { html: '', css: '', js: 'fx.grain(root)' } } } as never;

    expect([...librariesOf(components, ['F'])]).toEqual([Library.Fx]);
  });

  it('drives each fx effect by one variable on tl: the same frame sought twice gives the same style', () => {
    const js = [
      'const dot = root.querySelector(".dot");',
      'fx.border(dot, { colors: ["#ffffff", "#0099ff"] });',
      'fx.gradient(root, { colors: ["#000000", "#0099ff"], cycles: 2 });',
      'fx.grid(root, { size: 40 });',
      'fx.shimmer(dot);',
      'fx.grain(root, { boil: 12 });'
    ].join('');
    const { master, root, errors } = run('Effects', js);
    const dot = root.querySelector('.dot') as HTMLElement;
    const grain = root.querySelector('[data-fx="grain"]') as HTMLElement;
    const styles = () => [root.style.cssText, dot.style.cssText, grain.style.cssText].join('|');

    master.seek(1.5);
    const first = styles();
    master.seek(2.9);
    master.seek(1.5);

    expect(errors).toEqual([]);
    expect(dot.style.getPropertyValue('--fx-border')).toBe('0.25');
    expect(root.style.getPropertyValue('--fx-gradient')).toBe('0.5');
    expect(grain.style.getPropertyValue('--fx-grain')).toBe('6');
    expect(styles()).toBe(first);
  });

  it('loops a marquee over a doubled track, seekable both ways', () => {
    const { master, root } = run('Ticker', 'root.innerHTML = "<span>a</span><span>b</span>"; fx.marquee(root, { cycles: 4 });');
    const track = root.querySelector('[data-fx="marquee"]') as HTMLElement;

    master.seek(1.25);
    const early = track.style.getPropertyValue('--fx-marquee');
    master.seek(2.75);
    master.seek(1.25);

    expect(track.querySelectorAll('span')).toHaveLength(4);
    expect(early).toBe('0.5');
    expect(track.style.getPropertyValue('--fx-marquee')).toBe(early);
  });

  it('seeds the grain per clip', () => {
    const grainOf = () => (run('Grain', 'fx.grain(root);').root.querySelector('[data-fx="grain"]') as HTMLElement).style.backgroundImage;

    expect(grainOf()).toContain('seed');
    expect(grainOf()).toBe(grainOf());
  });

  it('loads Splitting for a component that splits text', () => {
    const components = { S: { source: { html: '', css: '', js: 'Splitting({ by: "chars" })' } } } as never;

    expect([...librariesOf(components, ['S'])]).toEqual([Library.Splitting]);
  });

  it('splits only inside its own clip, with index variables on every char', () => {
    document.body.insertAdjacentHTML('beforeend', '<p data-splitting id="outside">no</p>');
    const js = 'root.innerHTML = "<h1 data-splitting>hey</h1>"; const [title] = Splitting({ by: "chars" }); root.dataset.v = title.chars.map((c) => c.style.getPropertyValue("--char-index")).join();';
    const { root, errors } = run('Title', js);

    expect(errors).toEqual([]);
    expect(root.dataset.v).toBe('0,1,2');
  });

  it('drives a split by one variable or staggers its chars on tl, the same frame sought twice', () => {
    const js = 'root.innerHTML = "<h1>hey</h1>"; const h1 = root.querySelector("h1"); const [title] = Splitting({ target: h1, by: "chars" }); Splitting.drive(h1); tl.fromTo(title.chars, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.2, ease: "none" }, 0);';
    const { master, root } = run('Reveal', js);
    const h1 = root.querySelector('h1') as HTMLElement;
    const chars = () => [...root.querySelectorAll<HTMLElement>('.char')].map((c) => c.style.opacity).join();

    master.seek(1.3);
    const first = [h1.style.getPropertyValue('--split'), chars()];
    master.seek(2.9);
    master.seek(1.3);

    expect(first[0]).toBe('0.15');
    expect(first[1]).toBe('0.75,0.25,0');
    expect([h1.style.getPropertyValue('--split'), chars()]).toEqual(first);
  });

  it('loads Open Props for a component that animates with it, names one of its easings or reads its tokens', () => {
    const components = {
      A: { source: { html: '', css: '', js: 'OpenProps.animate(root, "fade-in")' } },
      E: { source: { html: '', css: '', js: 'tl.to(root, { x: 9, ease: "ease-spring-2" })' } },
      C: { source: { html: '', css: '.card{box-shadow:var(--shadow-3)}', js: '' } },
      N: { source: { html: '', css: '.card{color:var(--accent)}', js: 'tl.to(root, { x: 9, ease: "power2.out" })' } }
    } as never;

    expect(['A', 'E', 'C', 'N'].map((name) => [...librariesOf(components, [name])])).toEqual([[Library.OpenProps], [Library.OpenProps], [Library.OpenProps], []]);
  });

  it('registers the Open Props easings on the engine: a spring overshoots, the same frame sought twice', () => {
    const { master, root, errors } = run('Spring', 'tl.fromTo(root.querySelector(".dot"), { x: 0 }, { x: 100, duration: 1, ease: "ease-spring-2" }, 0); OpenProps;');
    const dot = root.querySelector('.dot') as HTMLElement;

    master.seek(1.36);
    const first = dot.style.transform;
    master.seek(2.5);
    master.seek(1.36);

    expect(errors).toEqual([]);
    expect(first).toContain('translate3d(107px');
    expect(dot.style.transform).toBe(first);
  });

  it('turns an Open Props keyframe animation into tl tweens', () => {
    const { master, root } = run('Shake', 'OpenProps.animate(root.querySelector(".dot"), "shake-x", { duration: 1, ease: "none" });');
    const dot = root.querySelector('.dot') as HTMLElement;
    const reference = run('Reference', 'tl.fromTo(root.querySelector(".dot"), { xPercent: 0 }, { xPercent: -5, duration: 0.2, ease: "none" }, 0);');
    const expected = reference.root.querySelector('.dot') as HTMLElement;

    reference.master.seek(1.2);
    master.seek(1.2);

    expect(dot.style.transform).toBe(expected.style.transform);
    expect(master.duration()).toBeGreaterThanOrEqual(2);
  });

  it('puts the Open Props tokens on the page without glows or CSS animations', () => {
    run('Tokens', 'OpenProps;');
    const css = [...document.head.querySelectorAll('style')].map((s) => s.textContent).join('');

    expect(css).toContain('--size-5:');
    expect(css).toContain('--shadow-3:');
    expect(css).toContain('--gradient-7:');
    expect(css).not.toContain('--inner-shadow');
    expect(css).not.toMatch(/@keyframes|animation:/);
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
