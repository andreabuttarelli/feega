<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const DEFAULTS = { lines: 14, speed: 1, hill: 0.95, radius: 0.3, glow: 0.5, thickness: 1.2 };
const MAX_DPR = 1.5;
const FOLLOW = 7;
const RELAX = 2.2;
const IDLE_HILL = 0.45;
const MAX_STEP = 0.1;
const COLORS = ['--topo-bg', '--topo-c1', '--topo-c2', '--topo-c3', '--topo-c4'];
const UNIFORMS = ['res', 'time', 'ptr', 'lines', 'hill', 'radius', 'glow', 'thick', 'bg', 'c1', 'c2', 'c3', 'c4'];

const VERTEX = 'vec2 p;\nvoid main() { gl_Position = vec4(p, 0.0, 1.0); }';

const FRAGMENT = `precision highp float;
uniform vec2 res;
uniform float time, lines, hill, radius, glow, thick;
uniform vec3 ptr, bg, c1, c2, c3, c4;

float hash(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 q) {
  float s = 0.0;
  float a = 0.55;
  for (int i = 0; i < 3; i++) {
    s += a * noise(q);
    q = mat2(1.6, 1.2, -1.2, 1.6) * q + 7.3;
    a *= 0.42;
  }
  return s;
}

vec3 band(float k) {
  vec3 low = mix(c1, c2, smoothstep(0.0, 0.33, k));
  vec3 mid = mix(low, c3, smoothstep(0.3, 0.62, k));
  return mix(mid, c4, smoothstep(0.6, 0.85, k));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;
  vec2 q = uv * 1.25 + vec2(time * 0.03, -time * 0.02);
  q += 0.35 * vec2(noise(q * 0.7 + time * 0.05), noise(q * 0.7 - time * 0.04 + 3.1));
  float d = length(uv - ptr.xy);
  float h = fbm(q) * 1.5 - 0.25 + ptr.z * hill * exp(-d * d / (radius * radius));
  float v = h * lines;
  float w = max(fwidth(v), 1e-4);
  float f = abs(fract(v + 0.5) - 0.5) / w;
  float idx = floor(v + 0.5);
  float major = step(mod(idx, 5.0), 0.5);
  float width = thick * (1.0 + 0.6 * major);
  float line = clamp(0.5 * width - f + 0.5, 0.0, 1.0);
  float halo = glow * 0.22 * exp(-f / (2.5 + 2.0 * major));
  vec3 tint = band(clamp(idx / lines, 0.0, 1.0));
  float bright = 0.6 + 0.4 * major + 0.25 * smoothstep(0.6, 0.9, idx / lines);
  vec3 col = bg + tint * (line * bright + halo);
  col *= 1.0 - 0.25 * dot(uv * 0.6, uv * 0.6);
  FRAG = vec4(col, 1.0);
}`;

type Knobs = typeof DEFAULTS;
type Uniforms = Record<string, WebGLUniformLocation | null>;
type GL = WebGLRenderingContext | WebGL2RenderingContext;

function knobs(root: HTMLElement): Knobs {
  const read = (name: keyof Knobs) => {
    const value = Number(root.dataset[name]);
    return Number.isFinite(value) && root.dataset[name] !== undefined ? value : DEFAULTS[name];
  };
  return { lines: read('lines'), speed: read('speed'), hill: read('hill'), radius: read('radius'), glow: read('glow'), thickness: read('thickness') };
}

function palette(root: HTMLElement): number[][] {
  const probe = document.createElement('i');
  root.appendChild(probe);
  const colors = COLORS.map((name) => {
    probe.style.color = `var(${name})`;
    const [r, g, b] = (getComputedStyle(probe).color.match(/[\d.]+/g) ?? []).map(Number);
    return [r / 255, g / 255, b / 255];
  });
  probe.remove();
  return colors;
}

function context(canvas: HTMLCanvasElement): { gl: GL; head: string } | null {
  const options = { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' } as const;
  const gl2 = canvas.getContext('webgl2', options);
  if (gl2) {
    return { gl: gl2, head: '#version 300 es\nin ' };
  }
  const gl1 = canvas.getContext('webgl', options);
  if (!gl1 || !gl1.getExtension('OES_standard_derivatives')) {
    return null;
  }
  return { gl: gl1, head: 'attribute ' };
}

function program(gl: GL, head: string): WebGLProgram | null {
  const modern = head !== 'attribute ';
  const fragHead = modern ? '#version 300 es\nout highp vec4 fragOut;\n#define FRAG fragOut\n' : '#extension GL_OES_standard_derivatives : enable\n#define FRAG gl_FragColor\n';
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, head + VERTEX));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fragHead + FRAGMENT));
  gl.bindAttribLocation(p, 0, 'p');
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

function topo(root: HTMLElement): () => void {
  const canvas = root.querySelector('.field') as HTMLCanvasElement;
  const ctx = context(canvas);
  if (!ctx) {
    canvas.remove();
    return () => {};
  }
  const { gl, head } = ctx;
  const prog = program(gl, head);
  if (!prog) {
    canvas.remove();
    return () => {};
  }

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const k = knobs(root);
  const u: Uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(prog, name)]));
  const goal = { x: 0, y: 0, z: IDLE_HILL };
  const now = { x: 0, y: 0, z: IDLE_HILL };

  let colors = palette(root);
  let inside = false;
  let visible = true;
  let frame = 0;
  let last = 0;
  let clock = 0;

  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function measure() {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(u.thick, k.thickness * dpr);
    colors = palette(root);
  }

  function idle() {
    goal.x = 0.35 * Math.sin(clock * 0.13);
    goal.y = 0.2 * Math.cos(clock * 0.1);
    goal.z = IDLE_HILL;
  }

  function draw() {
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, clock * k.speed);
    gl.uniform3f(u.ptr, now.x, now.y, now.z);
    gl.uniform1f(u.lines, k.lines);
    gl.uniform1f(u.hill, k.hill);
    gl.uniform1f(u.radius, k.radius);
    gl.uniform1f(u.glow, k.glow);
    ['bg', 'c1', 'c2', 'c3', 'c4'].forEach((name, i) => gl.uniform3fv(u[name], colors[i]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(time: number) {
    const step = Math.min(MAX_STEP, last ? (time - last) / 1000 : 0);
    last = time;
    clock += step;
    if (!inside) {
      idle();
    }
    const ease = 1 - Math.exp(-step * (inside ? FOLLOW : RELAX));
    now.x += (goal.x - now.x) * ease;
    now.y += (goal.y - now.y) * ease;
    now.z += (goal.z - now.z) * ease;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (frame || still || !visible || document.hidden) {
      return;
    }
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function settle() {
    if (!still) {
      return;
    }
    Object.assign(now, goal);
    draw();
  }

  function move(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    inside = true;
    goal.x = (event.clientX - box.left - box.width / 2) / box.height;
    goal.y = (box.height / 2 - (event.clientY - box.top)) / box.height;
    goal.z = 1;
    settle();
  }

  function leave() {
    inside = false;
    idle();
    settle();
  }

  function sync() {
    if (document.hidden) {
      stop();
      return;
    }
    start();
  }

  const sizes = new ResizeObserver(() => {
    measure();
    draw();
  });
  const view = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      start();
      return;
    }
    stop();
  });

  sizes.observe(canvas);
  view.observe(root);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerdown', move);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('pointercancel', leave);
  document.addEventListener('visibilitychange', sync);
  idle();
  Object.assign(now, goal);
  measure();
  draw();
  start();

  return () => {
    stop();
    sizes.disconnect();
    view.disconnect();
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerdown', move);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('pointercancel', leave);
    document.removeEventListener('visibilitychange', sync);
  };
}

const root = ref<HTMLElement | null>(null);
let stop = () => {};

onMounted(() => {
  stop = topo(root.value as HTMLElement);
});
onBeforeUnmount(() => stop());
</script>

<template>
  <div class="fl-topo-shader" data-theme="dark" data-layout="card" data-layout-options="card,full" data-lines="14" data-speed="1" data-hill="0.95" data-radius="0.3" data-glow="0.5" data-thickness="1.2" ref="root">
    <canvas class="field" aria-hidden="true"></canvas>
    <div class="content">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="13"></circle>
        <circle cx="16" cy="16" r="7.5"></circle>
        <circle cx="16" cy="16" r="2.5"></circle>
      </svg>
      <div class="figure">
        <p class="amount"><span class="value">1,204.18</span><span class="unit">credits</span></p>
        <p class="meta">feega.app/you</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fl-topo-shader{font-family:var(--feega-font);font-size:var(--feega-text-body);line-height:1.5;letter-spacing:var(--feega-tracking);color:var(--feega-fg);background:var(--feega-bg);-webkit-font-smoothing:antialiased}
:where(.fl-topo-shader) *,:where(.fl-topo-shader) *::before,:where(.fl-topo-shader) *::after{box-sizing:border-box}
:where(.fl-topo-shader) :is(h1,h2,h3,h4,p,ul,ol,figure,blockquote,dl,dd){margin:0}
:where(.fl-topo-shader) a{color:inherit;text-decoration:none}
:where(.fl-topo-shader) :focus-visible{outline:2px solid var(--feega-focus);outline-offset:3px}
.fl-topo-shader{--topo-bg:#08080b;--topo-c1:#2fd2c1;--topo-c2:#4a6cf0;--topo-c3:#c757d6;--topo-c4:#f2b547;position:relative;isolation:isolate;overflow:hidden;width:100%;max-width:34rem;aspect-ratio:3/2;margin-inline:auto;border-radius:var(--feega-radius-lg);background:radial-gradient(120% 90% at 70% 30%,color-mix(in srgb,var(--topo-c4) 16%,transparent),transparent 60%),radial-gradient(90% 80% at 20% 80%,color-mix(in srgb,var(--topo-c2) 18%,transparent),transparent 65%),var(--topo-bg);color:var(--feega-fg);box-shadow:inset 0 0 0 1px var(--feega-line);touch-action:none;user-select:none;-webkit-user-select:none}
.fl-topo-shader[data-layout="full"]{max-width:none;aspect-ratio:auto;min-height:clamp(28rem,80svh,48rem);border-radius:0;box-shadow:none}
.fl-topo-shader .field{position:absolute;inset:0;z-index:-1;display:block;width:100%;height:100%}
.fl-topo-shader .content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(1.25rem,5%,2.25rem);pointer-events:none}
.fl-topo-shader .mark{width:2.25rem;height:2.25rem;fill:none;stroke:currentColor;stroke-width:2.5;opacity:0.85}
.fl-topo-shader .figure{display:grid;gap:var(--feega-space-2)}
.fl-topo-shader .amount{display:flex;align-items:baseline;gap:0.5rem;margin:0;font-family:var(--feega-font-display);font-size:clamp(2rem,7vw,3.25rem);font-weight:600;line-height:1;letter-spacing:var(--feega-tracking-tight);font-variant-numeric:tabular-nums}
.fl-topo-shader .unit{color:var(--feega-fg-muted);font-family:var(--feega-font-mono);font-size:var(--feega-text-sm);font-weight:400;letter-spacing:0.04em;text-transform:uppercase}
.fl-topo-shader .meta{margin:0;color:var(--feega-fg-muted);font-family:var(--feega-font-mono);font-size:var(--feega-text-sm)}
@media (prefers-reduced-motion:reduce){:where([class^="fl-"]) *,:where([class^="fl-"]) *::before,:where([class^="fl-"]) *::after{animation:none!important;transition:none!important}}
</style>
