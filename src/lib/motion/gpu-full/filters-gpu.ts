import type { SvgNode } from '../effects/registry';
import { BlendMode } from '../blend';
import { FilterKind, type Filter, type Linear } from './filters';
import { cssMatrix, IDENTITY_MATRIX, type CssFunction } from './filters';
import { BLEND_FS, BLUR_FS, QUAD_VS, plain, program } from './gl-kit';
import { gaussianKernel, MAX_TAPS } from './kernel';
import { rgbaOf, type Rgba } from './rgba';
import { LATTICE, latticeOf, stitchedFrequency } from './turbulence';

const MAX_TABLE = 32;
const MAX_MORPH = 64;
const SOURCE_GRAPHIC = 'SourceGraphic';
const SOURCE_ALPHA = 'SourceAlpha';
const HALF = 0.5;
const SRGB = 'sRGB';
const INTERPOLATION = 'color-interpolation-filters';

enum Encoding {
  Linear = 1,
  Srgb = 0
}

const linearChannel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

const UNPREMULTIPLIED = `
vec4 straight(vec4 c) { return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0); }
vec4 premul(vec4 c) { c = clamp(c, 0.0, 1.0); return vec4(c.rgb * c.a, c.a); }`;

const MATRIX_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_m[20];
out vec4 outColor;
${UNPREMULTIPLIED}
void main() {
  vec4 c = straight(texture(u_src, v_uv));
  vec4 o;
  for (int r = 0; r < 4; r++) {
    o[r] = u_m[r * 5] * c.r + u_m[r * 5 + 1] * c.g + u_m[r * 5 + 2] * c.b + u_m[r * 5 + 3] * c.a + u_m[r * 5 + 4];
  }
  outColor = premul(o);
}`;

const GAMMA_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform int u_toLinear;
out vec4 outColor;
${UNPREMULTIPLIED}
vec3 linear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 encoded(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec4 c = straight(texture(u_src, v_uv));
  outColor = premul(vec4(u_toLinear == 1 ? linear(c.rgb) : encoded(c.rgb), c.a));
}`;

const TABLE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform int u_kind[4];
uniform int u_count[4];
uniform float u_table[${MAX_TABLE * 4}];
uniform float u_slope[4];
uniform float u_intercept[4];
out vec4 outColor;
${UNPREMULTIPLIED}
float lookup(int ch, float c) {
  if (u_kind[ch] == 2) { return u_slope[ch] * c + u_intercept[ch]; }
  if (u_kind[ch] != 1) { return c; }
  int n = u_count[ch] - 1;
  if (n <= 0) { return u_table[ch * ${MAX_TABLE}]; }
  int k = min(n - 1, int(floor(c * float(n))));
  float a = u_table[ch * ${MAX_TABLE} + k];
  float b = u_table[ch * ${MAX_TABLE} + k + 1];
  return a + (c * float(n) - float(k)) * (b - a);
}
void main() {
  vec4 c = straight(texture(u_src, v_uv));
  outColor = premul(vec4(lookup(0, c.r), lookup(1, c.g), lookup(2, c.b), lookup(3, c.a)));
}`;

const OFFSET_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_off;
uniform int u_alpha;
out vec4 outColor;
void main() {
  vec2 uv = v_uv - u_off;
  vec4 c = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(u_src, uv);
  outColor = u_alpha == 1 ? vec4(0.0, 0.0, 0.0, c.a) : c;
}`;

const FLOOD_FS = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor = vec4(u_color.rgb * u_color.a, u_color.a); }`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform int u_op;
uniform vec4 u_k;
out vec4 outColor;
void main() {
  vec4 a = texture(u_a, v_uv);
  vec4 b = texture(u_b, v_uv);
  vec4 o;
  if (u_op == 0) { o = a + b * (1.0 - a.a); }
  else if (u_op == 1) { o = a * b.a; }
  else if (u_op == 2) { o = a * (1.0 - b.a); }
  else if (u_op == 3) { o = a * b.a + b * (1.0 - a.a); }
  else if (u_op == 4) { o = a * (1.0 - b.a) + b * (1.0 - a.a); }
  else { o = u_k.x * a * b + u_k.y * a + u_k.z * b + u_k.w; o = clamp(o, 0.0, 1.0); o.rgb = min(o.rgb, vec3(o.a)); }
  outColor = o;
}`;

const MORPH_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform int u_taps;
uniform int u_dilate;
out vec4 outColor;
void main() {
  vec4 o = texture(u_src, v_uv);
  for (int i = 1; i <= ${MAX_MORPH}; i++) {
    if (i > u_taps) { break; }
    vec4 p = texture(u_src, v_uv + u_dir * float(i));
    vec4 q = texture(u_src, v_uv - u_dir * float(i));
    o = u_dilate == 1 ? max(o, max(p, q)) : min(o, min(p, q));
  }
  outColor = o;
}`;

const LIGHT_FS = `#version 300 es
precision highp float;
uniform vec3 u_light;
uniform vec3 u_color;
uniform float u_kd;
uniform float u_height;
out vec4 outColor;
void main() {
  vec3 p = vec3(gl_FragCoord.x, u_height - gl_FragCoord.y, 0.0);
  vec3 l = normalize(u_light - p);
  outColor = vec4(clamp(u_kd * l.z * u_color, 0.0, 1.0), 1.0);
}`;

const TURBULENCE_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_lattice;
uniform vec2 u_freq;
uniform int u_octaves;
uniform int u_fractal;
uniform int u_stitch;
uniform vec4 u_region;
uniform vec2 u_stitchSize;
uniform vec2 u_wrap;
uniform float u_height;
uniform float u_center;
out vec4 outColor;
const float PERLIN = 4096.0;
vec4 cell(int i, int k) { return texelFetch(u_lattice, ivec2(i, k), 0); }
float noise2(int ch, vec2 v, bool stitching, vec2 size, vec2 wrap) {
  float t = v.x + PERLIN;
  int bx0 = int(t);
  int bx1 = bx0 + 1;
  float rx0 = t - floor(t);
  float rx1 = rx0 - 1.0;
  t = v.y + PERLIN;
  int by0 = int(t);
  int by1 = by0 + 1;
  float ry0 = t - floor(t);
  float ry1 = ry0 - 1.0;
  if (stitching) {
    if (float(bx0) >= wrap.x) { bx0 -= int(size.x); }
    if (float(bx1) >= wrap.x) { bx1 -= int(size.x); }
    if (float(by0) >= wrap.y) { by0 -= int(size.y); }
    if (float(by1) >= wrap.y) { by1 -= int(size.y); }
  }
  bx0 &= 255; bx1 &= 255; by0 &= 255; by1 &= 255;
  int i = int(cell(bx0, 0).z);
  int j = int(cell(bx1, 0).z);
  int b00 = int(cell(i + by0, 0).z);
  int b10 = int(cell(j + by0, 0).z);
  int b01 = int(cell(i + by1, 0).z);
  int b11 = int(cell(j + by1, 0).z);
  float sx = rx0 * rx0 * (3.0 - 2.0 * rx0);
  float sy = ry0 * ry0 * (3.0 - 2.0 * ry0);
  vec2 q = cell(b00, ch).xy; float u = rx0 * q.x + ry0 * q.y;
  q = cell(b10, ch).xy; float w = rx1 * q.x + ry0 * q.y;
  float a = mix(u, w, sx);
  q = cell(b01, ch).xy; u = rx0 * q.x + ry1 * q.y;
  q = cell(b11, ch).xy; w = rx1 * q.x + ry1 * q.y;
  float b = mix(u, w, sx);
  return mix(a, b, sy);
}
float turbulence(int ch, vec2 p) {
  vec2 v = p * u_freq;
  vec2 size = u_stitchSize;
  vec2 wrap = u_wrap;
  float sum = 0.0;
  float ratio = 1.0;
  for (int o = 0; o < 10; o++) {
    if (o >= u_octaves) { break; }
    float n = noise2(ch, v, u_stitch == 1, size, wrap);
    sum += (u_fractal == 1 ? n : abs(n)) / ratio;
    v *= 2.0;
    ratio *= 2.0;
    size *= 2.0;
    wrap = 2.0 * wrap - PERLIN;
  }
  return sum;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, u_height - gl_FragCoord.y) - vec2(0.5) + vec2(u_center);
  if (p.x < u_region.x || p.y < u_region.y || p.x >= u_region.x + u_region.z || p.y >= u_region.y + u_region.w) { outColor = vec4(0.0); return; }
  vec4 c;
  for (int ch = 0; ch < 4; ch++) {
    float t = turbulence(ch, p);
    c[ch] = clamp(u_fractal == 1 ? (t + 1.0) * 0.5 : t, 0.0, 1.0);
  }
  outColor = vec4(c.rgb * c.a, c.a);
}`;

const TILE_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec4 u_region;
uniform vec2 u_frame;
out vec4 outColor;
void main() {
  vec2 p = vec2(gl_FragCoord.x, u_frame.y - gl_FragCoord.y);
  vec2 q = u_region.xy + mod(p - u_region.xy, u_region.zw);
  outColor = texture(u_src, vec2(q.x / u_frame.x, 1.0 - q.y / u_frame.y));
}`;

const DISPLACE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_b;
uniform float u_scale;
uniform ivec2 u_channels;
uniform vec2 u_frame;
out vec4 outColor;
void main() {
  vec4 m = texture(u_b, v_uv);
  vec4 straight = m.a > 0.0 ? vec4(m.rgb / m.a, m.a) : vec4(0.0);
  vec2 d = u_scale * (vec2(straight[u_channels.x], straight[u_channels.y]) - 0.5);
  vec2 uv = v_uv + vec2(d.x / u_frame.x, -d.y / u_frame.y);
  outColor = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(u_src, uv);
}`;

const CHANNEL_INDEX: Record<string, number> = { R: 0, G: 1, B: 2, A: 3 };
const TURBULENCE_CENTER = 1;

const COMPOSITE_OPS: Record<string, number> = { over: 0, in: 1, out: 2, atop: 3, xor: 4, arithmetic: 5 };

const BLEND_OF: Record<string, BlendMode> = Object.fromEntries(Object.values(BlendMode).map((m) => [m, m]));
const BLEND_INDEX: Record<string, number> = Object.fromEntries(Object.values(BlendMode).map((m, i) => [m, i]));

type Target = { fbo: WebGLFramebuffer; texture: WebGLTexture };

export type FilterRunner = { apply: (src: WebGLTexture, filters: Filter[], space: Linear) => WebGLTexture };

const num = (v: unknown, fallback = 0) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};
const pair = (v: unknown): [number, number] => {
  const parts = String(v ?? '0').trim().split(/[\s,]+/).map((x) => num(x));
  return [parts[0] ?? 0, parts[1] ?? parts[0] ?? 0];
};

export function createFilters(gl: WebGL2RenderingContext, width: number, height: number, quad: WebGLBuffer): FilterRunner {
  const programs = {
    matrix: program(gl, QUAD_VS, MATRIX_FS),
    gamma: program(gl, QUAD_VS, GAMMA_FS),
    table: program(gl, QUAD_VS, TABLE_FS),
    offset: program(gl, QUAD_VS, OFFSET_FS),
    flood: program(gl, QUAD_VS, FLOOD_FS),
    composite: program(gl, QUAD_VS, COMPOSITE_FS),
    morph: program(gl, QUAD_VS, MORPH_FS),
    light: program(gl, QUAD_VS, LIGHT_FS),
    turbulence: program(gl, QUAD_VS, TURBULENCE_FS),
    tile: program(gl, QUAD_VS, TILE_FS),
    displace: program(gl, QUAD_VS, DISPLACE_FS),
    blur: program(gl, QUAD_VS, BLUR_FS),
    blend: program(gl, QUAD_VS, BLEND_FS)
  };
  const pool: Target[] = [];
  const regions = new Map<WebGLTexture, [number, number, number, number]>();
  const lattices = new Map<number, WebGLTexture>();
  gl.getExtension('EXT_color_buffer_float');
  let used = 0;
  const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);

  const fresh = (): Target => {
    if (used >= pool.length) {
      pool.push(plain(gl, width, height));
    }
    return pool[used++];
  };

  function run(prog: WebGLProgram, inputs: WebGLTexture[], set: () => void): WebGLTexture {
    const out = fresh();
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.useProgram(prog);
    const names = ['u_src', 'u_b'];
    inputs.forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(u(prog, i === 0 && prog === programs.composite ? 'u_a' : names[i]), i);
    });
    gl.activeTexture(gl.TEXTURE0);
    set();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return out.texture;
  }

  const scale = (space: Linear) => Math.sqrt(Math.abs(space[0] * space[3] - space[1] * space[2]));
  const vector = (space: Linear, dx: number, dy: number): [number, number] => [space[0] * dx + space[2] * dy, space[1] * dx + space[3] * dy];

  const encode = (src: WebGLTexture, to: Encoding) => run(programs.gamma, [src], () => gl.uniform1i(u(programs.gamma, 'u_toLinear'), to));

  const matrix = (src: WebGLTexture, m: number[]) => run(programs.matrix, [src], () => gl.uniform1fv(u(programs.matrix, 'u_m'), m));

  function blur(src: WebGLTexture, sx: number, sy: number): WebGLTexture {
    const along = (tex: WebGLTexture, sigma: number, dir: [number, number]) => {
      if (sigma <= 0) {
        return tex;
      }
      const { weights, step } = gaussianKernel(sigma);
      return run(programs.blur, [tex], () => {
        gl.uniform2f(u(programs.blur, 'u_dir'), (dir[0] * step) / width, (dir[1] * step) / height);
        gl.uniform1i(u(programs.blur, 'u_taps'), weights.length);
        gl.uniform1fv(u(programs.blur, 'u_w'), Float32Array.from({ length: MAX_TAPS }, (_, i) => weights[i] ?? 0));
      });
    };
    return along(along(src, sx, [1, 0]), sy, [0, 1]);
  }

  const offset = (src: WebGLTexture, [dx, dy]: [number, number], alpha = false) =>
    run(programs.offset, [src], () => {
      gl.uniform2f(u(programs.offset, 'u_off'), dx / width, -dy / height);
      gl.uniform1i(u(programs.offset, 'u_alpha'), alpha ? 1 : 0);
    });

  const flood = (color: Rgba) => run(programs.flood, [], () => gl.uniform4fv(u(programs.flood, 'u_color'), color));

  const composite = (a: WebGLTexture, b: WebGLTexture, op: string, k: [number, number, number, number] = [0, 0, 0, 0]) =>
    run(programs.composite, [a, b], () => {
      gl.uniform1i(u(programs.composite, 'u_op'), COMPOSITE_OPS[op] ?? 0);
      gl.uniform4fv(u(programs.composite, 'u_k'), k);
    });

  const alphaOf = (src: WebGLTexture) => offset(src, [0, 0], true);

  function shadow(src: WebGLTexture, d: [number, number], sigma: number, color: Rgba): WebGLTexture {
    const ink = composite(flood(color), offset(blur(alphaOf(src), sigma, sigma), d), 'in');
    return composite(src, ink, 'over');
  }

  function morph(src: WebGLTexture, [rx, ry]: [number, number], dilate: boolean): WebGLTexture {
    const along = (tex: WebGLTexture, r: number, dir: [number, number]) =>
      r <= 0
        ? tex
        : run(programs.morph, [tex], () => {
            const step = Math.max(1, Math.ceil(r / MAX_MORPH));
            gl.uniform2f(u(programs.morph, 'u_dir'), (dir[0] * step) / width, (dir[1] * step) / height);
            gl.uniform1i(u(programs.morph, 'u_taps'), Math.round(r / step));
            gl.uniform1i(u(programs.morph, 'u_dilate'), dilate ? 1 : 0);
          });
    return along(along(src, rx, [1, 0]), ry, [0, 1]);
  }

  function table(src: WebGLTexture, funcs: SvgNode[]): WebGLTexture {
    const CHANNELS = ['feFuncR', 'feFuncG', 'feFuncB', 'feFuncA'];
    const of = CHANNELS.map((tag) => funcs.find((f) => f.tag === tag));
    const values = of.map((f) => (f?.attrs.type === 'table' ? String(f.attrs.tableValues).trim().split(/[\s,]+/).map(Number).slice(0, MAX_TABLE) : []));
    return run(programs.table, [src], () => {
      gl.uniform1iv(u(programs.table, 'u_kind'), of.map((f) => (f?.attrs.type === 'table' ? 1 : f?.attrs.type === 'linear' ? 2 : 0)));
      gl.uniform1iv(u(programs.table, 'u_count'), values.map((v) => v.length));
      gl.uniform1fv(u(programs.table, 'u_table'), Float32Array.from({ length: MAX_TABLE * 4 }, (_, i) => values[Math.floor(i / MAX_TABLE)][i % MAX_TABLE] ?? 0));
      gl.uniform1fv(u(programs.table, 'u_slope'), of.map((f) => num(f?.attrs.slope, 1)));
      gl.uniform1fv(u(programs.table, 'u_intercept'), of.map((f) => num(f?.attrs.intercept, 0)));
    });
  }

  function colourMatrix(src: WebGLTexture, attrs: SvgNode['attrs']): WebGLTexture {
    const KINDS: Record<string, () => number[] | null> = {
      matrix: () => String(attrs.values).trim().split(/[\s,]+/).map(Number),
      saturate: () => cssMatrix('saturate', num(attrs.values, 1)),
      hueRotate: () => cssMatrix('hue-rotate', num(attrs.values, 0)),
      luminanceToAlpha: () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2125, 0.7154, 0.0721, 0, 0]
    };
    return matrix(src, KINDS[String(attrs.type ?? 'matrix')]?.() ?? IDENTITY_MATRIX);
  }

  function lighting(node: SvgNode, space: Linear): WebGLTexture {
    const light = (node.children ?? []).find((c) => c.tag === 'fePointLight');
    const color = rgbaOf(String(node.attrs['lighting-color'] ?? '#ffffff')) ?? [1, 1, 1, 1];
    const s = scale(space);
    return run(programs.light, [], () => {
      gl.uniform3f(u(programs.light, 'u_light'), num(light?.attrs.x) * s, num(light?.attrs.y) * s, num(light?.attrs.z) * s);
      gl.uniform3f(u(programs.light, 'u_color'), color[0], color[1], color[2]);
      gl.uniform1f(u(programs.light, 'u_kd'), num(node.attrs.diffuseConstant, 1));
      gl.uniform1f(u(programs.light, 'u_height'), height);
    });
  }

  function blend(a: WebGLTexture, b: WebGLTexture, mode: string): WebGLTexture {
    return run(programs.blend, [a], () => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, b);
      gl.uniform1i(u(programs.blend, 'u_dst'), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(u(programs.blend, 'u_opacity'), 1);
      gl.uniform1i(u(programs.blend, 'u_mode'), BLEND_INDEX[BLEND_OF[mode] ?? BlendMode.Normal]);
      gl.uniform1i(u(programs.blend, 'u_masked'), 0);
    });
  }

  function latticeTexture(seed: number): WebGLTexture {
    const known = lattices.get(seed);
    if (known) {
      return known;
    }
    const { selector, gradients } = latticeOf(seed);
    const data = new Float32Array(LATTICE * 4 * 4);
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < LATTICE; i++) {
        data.set([gradients[(k * LATTICE + i) * 2], gradients[(k * LATTICE + i) * 2 + 1], selector[i], 0], (k * LATTICE + i) * 4);
      }
    }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, LATTICE, 4, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    lattices.set(seed, tex);
    return tex;
  }

  function turbulence(n: SvgNode): WebGLTexture {
    const region: [number, number, number, number] = [num(n.attrs.x, 0), num(n.attrs.y, 0), num(n.attrs.width, width), num(n.attrs.height, height)];
    const stitch = n.attrs.stitchTiles === 'stitch';
    const [bx, by] = pair(n.attrs.baseFrequency);
    const fx = stitch ? stitchedFrequency(bx, region[2]) : bx;
    const fy = stitch ? stitchedFrequency(by, region[3]) : by;
    const sw = Math.trunc(region[2] * fx + HALF);
    const sh = Math.trunc(region[3] * fy + HALF);
    const PERLIN = 4096;
    const lattice = latticeTexture(num(n.attrs.seed, 0));
    const out = run(programs.turbulence, [], () => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, lattice);
      gl.uniform1i(u(programs.turbulence, 'u_lattice'), 0);
      gl.uniform2f(u(programs.turbulence, 'u_freq'), fx, fy);
      gl.uniform1i(u(programs.turbulence, 'u_octaves'), num(n.attrs.numOctaves, 1));
      gl.uniform1i(u(programs.turbulence, 'u_fractal'), n.attrs.type === 'fractalNoise' ? 1 : 0);
      gl.uniform1i(u(programs.turbulence, 'u_stitch'), stitch ? 1 : 0);
      gl.uniform4fv(u(programs.turbulence, 'u_region'), region);
      gl.uniform2f(u(programs.turbulence, 'u_stitchSize'), sw, sh);
      gl.uniform2f(u(programs.turbulence, 'u_wrap'), region[0] * fx + PERLIN + sw, region[1] * fy + PERLIN + sh);
      gl.uniform1f(u(programs.turbulence, 'u_height'), height);
      gl.uniform1f(u(programs.turbulence, 'u_center'), TURBULENCE_CENTER);
    });
    regions.set(out, region);
    return out;
  }

  function tile(src: WebGLTexture): WebGLTexture {
    const region = regions.get(src) ?? [0, 0, width, height];
    return run(programs.tile, [src], () => {
      gl.uniform4fv(u(programs.tile, 'u_region'), region);
      gl.uniform2f(u(programs.tile, 'u_frame'), width, height);
    });
  }

  function displace(src: WebGLTexture, map: WebGLTexture, n: SvgNode, s: number): WebGLTexture {
    return run(programs.displace, [src, map], () => {
      gl.uniform1f(u(programs.displace, 'u_scale'), num(n.attrs.scale) * s);
      gl.uniform2i(u(programs.displace, 'u_channels'), CHANNEL_INDEX[String(n.attrs.xChannelSelector ?? 'A')] ?? 3, CHANNEL_INDEX[String(n.attrs.yChannelSelector ?? 'A')] ?? 3);
      gl.uniform2f(u(programs.displace, 'u_frame'), width, height);
    });
  }

  function svgGraph(srgbSource: WebGLTexture, filter: SvgNode, space: Linear): WebGLTexture {
    const linear = filter.attrs[INTERPOLATION] !== SRGB;
    const source = linear ? encode(srgbSource, Encoding.Linear) : srgbSource;
    const results = new Map<string, WebGLTexture>();
    let last = source;
    const s = scale(space);
    const input = (name: unknown) => (name === SOURCE_GRAPHIC ? source : name === SOURCE_ALPHA ? alphaOf(source) : name === undefined ? last : (results.get(String(name)) ?? last));
    const colourOf = (node: SvgNode) => {
      const c = rgbaOf(String(node.attrs['flood-color'] ?? '#000000')) ?? [0, 0, 0, 1];
      const [r, g, b] = linear ? [c[0], c[1], c[2]].map(linearChannel) : c;
      return [r, g, b, c[3] * num(node.attrs['flood-opacity'], 1)] as Rgba;
    };
    const PRIMITIVE: Record<string, (node: SvgNode) => WebGLTexture> = {
      feColorMatrix: (n) => colourMatrix(input(n.attrs.in), n.attrs),
      feComponentTransfer: (n) => table(input(n.attrs.in), n.children ?? []),
      feGaussianBlur: (n) => {
        const [sx, sy] = pair(n.attrs.stdDeviation);
        return blur(input(n.attrs.in), sx * s, sy * s);
      },
      feOffset: (n) => offset(input(n.attrs.in), vector(space, num(n.attrs.dx), num(n.attrs.dy))),
      feFlood: (n) => flood(colourOf(n)),
      feComposite: (n) => composite(input(n.attrs.in), input(n.attrs.in2), String(n.attrs.operator ?? 'over'), [num(n.attrs.k1), num(n.attrs.k2), num(n.attrs.k3), num(n.attrs.k4)]),
      feMerge: (n) => (n.children ?? []).map((c) => input(c.attrs.in)).reduce((under, over) => composite(over, under, 'over')),
      feMorphology: (n) => {
        const [rx, ry] = pair(n.attrs.radius);
        return morph(input(n.attrs.in), [rx * s, ry * s], n.attrs.operator === 'dilate');
      },
      feDropShadow: (n) => shadow(input(n.attrs.in), vector(space, num(n.attrs.dx), num(n.attrs.dy)), num(n.attrs.stdDeviation) * s, colourOf(n)),
      feBlend: (n) => blend(input(n.attrs.in), input(n.attrs.in2), String(n.attrs.mode ?? 'normal')),
      feDiffuseLighting: (n) => lighting(n, space),
      feTurbulence: (n) => turbulence(n),
      feTile: (n) => tile(input(n.attrs.in)),
      feDisplacementMap: (n) => displace(input(n.attrs.in), input(n.attrs.in2), n, s)
    };
    for (const node of filter.children ?? []) {
      const run = PRIMITIVE[node.tag];
      if (!run) {
        continue;
      }
      last = run(node);
      if (node.attrs.result !== undefined) {
        results.set(String(node.attrs.result), last);
      }
    }
    return linear ? encode(last, Encoding.Srgb) : last;
  }

  function cssGraph(source: WebGLTexture, fns: CssFunction[], space: Linear): WebGLTexture {
    const s = scale(space);
    const px = (v: string | undefined) => num(v);
    return fns.reduce((src, fn) => {
      const m = cssMatrix(fn.name, num(fn.args[0], 1));
      if (m) {
        return matrix(src, m);
      }
      if (fn.name === 'blur') {
        return blur(src, px(fn.args[0]) * s, px(fn.args[0]) * s);
      }
      if (fn.name === 'drop-shadow') {
        const color = rgbaOf(fn.args.slice(3).join(' ') || '#000000') ?? [0, 0, 0, 1];
        return shadow(src, vector(space, px(fn.args[0]), px(fn.args[1])), px(fn.args[2]) * HALF * s, color);
      }
      return src;
    }, source);
  }

  function apply(src: WebGLTexture, filters: Filter[], space: Linear): WebGLTexture {
    used = 0;
    regions.clear();
    gl.disable(gl.BLEND);
    const out = filters.reduce((tex, f) => (f.kind === FilterKind.Css ? cssGraph(tex, f.fns, space) : f.nodes.reduce((t, node) => svgGraph(t, node, space), tex)), src);
    gl.enable(gl.BLEND);
    return out;
  }

  return { apply };
}
