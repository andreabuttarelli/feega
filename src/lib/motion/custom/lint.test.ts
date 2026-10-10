import { describe, expect, it } from 'vitest';
import { lintAdvice, lintSource } from './lint';
import { ComponentMode } from './component';

const ok = { html: '<div class="node"><span class="port"></span></div>', css: '.node{width:200px;background:#111}', js: 'tl.from(root.querySelector(".node"),{scale:0,duration:0.4,ease:"back.out"});' };

const problemsOf = (patch: Partial<typeof ok>) => lintSource({ ...ok, ...patch }).map((p) => p.message);

describe('the authoring contract', () => {
  it('accepts a component that animates only on the provided timeline', () => {
    expect(lintSource(ok)).toEqual([]);
  });

  it.each([
    ['setTimeout(() => {}, 10);', 'setTimeout'],
    ['setInterval(f, 10);', 'setInterval'],
    ['requestAnimationFrame(f);', 'requestAnimationFrame'],
    ['fetch("https://x.y");', 'fetch'],
    ['new XMLHttpRequest();', 'XMLHttpRequest'],
    ['new WebSocket("wss://x");', 'WebSocket'],
    ['import("https://x.y/m.js");', 'import()'],
    ['eval("1");', 'eval'],
    ['new Function("return 1");', 'Function'],
    ['parent.postMessage(1, "*");', 'parent'],
    ['top.location = "x";', 'top'],
    ['window.foo = 1;', 'window'],
    ['document.cookie;', 'document.cookie'],
    ['localStorage.getItem("a");', 'localStorage'],
    ['const t = Date.now();', 'Date.now'],
    ['const d = new Date();', 'new Date()'],
    ['const r = Math.random();', 'Math.random'],
    ['const F = (() => {}).constructor;', 'constructor'],
    ['performance.now();', 'performance'],
    ['d3.timer(() => {});', 'd3.timer'],
    ['d3.interval(f, 10);', 'd3.interval'],
    ['d3.timeout(f, 10);', 'd3.timeout'],
    ['d3.now();', 'd3.now'],
    ['d3.select(root).transition().attr("x", 1);', 'transition'],
    ['d3.transition();', 'transition'],
    ['p5((p) => { p.setup = () => p.loop(); });', 'loop'],
    ['p5((p) => { p.setup = () => p.frameRate(60); });', 'frameRate'],
    ['p5((p) => { p.draw = () => p.circle(p.millis(), 0, 9); });', 'millis'],
    ['p5((p) => { p.draw = () => p.circle(p.deltaTime, 0, 9); });', 'deltaTime'],
    ['app.ticker.add(() => {});', 'ticker'],
    ['PIXI.Ticker.shared.add(f);', 'Ticker'],
    ['Matter.Runner.run(engine);', 'Matter.Runner'],
    ['Matter.Render.run(render);', 'Matter.Render']
  ])('refuses %s', (js, name) => {
    expect(problemsOf({ js }).join(' ')).toContain(name);
  });

  it.each(['n.toLocaleString();', 'd.toLocaleDateString("it");', 'new Intl.NumberFormat("en").format(1);'])('refuses %s and points at format', (js) => {
    expect(problemsOf({ js }).join(' ')).toContain('format.');
  });

  it('allows a fixed date and the seeded rand', () => {
    expect(problemsOf({ js: 'const d = new Date(2026, 9, 3); const r = rand();' })).toEqual([]);
  });

  it('allows a local variable that shares a name with a browser global', () => {
    expect(problemsOf({ js: 'const top = 10; const { self } = props; function f(location) { return location + top; }' })).toEqual([]);
  });

  it('reports a syntax error with its line', () => {
    expect(problemsOf({ js: 'tl.to(\n  root,{x:1}' })[0]).toMatch(/line 2|line 3/);
  });

  it.each([
    ['.a{animation:spin 1s}', 'animation'],
    ['@keyframes spin{to{transform:rotate(1turn)}}', '@keyframes'],
    ['.a{transition:opacity .2s}', 'transition'],
    ['@import url(x.css);', '@import'],
    ['.a{background:url(https://evil.example/x.png)}', 'url('],
    ['@font-face{font-family:x;src:url(data:font/woff2;base64,AA)}', '@font-face']
  ])('refuses the css %s', (css, name) => {
    expect(problemsOf({ css }).join(' ')).toContain(name);
  });

  it('allows a data url picture in css', () => {
    expect(problemsOf({ css: '.a{background:url(data:image/png;base64,AAAA)}' })).toEqual([]);
  });

  it.each([
    ['<script>alert(1)</script>', '<script'],
    ['<img src="https://evil.example/p.png">', 'src'],
    ['<div onclick="x()"></div>', 'onclick'],
    ['<iframe src="x"></iframe>', '<iframe'],
    ['<a href="javascript:x()">x</a>', 'javascript:'],
    ['<video autoplay></video>', '<video'],
    ['<style>.a{}</style>', '<style']
  ])('refuses the html %s', (html, name) => {
    expect(problemsOf({ html }).join(' ')).toContain(name);
  });
});

describe('a live component', () => {
  const liveProblems = (patch: Partial<typeof ok>) => lintSource({ ...ok, ...patch }, ComponentMode.Live).map((p) => p.message);

  it.each([
    'requestAnimationFrame(function loop() { requestAnimationFrame(loop); });',
    'setTimeout(() => {}, 10); setInterval(f, 10);',
    'const r = Math.random(); const t = Date.now(); const d = new Date(); performance.now();',
    'p5((p) => { p.setup = () => p.frameRate(60); p.draw = () => p.circle(p.millis(), 0, p.deltaTime); });',
    'app.ticker.add(() => {}); d3.timer(() => {});'
  ])('runs its own loop: %s', (js) => {
    expect(liveProblems({ js })).toEqual([]);
  });

  it('may animate with CSS', () => {
    expect(liveProblems({ css: '@keyframes spin{to{transform:rotate(1turn)}} .a{animation:spin 1s;transition:opacity .2s}' })).toEqual([]);
  });

  it.each([
    ['fetch("https://x.y");', 'fetch'],
    ['localStorage.getItem("a");', 'localStorage'],
    ['parent.postMessage(1, "*");', 'parent'],
    ['eval("1");', 'eval'],
    ['new Function("return 1");', 'Function'],
    ['window.foo = 1;', 'window'],
    ['import("https://x.y/m.js");', 'import()']
  ])('still stays in the sandbox: %s', (js, name) => {
    expect(liveProblems({ js }).join(' ')).toContain(name);
  });

  it('keeps network out of its css', () => {
    expect(liveProblems({ css: '@import url(x.css);' }).join(' ')).toContain('@import');
  });
});

describe('game engines', () => {
  it.each(['LittleJS.engineInit(() => {}, () => {}, () => {}, () => {}, () => {});', 'const k = kaplay();'])('need a live component: %s', (js) => {
    expect(problemsOf({ js }).join(' ')).toContain('declare the component live');
    expect(lintSource({ ...ok, js }, ComponentMode.Live)).toEqual([]);
  });
});

const SCENE = 'const canvas = root.querySelector("canvas"); const renderer = three.renderer(canvas); const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100); tl.to({}, { duration, onUpdate() { renderer.render(scene, camera); } }); onDestroy(() => renderer.dispose());';

const adviceOf = (js: string) => lintAdvice({ html: '<canvas></canvas>', css: '', js });

describe('3D performance advice', () => {
  it('stays quiet on a scene built the way the guide says', () => {
    expect(adviceOf(SCENE)).toEqual([]);
  });

  it.each([
    [SCENE.replace('three.renderer(canvas)', 'new THREE.WebGLRenderer({ canvas })'), 'WebGLRenderer'],
    [SCENE + ' renderer.setPixelRatio(2);', 'setPixelRatio'],
    [SCENE + ' const other = three.renderer(root.querySelector("canvas + canvas"));', 'one renderer'],
    [SCENE.replace(' onDestroy(() => renderer.dispose());', ''), 'dispose'],
    [SCENE + ' renderer.shadowMap.enabled = true; scene.add(new THREE.PointLight(), new THREE.SpotLight(), new THREE.DirectionalLight());', 'shadow']
  ])('warns on %s', (js, word) => {
    expect(adviceOf(js).join('\n')).toContain(word);
  });

  it('a shadow map with one light and ambient fill is fine', () => {
    expect(adviceOf(SCENE + ' renderer.shadowMap.enabled = true; scene.add(new THREE.AmbientLight(), new THREE.DirectionalLight());')).toEqual([]);
  });

  it('a component without WebGL gets no advice', () => {
    expect(adviceOf('tl.from(root, { opacity: 0 });')).toEqual([]);
  });

  it('THREE.Clock is refused in a deterministic component and allowed in a live one', () => {
    const js = 'const clock = new THREE.Clock();';
    expect(problemsOf({ js }).join('\n')).toContain('THREE.Clock');
    expect(lintSource({ ...ok, js }, ComponentMode.Live)).toEqual([]);
  });
});

