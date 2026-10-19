import { FillRule, ItemKind, PaintKind, type DisplayList, type ImageItem, type Item, type Paint, type PathItem } from './display-list';
import { imageRect, type Size } from './image-rect';
import { gaussianKernel, MAX_TAPS } from './kernel';

const MAX_STOPS = 8;
const MSAA = 8;

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

const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_dir;
uniform int u_taps;
uniform float u_w[${MAX_TAPS}];
out vec4 outColor;
void main() {
  vec4 sum = texture(u_src, v_uv) * u_w[0];
  for (int i = 1; i < ${MAX_TAPS}; i++) {
    if (i >= u_taps) { break; }
    vec2 o = u_dir * float(i);
    sum += (texture(u_src, v_uv + o) + texture(u_src, v_uv - o)) * u_w[i];
  }
  outColor = sum;
}`;

const COPY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_opacity;
out vec4 outColor;
void main() { outColor = texture(u_src, v_uv) * u_opacity; }`;

const PAINT_KIND: Record<PaintKind, number> = { [PaintKind.Solid]: 0, [PaintKind.Linear]: 1, [PaintKind.Radial]: 2 };

type Target = { fbo: WebGLFramebuffer; resolve: WebGLFramebuffer; texture: WebGLTexture; buffers: WebGLRenderbuffer[] };

export type Picture = { source: TexImageSource; size: Size };

export type Pictures = (item: ImageItem) => Picture | null;

export type Raster = { draw: (list: DisplayList, pictures?: Pictures) => void; dispose: () => void };

const NO_PICTURES: Pictures = () => null;

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    }
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'a_pos');
  gl.linkProgram(p);
  return p;
}

function texture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

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

function plain(gl: WebGL2RenderingContext, width: number, height: number): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
  const tex = texture(gl, width, height);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fbo, texture: tex };
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
  const textures = new Map<TexImageSource, WebGLTexture>();
  const main = target(gl, width, height, samples);
  const layer = target(gl, width, height, samples);
  const ping = plain(gl, width, height);
  const pong = plain(gl, width, height);
  const geometry = gl.createBuffer()!;
  const quad = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
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

  function fillPath(item: PathItem, opacity: number) {
    const m = item.matrix;
    gl.useProgram(pathProgram);
    gl.uniformMatrix3fv(u(pathProgram, 'u_matrix'), false, [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1]);
    gl.uniform2f(u(pathProgram, 'u_frame'), width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.STENCIL_TEST);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    if (item.rule === FillRule.EvenOdd) {
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    } else {
      gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
      gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    }
    for (const contour of item.contours) {
      if (contour.length < 6) {
        continue;
      }
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(contour), gl.STREAM_DRAW);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, contour.length / 2);
    }
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
    gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);
    setPaint(item.paint, opacity);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bounds(item.contours)), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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
    if (!known || source instanceof HTMLVideoElement) {
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
    const m = item.matrix;
    const r = imageRect(item.size, picture.size, item.fit, item.focus, item.zoom);
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
    const [x0, y0, x1, y1] = item.clipped ? [0, 0, w, h] : [Math.min(0, r.x), Math.min(0, r.y), Math.max(w, r.x + r.width), Math.max(h, r.y + r.height)];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1]), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function drawItem(item: Item, opacity: number, pictures: Pictures) {
    if (item.kind === ItemKind.Image) {
      drawImage(item, opacity, pictures);
      return;
    }
    fillPath(item, opacity);
  }

  function blurred(item: Item, pictures: Pictures) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawItem(item, 1, pictures);
    resolveInto(layer);
    const { weights, step } = gaussianKernel(item.blur);
    const blur = (dir: [number, number]) => () => {
      gl.uniform2f(u(blurProgram, 'u_dir'), dir[0], dir[1]);
      gl.uniform1i(u(blurProgram, 'u_taps'), weights.length);
      gl.uniform1fv(u(blurProgram, 'u_w'), Float32Array.from({ length: MAX_TAPS }, (_, i) => weights[i] ?? 0));
    };
    gl.disable(gl.BLEND);
    pass(blurProgram, layer.texture, ping.fbo, blur([step / width, 0]));
    pass(blurProgram, ping.texture, pong.fbo, blur([0, step / height]));
    gl.enable(gl.BLEND);
    pass(copyProgram, pong.texture, main.fbo, () => gl.uniform1f(u(copyProgram, 'u_opacity'), item.opacity));
  }

  function draw(list: DisplayList, pictures: Pictures = NO_PICTURES) {
    gl.viewport(0, 0, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
    const [r, g, b, a] = list.background ?? [0, 0, 0, 0];
    gl.clearColor(r * a, g * a, b * a, a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const item of list.items) {
      if (item.blur > 0) {
        blurred(item, pictures);
        continue;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, main.fbo);
      drawItem(item, item.opacity, pictures);
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
