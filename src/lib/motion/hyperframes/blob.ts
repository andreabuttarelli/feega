import type { Keyframe } from '../keyframes';
import { BLOB_NUMBERS } from '../blob/model';
import { blobRows } from '../blob/pose';
import { DEPTH, FLAT, ROW } from '../blob/shape';
import { paintOps, paintPlan } from './blob-paint';
import { ON_DISPOSE, hotScope, hotSeek } from './hot';
import { seekDriver } from './stage';
import { esc, js } from './html';

export const BLOB_TIMELINE = 'feegaBlob';
export const BLOB_GL = '__feegaBlobGl';

export const blobIds = {
  scope: (id: string) => `lbw-${id}`,
  canvas: (id: string) => `lb-${id}`
};

export type BlobClip = { id: string; from: number; durationInFrames: number; props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined> };
export type BlobFrame = { width: number; height: number; fps: number; color: (v: string) => string };
export type BlobBake = { id: string; start: number; length: number; fps: number; width: number; height: number; seed: number; rows: number[][] };

export function blobLayer(clip: BlobClip, frame: BlobFrame, inner: string, zIndex: number): string {
  const scope = `<div class="ef" id="${blobIds.scope(clip.id)}" data-clip="${esc(clip.id)}" data-group="${esc(clip.id)}" style="z-index:${zIndex}">${inner}</div>`;
  const canvas = `<canvas class="ef" id="${blobIds.canvas(clip.id)}" width="${frame.width}" height="${frame.height}" aria-hidden="true" style="z-index:${zIndex};width:100%;height:100%;pointer-events:none"></canvas>`;
  return `${scope}${canvas}<!--/group:${esc(clip.id)}-->`;
}

export function blobBake(clip: BlobClip, frame: BlobFrame): BlobBake {
  return {
    id: clip.id,
    start: clip.from / frame.fps,
    length: clip.durationInFrames / frame.fps,
    fps: frame.fps,
    width: frame.width,
    height: frame.height,
    seed: Number(clip.props.seed ?? BLOB_NUMBERS.seed.fallback),
    rows: blobRows(clip, frame, frame.color)
  };
}

const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

const FRAGMENT = `
precision highp float;
uniform sampler2D uContent;
uniform vec2 uSize;
uniform vec2 uCenter;
uniform vec3 uDrop[4];
uniform vec3 uUnwarp;
uniform float uBlend;
uniform float uWobble;
uniform float uWobbleSpeed;
uniform float uTime;
uniform float uSeed;
uniform float uIor;
uniform float uDisp;
uniform float uFrost;
uniform float uRefl;
uniform float uTintAmt;
uniform float uPresence;
uniform vec3 uTint;
const float FLAT = ${FLAT.toFixed(4)};
const float DEPTH = ${DEPTH.toFixed(4)};
const float TAU = 6.2831853;
const vec3 KEY = vec3(-0.42, -0.58, 0.70);
const vec3 FILL = vec3(0.78, 0.18, 0.60);
const int FROST_TAPS = 12;

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float ripple(vec3 q) {
  float t = uTime * uWobbleSpeed * TAU;
  return sin(q.x * 2.3 + t + uSeed) * sin(q.y * 1.9 - t * 0.83 + uSeed * 1.37)
    + 0.55 * sin((q.x - q.y) * 3.1 + t * 1.61 + uSeed * 2.11)
    + 0.3 * sin(q.z * 4.0 + q.x * 2.7 - t * 2.27 + uSeed * 0.71);
}

float field(vec3 p) {
  vec2 rel = p.xy - uCenter;
  vec2 q = uCenter + vec2(uUnwarp.x * rel.x + uUnwarp.y * rel.y, uUnwarp.y * rel.x + uUnwarp.z * rel.y);
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    vec3 c = uDrop[i];
    if (c.z < 0.5) { continue; }
    d = smin(d, length(vec3(q - c.xy, p.z / FLAT)) - c.z, uBlend);
  }
  return d + uWobble * ripple(vec3(q - uCenter, p.z) / uDrop[0].z);
}

float flatField(vec2 p) {
  return field(vec3(p, 0.0));
}

vec2 uvOf(vec2 p) {
  return vec2(p.x / uSize.x, 1.0 - p.y / uSize.y);
}

vec3 content(vec2 p) {
  if (uFrost < 0.5) { return texture2D(uContent, uvOf(p)).rgb; }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < FROST_TAPS; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / float(FROST_TAPS)) * uFrost;
    sum += texture2D(uContent, uvOf(p + vec2(cos(a), sin(a)) * r)).rgb;
  }
  return sum / float(FROST_TAPS);
}

vec3 env(vec3 r) {
  vec3 c = mix(vec3(0.025, 0.03, 0.04), vec3(0.15, 0.16, 0.19), smoothstep(-0.1, 0.9, r.z));
  c += vec3(1.0) * smoothstep(0.90, 0.985, dot(r, normalize(KEY))) * 1.7;
  c += vec3(0.75, 0.85, 1.0) * smoothstep(0.955, 0.995, dot(r, normalize(FILL))) * 0.9;
  c += vec3(0.55) * pow(max(1.0 - abs(r.z), 0.0), 10.0) * 0.3;
  return c;
}

vec2 bent(vec2 p, vec3 n, float zs, float eta, float depth) {
  vec3 inside = refract(vec3(0.0, 0.0, -1.0), n, eta);
  vec2 off = inside.xy * zs / max(-inside.z, 0.12);
  vec3 leaving = refract(inside, vec3(0.0, 0.0, 1.0), 1.0 / eta);
  if (dot(leaving, leaving) < 1e-4) { return vec2(1e5); }
  return p + off + leaving.xy * depth / max(-leaving.z, 0.12);
}

vec3 look(vec2 at, vec3 n) {
  if (at.x > 9e4) { return env(reflect(vec3(0.0, 0.0, -1.0), n)) * 0.35; }
  return content(at);
}

vec4 under(vec2 p, float r0) {
  vec2 o = vec2(0.10, 0.22) * r0;
  float fs = flatField(p - o);
  float shade = 0.7 * (1.0 - smoothstep(-0.35 * r0, 0.5 * r0, fs));
  float focus = smoothstep(0.0, -0.4 * r0, flatField(p - o * 1.35) + 0.42 * r0);
  vec3 light = mix(vec3(1.0), uTint, 0.5) * focus * 0.55;
  return vec4(light, shade);
}

float grain(vec2 p) {
  return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  float r0 = uDrop[0].z;
  float f0 = flatField(p);
  vec4 below = under(p, r0);
  if (f0 > 1.0) {
    gl_FragColor = below * uPresence;
    return;
  }
  float lo = 0.0;
  float hi = r0 * FLAT * 2.2 + uWobble * 2.0;
  for (int i = 0; i < 16; i++) {
    float mid = 0.5 * (lo + hi);
    if (field(vec3(p, mid)) < 0.0) { lo = mid; } else { hi = mid; }
  }
  vec3 s = vec3(p, lo);
  vec3 e = vec3(1.0, 0.0, 0.0);
  vec3 n = normalize(vec3(field(s + e.xyy) - field(s - e.xyy), field(s + e.yxy) - field(s - e.yxy), field(s + e.yyx) - field(s - e.yyx)));
  float depth = DEPTH * r0;
  vec3 seen = vec3(
    look(bent(p, n, lo, 1.0 / max(uIor - uDisp, 1.0001), depth), n).r,
    look(bent(p, n, lo, 1.0 / uIor, depth), n).g,
    look(bent(p, n, lo, 1.0 / (uIor + uDisp), depth), n).b
  );
  seen = mix(seen, seen * uTint, uTintAmt) + uTint * uTintAmt * 0.05;
  float f0r = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
  float fresnel = f0r + (1.0 - f0r) * pow(1.0 - max(n.z, 0.0), 5.0);
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 key = normalize(KEY);
  vec3 fill = normalize(FILL);
  float spec = pow(max(dot(n, normalize(key + view)), 0.0), 900.0) * 3.2 + pow(max(dot(n, normalize(key + view)), 0.0), 70.0) * 0.12 + pow(max(dot(n, normalize(fill + view)), 0.0), 500.0) * 1.1;
  vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
  float edge = smoothstep(2.6, 0.0, -f0);
  float rim = edge * 1.2 * (0.3 + 0.7 * max(dot(side, normalize(key.xy)), 0.0));
  float glow = smoothstep(0.38 * r0, 0.0, -f0) * max(dot(side, -normalize(key.xy)), 0.0) * 0.22;
  vec3 glass = seen * (1.0 - fresnel * uRefl) + env(reflect(-view, n)) * fresnel * uRefl + (spec + rim) * uRefl + mix(vec3(1.0), uTint, 0.6) * glow + grain(p) * 0.03;
  float cover = clamp(0.5 - f0, 0.0, 1.0);
  gl_FragColor = (vec4(glass, 1.0) * cover + below * (1.0 - cover)) * uPresence;
}
`;

const RUNTIME = `
const kept = (window.${BLOB_GL} = window.${BLOB_GL} || {});
const UNIFORMS = ['uContent', 'uSize', 'uCenter', 'uDrop', 'uUnwarp', 'uBlend', 'uWobble', 'uWobbleSpeed', 'uTime', 'uSeed', 'uIor', 'uDisp', 'uFrost', 'uRefl', 'uTintAmt', 'uPresence', 'uTint'];

function compile(gl) {
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'blob shader');
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((w) => gl.texParameteri(gl.TEXTURE_2D, w, gl.CLAMP_TO_EDGE));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const u = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
  return { u };
}

function adopt(b) {
  const canvas = document.getElementById(${js(blobIds.canvas(''))} + b.id);
  const scope = document.getElementById(${js(blobIds.scope(''))} + b.id);
  if (!canvas || !scope) return null;
  const old = kept[b.id];
  if (old && old.canvas.width === canvas.width && old.canvas.height === canvas.height) {
    old.canvas.setAttribute('style', canvas.getAttribute('style') || '');
    canvas.replaceWith(old.canvas);
    return { ...old, scope, b, key: null };
  }
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const paper = document.createElement('canvas');
  paper.width = canvas.width;
  paper.height = canvas.height;
  const item = { canvas, gl, paper, paint: paper.getContext('2d'), ...compile(gl) };
  kept[b.id] = item;
  return { ...item, scope, b, key: null };
}

function rowAt(b, local) {
  const f = Math.min(Math.max(local * b.fps, 0), b.rows.length - 1);
  const i = Math.min(Math.floor(f), b.rows.length - 2 < 0 ? 0 : b.rows.length - 2);
  const t = b.rows.length > 1 ? f - i : 0;
  const lo = b.rows[i];
  const hi = b.rows[Math.min(i + 1, b.rows.length - 1)];
  return lo.map((v, k) => v + (hi[k] - v) * t);
}

function clear(it) {
  const gl = it.gl;
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}

function drawBlob(it, time) {
  const b = it.b;
  const gl = it.gl;
  const local = time - b.start;
  clear(it);
  if (local < 0 || local > b.length) return;
  const plan = PLAN(it.scope, document.getElementById('root'), b.width, it.paint);
  if (plan.key !== it.key || plan.sources.length) {
    PAINT(it.paint, plan);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, it.paper);
    it.key = plan.key;
  }
  const r = rowAt(b, local);
  const u = it.u;
  const at = (name, n) => r.slice(ROW[name], ROW[name] + n);
  gl.viewport(0, 0, b.width, b.height);
  gl.uniform1i(u.uContent, 0);
  gl.uniform2f(u.uSize, b.width, b.height);
  gl.uniform2fv(u.uCenter, at('center', 2));
  gl.uniform3fv(u.uDrop, at('drops', 12));
  gl.uniform3fv(u.uUnwarp, at('unwarp', 3));
  gl.uniform1f(u.uBlend, r[ROW.blend]);
  gl.uniform1f(u.uWobble, r[ROW.wobble]);
  gl.uniform1f(u.uWobbleSpeed, r[ROW.wobbleSpeed]);
  gl.uniform1f(u.uTime, local);
  gl.uniform1f(u.uSeed, b.seed);
  gl.uniform1f(u.uIor, r[ROW.ior]);
  gl.uniform1f(u.uDisp, r[ROW.dispersion]);
  gl.uniform1f(u.uFrost, r[ROW.frost]);
  gl.uniform1f(u.uRefl, r[ROW.reflection]);
  gl.uniform1f(u.uTintAmt, r[ROW.tintAmount]);
  gl.uniform1f(u.uPresence, r[ROW.presence]);
  gl.uniform3fv(u.uTint, at('tint', 3));
  const [x, y, w, h] = at('box', 4);
  const left = Math.max(Math.floor(x), 0);
  const top = Math.max(Math.floor(y), 0);
  const right = Math.min(Math.ceil(x + w), b.width);
  const bottom = Math.min(Math.ceil(y + h), b.height);
  if (right <= left || bottom <= top || r[ROW.presence] <= 0) return;
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(left, b.height - bottom, right - left, bottom - top);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
`;

export function blobScript(bakes: readonly BlobBake[], duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(BLOB_TIMELINE)}const VERTEX=${js(VERTEX)};const FRAGMENT=${js(FRAGMENT)};const ROW=${js(ROW)};const PLAN=(${paintPlan.toString()});const PAINT=(${paintOps.toString()});
${RUNTIME}
const B=${js(bakes)};
const items=B.map(adopt).filter(Boolean);
Object.keys(kept).filter((id)=>!B.some((b)=>b.id===id)).forEach((id)=>{delete kept[id];});
function blobsAt(time){items.forEach(function(it){drawBlob(it,time);});}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(BLOB_TIMELINE, duration, 'blobsAt')}
${hotSeek('blobsAt')}
${ON_DISPOSE}(function(){items.forEach(clear);});
if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){items.forEach(function(it){it.key=null;});blobsAt(tl?tl.time():0);});}
blobsAt(0);
})();</script>`;
}
