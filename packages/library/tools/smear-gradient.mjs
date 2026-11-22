const HEADING = 'soft focus';
const TEXT = 'drag across to smear the light';
const KNOBS = { speed: 1, smear: 1, columns: 28, pixel: 0.6, radius: 0.22, grain: 0.5 };
const PALETTE = ['#E8DECA', '#7395DE', '#F26A2C', '#EE5C9E', '#C9CCD8'];

const vars = PALETTE.map((hex, i) => `--smear-c${i + 1}:${hex}`).join(';');

const css = [
  `.fl-smear-gradient{${vars};position:relative;display:grid;place-items:center;min-height:clamp(28rem,80svh,48rem);overflow:hidden;isolation:isolate;touch-action:pan-y;background:radial-gradient(60% 45% at 25% 100%,var(--smear-c4),transparent 70%),radial-gradient(70% 50% at 80% 95%,var(--smear-c3),transparent 70%),radial-gradient(90% 30% at 50% 52%,var(--smear-c2),transparent 75%),radial-gradient(80% 30% at 50% 72%,var(--smear-c5),transparent 75%),var(--smear-c1)}`,
  '.fl-smear-gradient .overlay{display:grid;gap:var(--feega-space-3);padding:var(--feega-gutter);text-align:center;pointer-events:none}',
  '.fl-smear-gradient h2{font-family:var(--feega-font-display);font-size:var(--feega-text-title);font-weight:500;line-height:0.95;letter-spacing:var(--feega-tracking-tight);text-wrap:balance}',
  '.fl-smear-gradient .overlay p{color:var(--feega-fg-muted);font-size:var(--feega-text-sm);text-wrap:balance}'
];

const t = (typed, s) => (typed ? s : '');

const FRAGMENT = `precision highp float;
uniform vec2 res;
uniform float time;
uniform vec3 pal[5];
uniform vec3 trail[TRAIL];
uniform vec2 vel;
uniform float smear;
uniform float columns;
uniform float pixel;
uniform float radius;
uniform float grain;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}

float fbm(vec2 p) {
  return noise(p) * 0.55 + noise(p * 2.1 + 3.7) * 0.3 + noise(p * 4.3 - 1.3) * 0.15;
}

float band(float y, float at, float width) {
  float d = (y - at) / width;
  return exp(-d * d);
}

vec3 field(vec2 p, float aspect) {
  vec2 a = vec2(p.x * aspect, p.y);
  vec2 q = vec2(fbm(a * 1.2 + vec2(time * 0.05, 0.0)), fbm(a * 1.2 + vec2(4.1, -time * 0.04)));
  vec2 w = a + (q - 0.5) * 0.6;
  float y = p.y + (fbm(w * 1.5 + time * 0.03) - 0.5) * 0.3;
  float h = fbm(w * 1.7 + vec2(-time * 0.06, 2.0));

  float warm = 1.0 - smoothstep(0.12, 0.36, y);
  float mist = band(y, 0.32, 0.09) * 0.7;
  float blue = band(y, 0.47, 0.1);
  float cream = smoothstep(0.5, 0.72, y);
  vec3 hot = mix(pal[2], pal[3], smoothstep(0.38, 0.68, h));
  vec3 c = hot * warm + pal[4] * mist + pal[1] * blue + pal[0] * cream;
  return c / max(warm + mist + blue + cream, 0.001);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;

  float s = 0.0;
  for (int i = 0; i < TRAIL; i++) {
    vec2 d = (uv - trail[i].xy) * vec2(aspect, 0.45);
    s += trail[i].z * exp(-dot(d, d) / (radius * radius));
  }
  s = clamp(s * smear, 0.0, 1.0);

  float k = uv.x * columns;
  float cell = 1.0 / (columns * 2.0);
  float block = clamp(s * 1.6, 0.0, 1.0) * pixel;
  float x = mix(uv.x, (floor(uv.x / cell) + 0.5) * cell, block);
  x += sin(uv.y * 24.0 + time * 2.0 + k * 0.6) * 0.014 * s - vel.x * s * 0.04;

  float ribbon = noise(vec2(x * columns * 0.5, time * 0.25)) - 0.5;
  float wave = sin(x * columns * 0.9 + time * 1.3);
  float anchor = 0.4 + ribbon * 1.1 + wave * 0.08;
  float y = mix(uv.y, anchor, s * 0.9);
  y += sin(uv.y * 16.0 + time * 1.7 + x * columns * 1.3) * 0.05 * s;
  y = mix(y, (floor(y / cell) + 0.5) * cell, block * 0.6);

  vec3 c = field(vec2(x, y), aspect);
  c += (hash(gl_FragCoord.xy + fract(time)) - 0.5) * grain * 0.06;
  gl_FragColor = vec4(c, 1.0);
}`;

const engine = (typed) => `const KNOBS = ${JSON.stringify(KNOBS)};
const TRAIL = 16;
const MAX_DPR = 1.5;
const MAX_STEP = 0.1;
const FOLLOW = 6;
const DECAY = 0.7;
const SPACING = 0.02;
const IDLE_MS = 2500;
const DRIFT = 0.45;
const COLORS = 5;
const CANVAS = 'position:absolute;inset:0;z-index:-1;width:100%;height:100%;display:block';
const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}';
const FRAGMENT = \`${FRAGMENT}\`;

function compile(gl${t(typed, ': WebGLRenderingContext')}, kind${t(typed, ': number')}, source${t(typed, ': string')}) {
  const shader = gl.createShader(kind)${t(typed, ' as WebGLShader')};
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function program(gl${t(typed, ': WebGLRenderingContext')})${t(typed, ': WebGLProgram | null')} {
  const p = gl.createProgram()${t(typed, ' as WebGLProgram')};
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, \`#define TRAIL \${TRAIL}\\n\${FRAGMENT}\`));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

function channels(paint${t(typed, ': CanvasRenderingContext2D')}, value${t(typed, ': string')})${t(typed, ': number[]')} {
  paint.fillStyle = value.trim() || 'transparent';
  const style = String(paint.fillStyle);
  if (style.startsWith('#')) {
    return [1, 3, 5].map((i) => parseInt(style.slice(i, i + 2), 16) / 255);
  }
  return (style.match(/[\\d.]+/g) ?? []).slice(0, 3).map((n) => Number(n) / 255);
}

function smear(root${t(typed, ': HTMLElement')})${t(typed, ': () => void')} {
  const canvas = document.createElement('canvas');
  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))${t(typed, ' as WebGLRenderingContext | null')};
  const p = gl && program(gl);
  if (!gl || !p) {
    return () => {};
  }

  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = CANVAS;
  root.prepend(canvas);
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const at = (name${t(typed, ': string')}) => gl.getUniformLocation(p, name);
  const u = { res: at('res'), time: at('time'), pal: at('pal'), trail: at('trail'), vel: at('vel'), smear: at('smear'), columns: at('columns'), pixel: at('pixel'), radius: at('radius'), grain: at('grain') };
  const paint = document.createElement('canvas').getContext('2d')${t(typed, ' as CanvasRenderingContext2D')};
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const trail = new Float32Array(TRAIL * 3);
  const target = { x: 0.5, y: 0.5 };
  const pos = { x: 0.5, y: 0.5 };
  const last = { x: 0.5, y: 0.5 };
  const vel = { x: 0, y: 0 };
  let knobs = { ...KNOBS };
  let head = 0;
  let clock = 0;
  let touched = -Infinity;
  let visible = true;
  let frame = 0;
  let prev = 0;

  function knob(name${t(typed, ': keyof typeof KNOBS')})${t(typed, ': number')} {
    const value = Number(root.dataset[name]);
    return Number.isFinite(value) && root.dataset[name] !== '' ? value : KNOBS[name];
  }

  function read() {
    knobs = { speed: knob('speed'), smear: knob('smear'), columns: knob('columns'), pixel: knob('pixel'), radius: knob('radius'), grain: knob('grain') };
    const style = getComputedStyle(root);
    const pal = Array.from({ length: COLORS }, (_, i) => channels(paint, style.getPropertyValue(\`--smear-c\${i + 1}\`))).flat();
    gl${t(typed, '!')}.uniform3fv(u.pal, pal);
    gl${t(typed, '!')}.uniform1f(u.smear, knobs.smear);
    gl${t(typed, '!')}.uniform1f(u.columns, Math.max(1, knobs.columns));
    gl${t(typed, '!')}.uniform1f(u.pixel, knobs.pixel);
    gl${t(typed, '!')}.uniform1f(u.radius, Math.max(0.01, knobs.radius));
    gl${t(typed, '!')}.uniform1f(u.grain, knobs.grain);
  }

  function resize() {
    const dpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(root.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(root.clientHeight * dpr));
    gl${t(typed, '!')}.viewport(0, 0, canvas.width, canvas.height);
    gl${t(typed, '!')}.uniform2f(u.res, canvas.width, canvas.height);
  }

  function drift() {
    const k = clock * DRIFT;
    target.x = 0.5 + Math.sin(k) * 0.32 + Math.sin(k * 0.37) * 0.08;
    target.y = 0.48 + Math.sin(k * 0.71 + 1) * 0.2;
  }

  function step(dt${t(typed, ': number')}) {
    if (performance.now() - touched > IDLE_MS) {
      drift();
    }
    const ease = 1 - Math.exp(-dt * FOLLOW);
    pos.x += (target.x - pos.x) * ease;
    pos.y += (target.y - pos.y) * ease;
    vel.x = (pos.x - last.x) / Math.max(dt, 0.001);
    vel.y = (pos.y - last.y) / Math.max(dt, 0.001);
    last.x = pos.x;
    last.y = pos.y;

    const fade = Math.exp(-dt * DECAY);
    for (let i = 2; i < trail.length; i += 3) {
      trail[i] *= fade;
    }

    const h = head * 3;
    const moved = Math.hypot(pos.x - trail[h], pos.y - trail[h + 1]);
    if (moved > SPACING) {
      head = (head + 1) % TRAIL;
    }
    const n = head * 3;
    trail[n] = pos.x;
    trail[n + 1] = pos.y;
    trail[n + 2] = Math.min(1, Math.max(trail[n + 2], 0.45 + Math.hypot(vel.x, vel.y) * 0.4));
  }

  function draw() {
    const g = gl${t(typed, '!')};
    g.uniform1f(u.time, clock);
    g.uniform3fv(u.trail, trail);
    g.uniform2f(u.vel, Math.max(-2, Math.min(2, vel.x)), Math.max(-2, Math.min(2, vel.y)));
    g.drawArrays(g.TRIANGLES, 0, 3);
  }

  function tick(now${t(typed, ': number')}) {
    const dt = Math.min(MAX_STEP, (now - prev) / 1000);
    prev = now;
    clock += dt * knobs.speed;
    step(dt);
    draw();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (frame || still || !visible || document.hidden) {
      return;
    }
    prev = performance.now();
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function point(event${t(typed, ': PointerEvent')}) {
    const box = root.getBoundingClientRect();
    target.x = (event.clientX - box.left) / box.width;
    target.y = 1 - (event.clientY - box.top) / box.height;
    touched = performance.now();
  }

  function sync() {
    if (document.hidden) {
      stop();
      return;
    }
    start();
  }

  function refresh() {
    read();
    if (still) {
      draw();
    }
  }

  const sizes = new ResizeObserver(() => {
    resize();
    if (still) {
      draw();
    }
  });
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      start();
      return;
    }
    stop();
  });
  const edits = new MutationObserver(refresh);

  read();
  resize();
  draw();
  sizes.observe(root);
  view.observe(root);
  edits.observe(root, { attributes: true });
  root.addEventListener('pointermove', point);
  root.addEventListener('pointerdown', point);
  document.addEventListener('visibilitychange', sync);
  start();

  return () => {
    stop();
    sizes.disconnect();
    view.disconnect();
    edits.disconnect();
    root.removeEventListener('pointermove', point);
    root.removeEventListener('pointerdown', point);
    document.removeEventListener('visibilitychange', sync);
    canvas.remove();
  };
}`;

const data = Object.entries(KNOBS)
  .map(([k, v]) => `data-${k}="${v}"`)
  .join(' ');

const shell = (root) => `<section class="fl-smear-gradient" data-theme="light" aria-label="Smeared gradient" ${data}${root}>
  <div class="overlay">
    <h2>${HEADING}</h2>
    <p>${TEXT}</p>
  </div>
</section>`;

const pad = (text, n) =>
  text
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

const domBoot = (typed) => `${engine(typed)}

document.querySelectorAll${t(typed, '<HTMLElement>')}('.fl-smear-gradient:not([data-ready])').forEach((root) => {
  root.setAttribute('data-ready', '');
  smear(root);
});`;

const jsx = (markup) => markup.replace(/class="/g, 'className="');

export const smearGradient = {
  id: 'smear-gradient',
  name: 'Smear gradient',
  description: 'A warm WebGL gradient that smears into wavy vertical streaks wherever the cursor drags.',
  category: 'section',
  tags: ['shader', 'gradient', 'webgl', 'interactive', 'background'],
  mods: [],
  css,
  files: (C) => ({
    html: `${shell('')}\n\n<script>\n(() => {\n${pad(domBoot(false), 2)}\n})();\n</script>\n`,
    astro: `---
---

${shell('')}

<script>
${domBoot(true)}
</script>

<style is:global>
${C}</style>
`,
    svelte: `<script lang="ts">
${pad(engine(true), 2)}

  let root: HTMLElement;

  $effect(() => smear(root));
</script>

${shell(' bind:this={root}')}

<style>
${C}</style>
`,
    react: `import { useEffect, useRef } from 'react';
import './SmearGradient.css';

${engine(true)}

export function SmearGradient() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => (root.current ? smear(root.current) : undefined), []);

  return (
${pad(jsx(shell(' ref={root}')), 4)}
  );
}
`,
    vue: `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

${engine(true)}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = smear(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
${pad(shell(' ref="root"'), 2)}
</template>

<style scoped>
${C}</style>
`
  })
};
