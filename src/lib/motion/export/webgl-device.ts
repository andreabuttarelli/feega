import { composite, type Device, type Rect } from './compositor';
import { EffectKind, MaskComposite, PaintKind, type Affine, type Effect, type GlassEffect, type LayerTree, type Paint, type Rgba } from '../hyperframes/layer-tree';
import { GRAIN_SAMPLE_OFFSET, turbulenceTile } from '../effects/turbulence';
import { GRAIN_TILE } from '../effects/registry';
import { Layering } from '../hyperframes/capture';

const MAX_GRAINS = 4;
const SCRATCH_UNIT = MAX_GRAINS + 2;
const BLUR_REACH = 3;

const QUAD_VS = `#version 300 es
in vec2 corner;
uniform vec2 box;
uniform vec2 frame;
uniform mat3 at;
uniform float pad;
out vec2 uv;
void main() {
  uv = corner;
  vec2 p = (at * vec3(corner * box, 1.0)).xy + pad;
  gl_Position = vec4(p.x / frame.x * 2.0 - 1.0, 1.0 - p.y / frame.y * 2.0, 0.0, 1.0);
}`;

const FULL_VS = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const PAINT_FS = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D sheet;
uniform vec4 color;
uniform int solid;
out vec4 outColor;
void main() {
  outColor = solid == 1 ? color : texture(sheet, uv);
}`;

const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform float opacity;
uniform int shift;
out vec4 outColor;
void main() {
  outColor = texelFetch(src, ivec2(gl_FragCoord.xy) + shift, 0) * opacity;
}`;

const DISPLACE_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D map;
uniform float scale;
uniform ivec4 bounds;
out vec4 outColor;
vec4 tap(ivec2 q) {
  return q.x >= bounds.x && q.y >= bounds.y && q.x < bounds.z && q.y < bounds.w ? texelFetch(src, q, 0) : vec4(0.0);
}
void main() {
  vec4 m = texelFetch(map, ivec2(gl_FragCoord.xy), 0);
  vec2 c = m.a > 0.0 ? m.rg / m.a : vec2(0.0);
  vec2 at = gl_FragCoord.xy + vec2(scale * (c.r - 0.5), -scale * (c.g - 0.5)) - 0.5;
  vec2 o = floor(at);
  vec2 f = at - o;
  ivec2 p = ivec2(o);
  outColor = mix(mix(tap(p), tap(p + ivec2(1, 0)), f.x), mix(tap(p + ivec2(0, 1)), tap(p + ivec2(1, 1)), f.x), f.y);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform ivec2 step;
uniform float sigma;
uniform int radius;
uniform ivec4 bounds;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 sum = vec4(0.0);
  float weights = 0.0;
  for (int i = -radius; i <= radius; i++) {
    ivec2 q = p + step * i;
    float w = exp(-0.5 * float(i * i) / (sigma * sigma));
    weights += w;
    if (q.x >= bounds.x && q.y >= bounds.y && q.x < bounds.z && q.y < bounds.w) {
      sum += texelFetch(src, q, 0) * w;
    }
  }
  outColor = sum / weights;
}`;

const MASK_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D by;
out vec4 outColor;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  outColor = texelFetch(src, at, 0) * texelFetch(by, at, 0).a;
}`;

const COMBINE_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D dst;
uniform int op;
out vec4 outColor;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  float s = texelFetch(src, at, 0).a;
  float d = texelFetch(dst, at, 0).a;
  float a = op == 1 ? s * (1.0 - d) : op == 2 ? s * d : op == 3 ? s * (1.0 - d) + d * (1.0 - s) : s + d * (1.0 - s);
  outColor = vec4(a);
}`;

const BLEND_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D dst;
uniform float opacity;
uniform int mode;
out vec4 outColor;

float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / (l - n); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / (x - l); }
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float lo = min(min(c.r, c.g), c.b);
  float hi = max(max(c.r, c.g), c.b);
  return hi > lo ? (c - lo) * s / (hi - lo) : vec3(0.0);
}
float dodge(float b, float s) { return b == 0.0 ? 0.0 : s == 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float burn(float b, float s) { return b == 1.0 ? 1.0 : s == 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
float hard(float b, float s) { return s <= 0.5 ? b * 2.0 * s : 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)); }
float soft(float b, float s) {
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
vec3 mixed(vec3 b, vec3 s) {
  if (mode == 1) { return b * s; }
  if (mode == 2) { return b + s - b * s; }
  if (mode == 3) { return vec3(hard(s.r, b.r), hard(s.g, b.g), hard(s.b, b.b)); }
  if (mode == 4) { return min(b, s); }
  if (mode == 5) { return max(b, s); }
  if (mode == 6) { return vec3(dodge(b.r, s.r), dodge(b.g, s.g), dodge(b.b, s.b)); }
  if (mode == 7) { return vec3(burn(b.r, s.r), burn(b.g, s.g), burn(b.b, s.b)); }
  if (mode == 8) { return vec3(hard(b.r, s.r), hard(b.g, s.g), hard(b.b, s.b)); }
  if (mode == 9) { return vec3(soft(b.r, s.r), soft(b.g, s.g), soft(b.b, s.b)); }
  if (mode == 10) { return abs(b - s); }
  if (mode == 11) { return b + s - 2.0 * b * s; }
  if (mode == 12) { return setLum(setSat(s, sat(b)), lum(b)); }
  if (mode == 13) { return setLum(setSat(b, sat(s)), lum(b)); }
  if (mode == 14) { return setLum(s, lum(b)); }
  if (mode == 15) { return setLum(b, lum(s)); }
  return s;
}
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(src, at, 0) * opacity;
  vec4 d = texelFetch(dst, at, 0);
  vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
  vec3 cb = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
  vec3 c = s.rgb * (1.0 - d.a) + d.rgb * (1.0 - s.a) + s.a * d.a * clamp(mixed(cb, cs), 0.0, 1.0);
  outColor = vec4(c, s.a + d.a * (1.0 - s.a));
}`;

const GRAIN_FS = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform highp sampler2D tiles[${MAX_GRAINS}];
uniform float amounts[${MAX_GRAINS}];
uniform int count;
uniform int tileSize;
uniform float frameHeight;
uniform float pad;
uniform mat3 inverse;
uniform vec4 bounds;
out vec4 outColor;

vec4 tap(int i, ivec2 p) {
  ivec2 w = ((p % tileSize) + tileSize) % tileSize;
  if (i == 0) { return texelFetch(tiles[0], w, 0); }
  if (i == 1) { return texelFetch(tiles[1], w, 0); }
  if (i == 2) { return texelFetch(tiles[2], w, 0); }
  return texelFetch(tiles[3], w, 0);
}
vec4 noiseAt(int i, vec2 uv) {
  vec2 x = uv - 0.5;
  vec2 o = floor(x);
  vec2 f = x - o;
  ivec2 p = ivec2(o);
  vec4 top = mix(tap(i, p), tap(i, p + ivec2(1, 0)), f.x);
  vec4 bottom = mix(tap(i, p + ivec2(0, 1)), tap(i, p + ivec2(1, 1)), f.x);
  return mix(top, bottom, f.y);
}
void main() {
  vec4 s = texelFetch(src, ivec2(gl_FragCoord.xy), 0);
  vec2 px = vec2(gl_FragCoord.x, frameHeight - gl_FragCoord.y) - pad;
  vec2 uv = (inverse * vec3(px, 1.0)).xy;
  if (s.a == 0.0 || uv.x < bounds.x || uv.y < bounds.y || uv.x >= bounds.z || uv.y >= bounds.w) {
    outColor = vec4(0.0);
    return;
  }
  vec4 pixel = s;
  for (int i = 0; i < ${MAX_GRAINS}; i++) {
    if (i >= count) { break; }
    vec4 n = noiseAt(i, uv);
    float gray = dot(n.rgb, vec3(0.213, 0.715, 0.072)) * n.a;
    float shade = amounts[i];
    float keep = pixel.a;
    float alpha = clamp(shade * n.a + keep - shade / 2.0, 0.0, 1.0);
    pixel.rgb = min(vec3(alpha), max(vec3(0.0), shade * gray + pixel.rgb - shade / 2.0)) * keep;
    pixel.a = alpha * keep;
  }
  outColor = pixel;
}`;

const COMBINE_OPS: Record<MaskComposite, number> = { [MaskComposite.Add]: 0, [MaskComposite.Subtract]: 1, [MaskComposite.Intersect]: 2, [MaskComposite.Exclude]: 3 };

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

type Surface = { texture: WebGLTexture; buffer: WebGLFramebuffer };
type Program = { program: WebGLProgram; uniform: (name: string) => WebGLUniformLocation | null };

export type Gpu = { device: (sheets: ImageBitmap[], width: number, height: number) => Device<Surface, ImageBitmap> };

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type) as WebGLShader;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`compositor shader: ${gl.getShaderInfoLog(s)}`);
    }
    return s;
  };
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(program, 0, 'corner');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`compositor program: ${gl.getProgramInfoLog(program)}`);
  }
  const known = new Map<string, WebGLUniformLocation | null>();
  const uniform = (name: string) => {
    if (!known.has(name)) {
      known.set(name, gl.getUniformLocation(program, name));
    }
    return known.get(name) ?? null;
  };
  return { program, uniform };
}

const mat3 = (m: Affine) => new Float32Array([m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);

export function webglGpu(canvas: OffscreenCanvas): Gpu {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null;
  if (!gl) {
    throw new Error('WebGL2 is not available for the export compositor');
  }
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const paint = compile(gl, QUAD_VS, PAINT_FS);
  const copy = compile(gl, FULL_VS, COPY_FS);
  const blend = compile(gl, FULL_VS, BLEND_FS);
  const grain = compile(gl, FULL_VS, GRAIN_FS);
  const masking = compile(gl, FULL_VS, MASK_FS);
  const combining = compile(gl, FULL_VS, COMBINE_FS);
  const blurring = compile(gl, FULL_VS, BLUR_FS);
  const displacing = compile(gl, FULL_VS, DISPLACE_FS);

  const texture = (width: number, height: number, data: ArrayBufferView | null = null, filter: number = gl.LINEAR) => {
    const t = gl.createTexture() as WebGLTexture;
    gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  let size = { width: 0, height: 0 };
  let pad = 0;
  let free: Surface[] = [];
  const resize = (width: number, height: number, margin: number) => {
    canvas.width = width;
    canvas.height = height;
    pad = margin;
    if (size.width === width + 2 * margin && size.height === height + 2 * margin) {
      return;
    }
    free.forEach((s) => {
      gl.deleteTexture(s.texture);
      gl.deleteFramebuffer(s.buffer);
    });
    free = [];
    size = { width: width + 2 * margin, height: height + 2 * margin };
  };
  const surface = (): Surface => {
    const s = free.pop() ?? (() => {
      const t = texture(size.width, size.height, null, gl.NEAREST);
      const buffer = gl.createFramebuffer() as WebGLFramebuffer;
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { texture: t, buffer };
    })();
    gl.bindFramebuffer(gl.FRAMEBUFFER, s.buffer);
    gl.viewport(0, 0, size.width, size.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return s;
  };
  const release = (s: Surface) => void free.push(s);
  const target = (s: Surface | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, s?.buffer ?? null);
    gl.viewport(0, 0, s ? size.width : canvas.width, s ? size.height : canvas.height);
  };
  const bind = (unit: number, t: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
  };
  const full = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const blank = texture(1, 1, new Uint8Array(4));
  const tiles = new Map<string, WebGLTexture>();
  const tileOf = (baseFrequency: number, seed: number) => {
    const key = `${baseFrequency}:${seed}`;
    const known = tiles.get(key) ?? texture(GRAIN_TILE, GRAIN_TILE, turbulenceTile({ baseFrequency, seed, octaves: 1, size: GRAIN_TILE, offset: GRAIN_SAMPLE_OFFSET }), gl.NEAREST);
    tiles.set(key, known);
    return known;
  };

  const device = (sheets: ImageBitmap[], width: number, height: number, margin: number): Device<Surface, ImageBitmap> => {
    resize(width, height, margin);
    const uploaded = sheets.map((bitmap) => {
      const t = texture(1, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      bitmap.close();
      return t;
    });

    const draw = (s: Surface, p: Paint) => {
      if (!p.width || !p.height) {
        return;
      }
      target(s);
      gl.useProgram(paint.program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(paint.uniform('box'), p.width, p.height);
      gl.uniform2f(paint.uniform('frame'), size.width, size.height);
      gl.uniform1f(paint.uniform('pad'), pad);
      gl.uniformMatrix3fv(paint.uniform('at'), false, mat3(p.at));
      if (p.kind === PaintKind.Fill) {
        const [r, g, b, a] = p.color;
        gl.uniform1i(paint.uniform('solid'), 1);
        bind(0, blank);
        gl.uniform1i(paint.uniform('sheet'), 0);
        gl.uniform4f(paint.uniform('color'), r * a, g * a, b * a, a);
      } else {
        gl.uniform1i(paint.uniform('solid'), 0);
        bind(0, uploaded[p.sheet]);
        gl.uniform1i(paint.uniform('sheet'), 0);
      }
      full();
      gl.disable(gl.BLEND);
    };

    let bounds = [0, 0, size.width, size.height];
    let current: Rect | null = null;
    const region = (r: Rect | null) => {
      current = r;
      if (!r) {
        bounds = [0, 0, size.width, size.height];
        gl.disable(gl.SCISSOR_TEST);
        return;
      }
      const x0 = Math.max(0, Math.floor(r[0] + pad));
      const x1 = Math.min(size.width, Math.ceil(r[2] + pad));
      const y0 = Math.max(0, Math.floor(size.height - r[3] - pad));
      const y1 = Math.min(size.height, Math.ceil(size.height - r[1] - pad));
      bounds = [x0, y0, Math.max(x0, x1), Math.max(y0, y1)];
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1]);
    };
    const inside = (r: Rect, work: () => void) => {
      const outer = current;
      const limit = outer ?? [-pad, -pad, size.width - pad, size.height - pad];
      region([Math.max(r[0], limit[0]), Math.max(r[1], limit[1]), Math.min(r[2], limit[2]), Math.min(r[3], limit[3])]);
      work();
      region(outer);
    };

    const fill = (s: Surface, [r, g, b, a]: Rgba) => {
      target(s);
      gl.clearColor(r * a, g * a, b * a, a);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    const grainOn = (s: Surface, e: Extract<Effect, { kind: EffectKind.Grain }>) => {
      const out = surface();
      gl.useProgram(grain.program);
      bind(0, s.texture);
      gl.uniform1i(grain.uniform('src'), 0);
      const units = e.grains.slice(0, MAX_GRAINS).map((g, i) => {
        bind(1 + i, tileOf(g.baseFrequency, g.seed));
        return 1 + i;
      });
      const padded = [...units, ...Array(MAX_GRAINS - units.length).fill(units[0] ?? 1)];
      gl.uniform1iv(grain.uniform('tiles'), padded);
      gl.uniform1fv(grain.uniform('amounts'), [...e.grains.map((g) => g.amount), ...Array(MAX_GRAINS).fill(0)].slice(0, MAX_GRAINS));
      gl.uniform1i(grain.uniform('count'), Math.min(e.grains.length, MAX_GRAINS));
      gl.uniform1i(grain.uniform('tileSize'), GRAIN_TILE);
      gl.uniform1f(grain.uniform('frameHeight'), size.height);
      gl.uniform1f(grain.uniform('pad'), pad);
      gl.uniformMatrix3fv(grain.uniform('inverse'), false, mat3(e.area.inverse as Affine));
      const { margin, width: w, height: h } = e.area;
      gl.uniform4f(grain.uniform('bounds'), -margin * w, -margin * h, (1 + margin) * w, (1 + margin) * h);
      full();
      release(s);
      return out;
    };

    const spread = (s: Surface, step: [number, number], sigma: number) => {
      const out = surface();
      gl.useProgram(blurring.program);
      bind(0, s.texture);
      gl.uniform1i(blurring.uniform('src'), 0);
      gl.uniform2i(blurring.uniform('step'), step[0], step[1]);
      gl.uniform1f(blurring.uniform('sigma'), sigma);
      gl.uniform1i(blurring.uniform('radius'), Math.ceil(BLUR_REACH * sigma));
      gl.uniform4i(blurring.uniform('bounds'), bounds[0], bounds[1], bounds[2], bounds[3]);
      full();
      return out;
    };
    const pass = (s: Surface, step: [number, number], sigma: number) => {
      if (sigma <= 0) {
        return s;
      }
      const out = spread(s, step, sigma);
      release(s);
      return out;
    };
    const blurOn = (s: Surface, e: Extract<Effect, { kind: EffectKind.Blur }>) => pass(pass(s, [1, 0], e.sigma), [0, 1], e.sigma);

    const displace = (src: Surface, map: Surface, scale: number, from: number[]) => {
      const out = surface();
      gl.useProgram(displacing.program);
      bind(0, src.texture);
      bind(1, map.texture);
      gl.uniform1i(displacing.uniform('src'), 0);
      gl.uniform1i(displacing.uniform('map'), 1);
      gl.uniform1f(displacing.uniform('scale'), scale);
      gl.uniform4i(displacing.uniform('bounds'), from[0], from[1], from[2], from[3]);
      full();
      return out;
    };
    const glassOn = (s: Surface, e: GlassEffect) => {
      const [x, y, w, h] = e.box;
      const content = [...bounds];
      inside([x, y, x + w, y + h], () => {
        const map = surface();
        draw(map, e.map);
        const smooth = pass(pass(copyOf(map), [1, 0], e.smooth[0]), [0, 1], e.smooth[1]);
        const bent = displace(s, smooth, e.scale, content);
        release(smooth);
        const lens = maskBy(pass(pass(bent, [1, 0], e.frost), [0, 1], e.frost), map);
        release(map);
        blendInto(s, lens, 1, 'normal');
        release(lens);
      });
      return s;
    };
    const copyOf = (s: Surface) => {
      const out = surface();
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, s.buffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, out.buffer);
      gl.blitFramebuffer(0, 0, size.width, size.height, 0, 0, size.width, size.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      return out;
    };

    const EFFECTS: Record<EffectKind, (s: Surface, e: Effect) => Surface> = {
      [EffectKind.Grain]: grainOn,
      [EffectKind.Blur]: blurOn,
      [EffectKind.Glass]: glassOn
    };

    const maskBy = (s: Surface, by: Surface) => {
      const out = surface();
      gl.useProgram(masking.program);
      bind(0, s.texture);
      bind(1, by.texture);
      gl.uniform1i(masking.uniform('src'), 0);
      gl.uniform1i(masking.uniform('by'), 1);
      full();
      release(s);
      return out;
    };

    const combine = (src: Surface, dst: Surface, op: MaskComposite) => {
      const out = surface();
      gl.useProgram(combining.program);
      bind(0, src.texture);
      bind(1, dst.texture);
      gl.uniform1i(combining.uniform('src'), 0);
      gl.uniform1i(combining.uniform('dst'), 1);
      gl.uniform1i(combining.uniform('op'), COMBINE_OPS[op]);
      full();
      release(dst);
      return out;
    };

    const blendInto = (into: Surface, from: Surface, opacity: number, mode: string) => {
      const index = Math.max(0, BLEND_MODES.indexOf(mode));
      if (index === 0) {
        target(into);
        gl.useProgram(copy.program);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        bind(0, from.texture);
        gl.uniform1i(copy.uniform('src'), 0);
        gl.uniform1f(copy.uniform('opacity'), opacity);
        gl.uniform1i(copy.uniform('shift'), 0);
        full();
        gl.disable(gl.BLEND);
        return;
      }
      const under = surface();
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, into.buffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, under.buffer);
      gl.blitFramebuffer(0, 0, size.width, size.height, 0, 0, size.width, size.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      target(into);
      gl.useProgram(blend.program);
      bind(0, from.texture);
      bind(1, under.texture);
      gl.uniform1i(blend.uniform('src'), 0);
      gl.uniform1i(blend.uniform('dst'), 1);
      gl.uniform1f(blend.uniform('opacity'), opacity);
      gl.uniform1i(blend.uniform('mode'), index);
      full();
      release(under);
    };

    const finish = (s: Surface) => {
      region(null);
      target(null);
      gl.useProgram(copy.program);
      bind(0, s.texture);
      gl.uniform1i(copy.uniform('src'), 0);
      gl.uniform1f(copy.uniform('opacity'), 1);
      gl.uniform1i(copy.uniform('shift'), pad);
      full();
      release(s);
      uploaded.forEach((t) => gl.deleteTexture(t));
      return canvas.transferToImageBitmap();
    };

    return { surface, release, region, fill, paint: draw, effect: (s, e) => EFFECTS[e.kind](s, e), combine, mask: maskBy, blend: blendInto, finish };
  };

  return { device };
}

let shared: Gpu | null | undefined;

export function sharedGpu(): Gpu | null {
  if (shared !== undefined) {
    return shared;
  }
  try {
    shared = typeof OffscreenCanvas === 'undefined' ? null : webglGpu(new OffscreenCanvas(1, 1));
  } catch {
    shared = null;
  }
  return shared;
}

type Shot = { bitmap?: ImageBitmap; tree?: LayerTree; sheets?: ImageBitmap[] };

export function frameOf(shot: Shot): ImageBitmap {
  const gpu = shot.tree && shot.sheets ? sharedGpu() : null;
  if (gpu && shot.tree && shot.sheets) {
    const show = (n: LayerTree['root'], depth: string): string => `${depth}[${n.paints.map((p) => (p.kind === 'sheet' ? `s${p.sheet}:${Math.round(p.at[4])},${Math.round(p.at[5])} ${Math.round(p.width)}x${Math.round(p.height)}` : 'fill')).join(' ')}] o${n.opacity} ${n.blend} fx:${n.effects.map((e) => e.kind + (e.kind === 'blur' ? e.sigma : '')).join(',')} m${n.masks.length} c${n.clip ? 1 : 0}\n${n.children.map((c) => show(c, depth + '  ')).join('')}`;
    console.log('DBGTREE pad', shot.tree.pad, '\n' + show(shot.tree.root, ''));
    return composite(gpu.device(shot.sheets, shot.tree.width, shot.tree.height, shot.tree.pad), shot.tree);
  }
  if (!shot.bitmap) {
    throw new Error('frame not rendered');
  }
  return shot.bitmap;
}

export function exportLayering(): Layering {
  return sharedGpu() ? Layering.Gpu : Layering.Split;
}
