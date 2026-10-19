import { FillRule, ItemKind, PaintKind, type DisplayList, type ImageItem, type Item, type LayerItem, type LensItem, type Paint, type PathItem } from './display-list';
import { BLOB_FRAGMENT } from '../hyperframes/blob';
import { imageRect, type Size } from './image-rect';
import { gaussianKernel, MAX_TAPS } from './kernel';
import { BLEND_FS, BLUR_FS, QUAD_VS, plain, program, texture } from './gl-kit';
import { createFilters } from './filters-gpu';
import { BlendMode } from '../blend';
import { MaskMode } from '../mask';
import { CoverKind, RampKind, type MaskLayer } from './mask-layers';
import { MAX_STOPS } from './paint';

const MSAA = 8;
const LENS_VS = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';
const STENCIL_ALL = 0xff;
const CLIP_BIT = 0x80;
const COVER_BITS = 0x7f;

const PATH_VS = `#version 300 es
in vec2 a_pos;
uniform mat3 u_matrix;
uniform vec2 u_frame;
out vec2 v_local;
void main() {
  v_local = a_pos;
  vec2 p = (u_matrix * vec3(a_pos, 1.0)).xy;
  gl_Position = vec4(p.x / u_frame.x * 2.0 - 1.0, 1.0 - p.y / u_frame.y * 2.0, 0.0, 1.0);
}`;

const PATH_FS = `#version 300 es
precision highp float;
in vec2 v_local;
uniform int u_kind;
uniform vec4 u_color;
uniform vec2 u_a;
uniform vec2 u_b;
uniform float u_radius;
uniform int u_count;
uniform float u_at[${MAX_STOPS}];
uniform vec4 u_stop[${MAX_STOPS}];
uniform float u_opacity;
out vec4 outColor;
vec4 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec4 c = u_stop[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (i >= u_count) { break; }
    float span = max(u_at[i] - u_at[i - 1], 1e-6);
    c = mix(c, u_stop[i], clamp((t - u_at[i - 1]) / span, 0.0, 1.0));
  }
  return c;
}
void main() {
  vec4 c = u_color;
  if (u_kind == 1) {
    vec2 d = u_b - u_a;
    c = ramp(dot(v_local - u_a, d) / max(dot(d, d), 1e-6));
  } else if (u_kind == 2) {
    c = ramp(length(v_local - u_a) / max(u_radius, 1e-6));
  }
  float a = c.a * u_opacity;
  outColor = vec4(c.rgb * a, a);
}`;

const IMAGE_FS = `#version 300 es
precision highp float;
in vec2 v_local;
uniform sampler2D u_src;
uniform vec4 u_rect;
uniform float u_opacity;
out vec4 outColor;
void main() {
  vec2 uv = (v_local - u_rect.xy) / u_rect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { discard; }
  outColor = texture(u_src, uv) * u_opacity;
}`;

const COPY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_opacity;
uniform sampler2D u_mask;
uniform int u_masked;
out vec4 outColor;
void main() {
  float m = u_masked == 1 ? texture(u_mask, v_uv).a : 1.0;
  outColor = texture(u_src, v_uv) * u_opacity * m;
}`;

const FOLD_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_acc;
uniform sampler2D u_cov;
uniform int u_mode;
uniform int u_first;
uniform float u_level;
uniform int u_invert;
uniform int u_luma;
out vec4 outColor;
void main() {
  vec4 c = texture(u_cov, v_uv);
  float cov = u_luma == 1 ? dot(c.rgb, vec3(0.2125, 0.7154, 0.0721)) : c.a;
  float l = u_invert == 1 ? 1.0 - u_level * cov : u_level * cov;
  float seed = (u_mode == 1 || u_mode == 2) ? 1.0 : 0.0;
  float k = u_first == 1 ? seed : texture(u_acc, v_uv).a;
  float o = u_mode == 0 ? k + l - k * l : u_mode == 1 ? k * (1.0 - l) : u_mode == 2 ? k * l : k + l - 2.0 * k * l;
  outColor = vec4(o);
}`;

const BLEND_MODE: Record<BlendMode, number> = {
  [BlendMode.Normal]: 0,
  [BlendMode.Multiply]: 1,
  [BlendMode.Screen]: 2,
  [BlendMode.Overlay]: 3,
  [BlendMode.Darken]: 4,
  [BlendMode.Lighten]: 5,
  [BlendMode.ColorDodge]: 6,
  [BlendMode.ColorBurn]: 7,
  [BlendMode.HardLight]: 8,
  [BlendMode.SoftLight]: 9,
  [BlendMode.Difference]: 10,
  [BlendMode.Exclusion]: 11,
  [BlendMode.Hue]: 12,
  [BlendMode.Saturation]: 13,
  [BlendMode.Color]: 14,
  [BlendMode.Luminosity]: 15
};

const FOLD_MODE: Record<MaskMode, number> = { [MaskMode.Add]: 0, [MaskMode.Subtract]: 1, [MaskMode.Intersect]: 2, [MaskMode.Difference]: 3 };
const WHITE: [number, number, number, number] = [1, 1, 1, 1];
const CLEAR: [number, number, number, number] = [1, 1, 1, 0];
const RAMP_PAINT: Record<RampKind, Paint> = {
  [RampKind.Linear]: { kind: PaintKind.Linear, from: [0, 0.5], to: [1, 0.5], stops: [{ at: 0, color: WHITE }, { at: 1, color: CLEAR }] },
  [RampKind.Radial]: { kind: PaintKind.Radial, center: [0.5, 0.5], radius: 0.5, stops: [{ at: 0, color: WHITE }, { at: 1, color: CLEAR }] }
};

const PAINT_KIND: Record<PaintKind, number> = { [PaintKind.Solid]: 0, [PaintKind.Linear]: 1, [PaintKind.Radial]: 2 };

type Target = { fbo: WebGLFramebuffer; resolve: WebGLFramebuffer; texture: WebGLTexture; buffers: WebGLRenderbuffer[] };

export type Picture = { source: TexImageSource; size: Size };

export type Pictures = (item: ImageItem | LayerItem) => Picture | null;

export type Raster = { draw: (list: DisplayList, pictures?: Pictures) => void; dispose: () => void };

const NO_PICTURES: Pictures = () => null;

function target(gl: WebGL2RenderingContext, width: number, height: number, samples: number): Target {
  const colour = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, colour);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, width, height);
  const stencil = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, stencil);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH24_STENCIL8, width, height);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, colour);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, stencil);
  const tex = texture(gl, width, height);
  const resolve = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, resolve);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fbo, resolve, texture: tex, buffers: [colour, stencil] };
}

const bounds = (contours: number[][]) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of contours) {
    for (let i = 0; i < c.length; i += 2) {
      x0 = Math.min(x0, c[i]);
      y0 = Math.min(y0, c[i + 1]);
      x1 = Math.max(x1, c[i]);
      y1 = Math.max(y1, c[i + 1]);
    }
  }
  return [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1];
};

function contextOf(canvas: HTMLCanvasElement | OffscreenCanvas): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true, stencil: false }) as WebGL2RenderingContext | null;
  if (!gl) {
    throw new Error('webgl2 unavailable');
  }
  return gl;
}

export function createRaster(canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number): Raster {
  canvas.width = width;
  canvas.height = height;
  const gl = contextOf(canvas);
  const samples = Math.min(MSAA, gl.getParameter(gl.MAX_SAMPLES) as number);
  const pathProgram = program(gl, PATH_VS, PATH_FS);
  const blurProgram = program(gl, QUAD_VS, BLUR_FS);
  const copyProgram = program(gl, QUAD_VS, COPY_FS);
  const imageProgram = program(gl, PATH_VS, IMAGE_FS);
  const blendProgram = program(gl, QUAD_VS, BLEND_FS);
  const lensProgram = program(gl, LENS_VS, BLOB_FRAGMENT);
  const textures = new Map<TexImageSource, WebGLTexture>();
  const main = target(gl, width, height, samples);
  const layer = target(gl, width, height, samples);
  const ping = plain(gl, width, height);
  const pong = plain(gl, width, height);
  const accA = plain(gl, width, height);
  const accB = plain(gl, width, height);
  const shade = plain(gl, width, height);
  const foldProgram = program(gl, QUAD_VS, FOLD_FS);
  const geometry = gl.createBuffer()!;
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const filters = createFilters(gl, width, height, quad);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  const u = (p: WebGLProgram, name: string) => gl.getUniformLocation(p, name);

  function setPaint(paint: Paint, opacity: number) {
    gl.uniform1i(u(pathProgram, 'u_kind'), PAINT_KIND[paint.kind]);
    gl.uniform1f(u(pathProgram, 'u_opacity'), opacity);
    if (paint.kind === PaintKind.Solid) {
      gl.uniform4fv(u(pathProgram, 'u_color'), paint.color);
      return;
    }
    const stops = paint.stops.slice(0, MAX_STOPS);
    gl.uniform1i(u(pathProgram, 'u_count'), stops.length);
    gl.uniform1fv(u(pathProgram, 'u_at'), Float32Array.from({ length: MAX_STOPS }, (_, i) => stops[Math.min(i, stops.length - 1)].at));
    gl.uniform4fv(u(pathProgram, 'u_stop'), Float32Array.from({ length: MAX_STOPS * 4 }, (_, i) => stops[Math.min(Math.floor(i / 4), stops.length - 1)].color[i % 4]));
    if (paint.kind === PaintKind.Linear) {
      gl.uniform2fv(u(pathProgram, 'u_a'), paint.from);
      gl.uniform2fv(u(pathProgram, 'u_b'), paint.to);
      return;
    }
    gl.uniform2fv(u(pathProgram, 'u_a'), paint.center);
    gl.uniform1f(u(pathProgram, 'u_radius'), paint.radius);
  }

  function fan(contours: number[][]) {
    for (const contour of contours) {
      if (contour.length < 6) {
        continue;
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(contour), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, contour.length / 2);
    }
  }

  const COVERAGE: Record<FillRule, () => void> = {
    [FillRule.EvenOdd]: () => gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT),
    [FillRule.NonZero]: () => {
      gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
      gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    },
    [FillRule.Union]: () => gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR_WRAP)
  };

  function fillPath(item: PathItem, opacity: number) {
    const m = item.matrix;
    gl.useProgram(pathProgram);
    gl.uniformMatrix3fv(u(pathProgram, 'u_matrix'), false, [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
    gl.uniform2f(u(pathProgram, 'u_frame'), width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(STENCIL_ALL);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    if (item.within) {
      gl.stencilMask(CLIP_BIT);
      gl.stencilFunc(gl.ALWAYS, 0, STENCIL_ALL);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
      fan(item.within.contours);
    }
    gl.stencilMask(COVER_BITS);
    gl.stencilFunc(item.within ? gl.EQUAL : gl.ALWAYS, item.within?.outside ? 0 : CLIP_BIT, CLIP_BIT);
    COVERAGE[item.rule]();
    fan(item.contours);
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 0, COVER_BITS);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    setPaint(item.paint, opacity);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bounds(item.contours)), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.stencilMask(STENCIL_ALL);
    gl.disable(gl.STENCIL_TEST);
  }

  function resolveInto(t: Target) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, t.resolve);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  }

  function pass(prog: WebGLProgram, src: WebGLTexture, into: WebGLFramebuffer | null, set: () => void) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, into);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(u(prog, 'u_src'), 0);
    set();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function textureOf(source: TexImageSource): WebGLTexture {
    const known = textures.get(source);
    const tex = known ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (!known || !(source instanceof HTMLImageElement)) {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.set(source, tex);
    }
    return tex;
  }

  function drawImage(item: ImageItem, opacity: number, pictures: Pictures) {
    const picture = pictures(item);
    if (!picture) {
      return;
    }
    const fitted = imageRect(item.size, picture.size, item.fit, item.focus, item.zoom);
    const [k, , , , tx, ty] = item.inner;
    drawPicture(item, picture, { x: fitted.x * k + tx, y: fitted.y * k + ty, width: fitted.width * k, height: fitted.height * k }, item.clipped, opacity);
  }

  function drawLayer(item: LayerItem, opacity: number, pictures: Pictures) {
    const picture = pictures(item);
    if (picture) {
      drawPicture(item, picture, { x: 0, y: 0, ...item.size }, true, opacity);
    }
  }

  function drawPicture(item: ImageItem | LayerItem, picture: Picture, r: { x: number; y: number; width: number; height: number }, clipped: boolean, opacity: number) {
    const m = item.matrix;
    const { width: w, height: h } = item.size;
    gl.useProgram(imageProgram);
    gl.uniformMatrix3fv(u(imageProgram, 'u_matrix'), false, [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
    gl.uniform2f(u(imageProgram, 'u_frame'), width, height);
    gl.uniform4f(u(imageProgram, 'u_rect'), r.x, r.y, r.width, r.height);
    gl.uniform1f(u(imageProgram, 'u_opacity'), opacity);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureOf(picture.source));
    gl.uniform1i(u(imageProgram, 'u_src'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const [x0, y0, x1, y1] = clipped ? [0, 0, w, h] : [Math.min(0, r.x), Math.min(0, r.y), Math.max(w, r.x + r.width), Math.max(h, r.y + r.height)];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1]), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  const DRAW: Record<ItemKind, (item: never, opacity: number, pictures: Pictures) => void> = {
    [ItemKind.Path]: (item: PathItem, opacity) => fillPath(item, opacity),
    [ItemKind.Image]: drawImage,
    [ItemKind.Layer]: drawLayer,
    [ItemKind.Text]: () => {},
    [ItemKind.Lens]: () => {}
  };

  function drawItem(item: Item, opacity: number, pictures: Pictures) {
    (DRAW[item.kind] as (item: Item, opacity: number, pictures: Pictures) => void)(item, opacity, pictures);
  }

  function scissored(item: Item, paint: () => void) {
    if (!item.scissor) {
      paint();
      return;
    }
    const [x0, y0, x1, y1] = item.scissor;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.round(x0), Math.round(height - y1), Math.round(x1 - x0), Math.round(y1 - y0));
    paint();
    gl.disable(gl.SCISSOR_TEST);
  }

  function blurredFrom(item: Item, src: WebGLTexture): WebGLTexture {
    if (item.blur <= 0) {
      return src;
    }
    const { weights, step } = gaussianKernel(item.blur);
    const blur = (dir: [number, number]) => () => {
      gl.uniform2f(u(blurProgram, 'u_dir'), dir[0], dir[1]);
      gl.uniform1i(u(blurProgram, 'u_taps'), weights.length);
      gl.uniform1fv(u(blurProgram, 'u_w'), Float32Array.from({ length: MAX_TAPS }, (_, i) => weights[i] ?? 0));
    };
    gl.disable(gl.BLEND);
    pass(blurProgram, src, ping.fbo, blur([step / width, 0]));
    pass(blurProgram, ping.texture, pong.fbo, blur([0, step / height]));
    gl.enable(gl.BLEND);
    return pong.texture;
  }

  function bindMask(prog: WebGLProgram, mask: WebGLTexture | null) {
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mask);
    gl.uniform1i(u(prog, 'u_mask'), 2);
    gl.uniform1i(u(prog, 'u_masked'), mask ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
  }

  function composite(item: Item, src: WebGLTexture, mask: WebGLTexture | null) {
    if (item.blend === BlendMode.Normal) {
      pass(copyProgram, src, main.fbo, () => {
        gl.uniform1f(u(copyProgram, 'u_opacity'), item.opacity);
        bindMask(copyProgram, mask);
      });
      return;
    }
    resolveInto(main);
    gl.disable(gl.BLEND);
    pass(blendProgram, src, main.fbo, () => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, main.texture);
      gl.uniform1i(u(blendProgram, 'u_dst'), 1);
      gl.uniform1f(u(blendProgram, 'u_opacity'), item.opacity);
      gl.uniform1i(u(blendProgram, 'u_mode'), BLEND_MODE[item.blend]);
      bindMask(blendProgram, mask);
      gl.activeTexture(gl.TEXTURE0);
    });
    gl.enable(gl.BLEND);
  }

  function intoLayer(paint: () => void) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    paint();
    resolveInto(layer);
  }

  function blurTexture(src: WebGLTexture, sigma: number): WebGLTexture {
    return sigma > 0 ? blurredFrom({ blur: sigma } as Item, src) : src;
  }

  type Fold = { cov: WebGLTexture; mode: MaskMode; level: number; invert: boolean; luma: boolean };

  function coverPaint(m: MaskLayer, pictures: Pictures) {
    const c = m.cover;
    if (c.kind === CoverKind.Picture) {
      drawImage({ kind: ItemKind.Image, clip: c.src, src: c.src, video: false, mediaTime: 0, size: { width: 1, height: 1 }, fit: 'fill', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: [1, 0, 0, 1, 0, 0], opacity: 1, matrix: c.matrix, blur: 0, blend: BlendMode.Normal }, 1, pictures);
      return;
    }
    const paint = c.kind === CoverKind.Ramp ? RAMP_PAINT[c.ramp] : { kind: PaintKind.Solid as const, color: WHITE };
    fillPath({ kind: ItemKind.Path, clip: '', contours: c.contours, rule: FillRule.NonZero, paint, opacity: 1, matrix: c.matrix, blur: 0, blend: BlendMode.Normal }, 1);
  }

  function maskOf(item: Item, pictures: Pictures): WebGLTexture | null {
    let mask: WebGLTexture | null = null;
    for (const m of item.masks ?? []) {
      intoLayer(() => coverPaint(m, pictures));
      mask = foldOne(mask, { cov: blurTexture(layer.texture, m.feather), mode: m.mode, level: m.level, invert: m.invert, luma: m.cover.kind === CoverKind.Picture && m.cover.luma });
    }
    const matte = item.matte;
    if (matte) {
      intoLayer(() => matte.items.forEach((i) => drawItem(i, i.opacity, pictures)));
      mask = foldOne(mask, { cov: layer.texture, mode: MaskMode.Intersect, level: 1, invert: matte.invert, luma: matte.luma });
    }
    return mask;
  }

  function foldOne(acc: WebGLTexture | null, step: Fold): WebGLTexture {
    const into = acc === accA.texture ? accB : accA;
    gl.disable(gl.BLEND);
    pass(foldProgram, step.cov, into.fbo, () => {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, acc);
      gl.uniform1i(u(foldProgram, 'u_acc'), 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u(foldProgram, 'u_cov'), 0);
      gl.uniform1i(u(foldProgram, 'u_mode'), FOLD_MODE[step.mode]);
      gl.uniform1i(u(foldProgram, 'u_first'), acc ? 0 : 1);
      gl.uniform1f(u(foldProgram, 'u_level'), step.level);
      gl.uniform1i(u(foldProgram, 'u_invert'), step.invert ? 1 : 0);
      gl.uniform1i(u(foldProgram, 'u_luma'), step.luma ? 1 : 0);
    });
    gl.enable(gl.BLEND);
    return into.texture;
  }

  const silhouette = (item: Item): Item => (item.kind === ItemKind.Path ? { ...item, paint: { kind: PaintKind.Solid, color: WHITE } } : item);

  function behind(item: Item, sigma: number, pictures: Pictures) {
    intoLayer(() => drawItem(silhouette(item), 1, pictures));
    gl.disable(gl.BLEND);
    pass(copyProgram, layer.texture, shade.fbo, () => {
      gl.uniform1f(u(copyProgram, 'u_opacity'), 1);
      bindMask(copyProgram, null);
    });
    resolveInto(main);
    const soft = blurTexture(main.texture, sigma);
    gl.enable(gl.BLEND);
    pass(copyProgram, soft, main.fbo, () => {
      gl.uniform1f(u(copyProgram, 'u_opacity'), 1);
      bindMask(copyProgram, shade.texture);
    });
  }

  function layered(item: Item, pictures: Pictures) {
    const mask = item.masks || item.matte ? maskOf(item, pictures) : null;
    if (item.backdrop) {
      scissored(item, () => behind(item, item.backdrop!, pictures));
    }
    intoLayer(() => drawItem(item, 1, pictures));
    const filtered = item.filters ? filters.apply(layer.texture, item.filters, item.space ?? [1, 0, 0, 1]) : layer.texture;
    const src = blurredFrom(item, filtered);
    scissored(item, () => composite(item, src, mask));
  }

  function lens(item: LensItem, below: Item[], pictures: Pictures) {
    const l = item.lens;
    const [x, y, w, h] = l.box;
    const left = Math.max(Math.floor(x), 0);
    const top = Math.max(Math.floor(y), 0);
    const right = Math.min(Math.ceil(x + w), width);
    const bottom = Math.min(Math.ceil(y + h), height);
    if (right <= left || bottom <= top || l.presence <= 0) {
      return;
    }
    intoLayer(() => below.forEach((i) => drawItem(i, i.opacity, pictures)));
    gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
    gl.useProgram(lensProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.texture);
    const at = (name: string) => u(lensProgram, name);
    gl.uniform1i(at('uContent'), 0);
    gl.uniform2f(at('uSize'), width, height);
    gl.uniform2fv(at('uCenter'), l.center);
    gl.uniform3fv(at('uDrop'), l.drops);
    gl.uniform3fv(at('uUnwarp'), l.unwarp);
    gl.uniform3fv(at('uTint'), l.tint);
    const scalars: [string, number][] = [['uBlend', l.blend], ['uWobble', l.wobble], ['uWobbleSpeed', l.wobbleSpeed], ['uTime', l.time], ['uSeed', l.seed], ['uIor', l.ior], ['uDisp', l.dispersion], ['uFrost', l.frost], ['uRefl', l.reflection], ['uTintAmt', l.tintAmount], ['uPresence', l.presence]];
    scalars.forEach(([name, value]) => gl.uniform1f(at(name), value));
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(left, height - bottom, right - left, bottom - top);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  function draw(list: DisplayList, pictures: Pictures = NO_PICTURES) {
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
    const [r, g, b, a] = list.background ?? [0, 0, 0, 0];
    gl.clearColor(r * a, g * a, b * a, a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const [index, item] of list.items.entries()) {
      if (item.kind === ItemKind.Lens) {
        lens(item, list.items.slice(0, index), pictures);
        continue;
      }
      if (item.blur > 0 || item.blend !== BlendMode.Normal || item.masks || item.matte || item.filters || item.backdrop) {
        layered(item, pictures);
        continue;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
      scissored(item, () => drawItem(item, item.opacity, pictures));
    }
    resolveInto(main);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, main.resolve);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  }

  function dispose() {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return { draw, dispose };
}
