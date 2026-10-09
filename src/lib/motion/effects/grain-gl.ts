import type { turbulenceTile } from './turbulence';

export type Grain = { baseFrequency: number; seed: number; amount: number };
export type GrainArea = { inverse: number[]; width: number; height: number; margin: number };
export type GrainPass = (source: HTMLCanvasElement, grains: Grain[], area: GrainArea) => HTMLCanvasElement;

export function grainGl(tileOf: typeof turbulenceTile, tileSize: number, sampleOffset: number): GrainPass {
  const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform sampler2D tile;
uniform vec2 size;
uniform mat3 toUser;
uniform vec2 box;
uniform float margin;
uniform float amount;
uniform float tileSize;
uniform float flip;
out vec4 o;
void main() {
  vec2 px = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) - 0.5;
  vec4 s = texelFetch(src, ivec2(px.x, mix(px.y, size.y - 1.0 - px.y, flip)), 0);
  vec2 user = (toUser * vec3(px + 0.5, 1.0)).xy;
  if (any(lessThan(user, -margin * box)) || any(greaterThanEqual(user, (1.0 + margin) * box))) {
    o = vec4(0.0);
    return;
  }
  vec4 n = texture(tile, user / tileSize);
  float g = dot(n.rgb, vec3(0.213, 0.715, 0.072));
  vec4 gray = vec4(vec3(g) * n.a, n.a);
  vec4 m = clamp(amount * gray + s - amount / 2.0, 0.0, 1.0);
  m.rgb = min(m.rgb, m.a);
  o = m * s.a;
}`;

  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  const tiles = new Map<string, WebGLTexture>();

  const compile = (ctx: WebGL2RenderingContext, type: number, source: string) => {
    const shader = ctx.createShader(type) as WebGLShader;
    ctx.shaderSource(shader, source);
    ctx.compileShader(shader);
    return shader;
  };

  const setup = () => {
    canvas = document.createElement('canvas');
    gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
    if (!gl) {
      throw new Error('no webgl2');
    }
    program = gl.createProgram() as WebGLProgram;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    return { canvas, gl, program };
  };

  const texture = (ctx: WebGL2RenderingContext) => {
    const t = ctx.createTexture() as WebGLTexture;
    ctx.bindTexture(ctx.TEXTURE_2D, t);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    return t;
  };

  const tileTexture = (ctx: WebGL2RenderingContext, grain: Grain) => {
    const key = `${grain.baseFrequency}:${grain.seed}`;
    const known = tiles.get(key);
    if (known) {
      return known;
    }
    const t = texture(ctx);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.REPEAT);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.REPEAT);
    const pixels = tileOf({ baseFrequency: grain.baseFrequency, seed: grain.seed, octaves: 1, size: tileSize, offset: sampleOffset });
    ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, tileSize, tileSize, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(pixels.buffer));
    tiles.set(key, t);
    return t;
  };

  return (source, grains, area) => {
    const ready = gl && program && canvas ? { canvas, gl, program } : setup();
    const ctx = ready.gl;
    ready.canvas.width = source.width;
    ready.canvas.height = source.height;
    ctx.viewport(0, 0, source.width, source.height);
    const u = (name: string) => ctx.getUniformLocation(ready.program, name);
    ctx.uniform2f(u('size'), source.width, source.height);
    const [a, b, c, d, e, f] = area.inverse;
    ctx.uniformMatrix3fv(u('toUser'), false, [a, b, 0, c, d, 0, e, f, 1]);
    ctx.uniform2f(u('box'), area.width, area.height);
    ctx.uniform1f(u('margin'), area.margin);
    ctx.uniform1f(u('tileSize'), tileSize);
    ctx.uniform1i(u('src'), 0);
    ctx.uniform1i(u('tile'), 1);

    const own = texture(ctx);
    ctx.activeTexture(ctx.TEXTURE0);
    ctx.bindTexture(ctx.TEXTURE_2D, own);
    ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, source);
    ctx.uniform1f(u('flip'), 0);
    for (const [index, grain] of grains.entries()) {
      if (index > 0) {
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, own);
        ctx.copyTexImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 0, 0, source.width, source.height, 0);
        ctx.uniform1f(u('flip'), 1);
      }
      ctx.activeTexture(ctx.TEXTURE1);
      ctx.bindTexture(ctx.TEXTURE_2D, tileTexture(ctx, grain));
      ctx.uniform1f(u('amount'), grain.amount);
      ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
    }
    ctx.deleteTexture(own);
    return ready.canvas;
  };
}
