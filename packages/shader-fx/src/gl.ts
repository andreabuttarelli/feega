import * as twgl from 'twgl.js';
import type { ShaderParam } from './effect';
import { buildFragment, uniformName, VERTEX } from './prelude';

export type ShaderSource = { frag: string; params: ShaderParam[] };

export type Runtime = { gl: WebGLRenderingContext; quad: twgl.BufferInfo; passthrough: twgl.ProgramInfo };

export type Compiled = { program: twgl.ProgramInfo; params: ShaderParam[] } | { problems: string[] };

export type Uniforms = { time: number; seed: number; values: Record<string, number | string> };

export type Drawn = { canvas: HTMLCanvasElement | OffscreenCanvas; passed: boolean };

type GlCanvas = HTMLCanvasElement | OffscreenCanvas;

const PASSTHROUGH: ShaderSource = { frag: 'vec4 effect(vec2 uv) { return texture2D(u_src, uv); }', params: [] };

const QUAD = { a_pos: { numComponents: 2, data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1] } };

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function rgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0, 0, 0];
}

function link(gl: WebGLRenderingContext, source: ShaderSource): Compiled {
  const problems: string[] = [];
  const program = twgl.createProgramInfo(gl, [VERTEX, buildFragment(source.frag, source.params)], { errorCallback: (msg: string) => problems.push(msg) });
  return program ? { program, params: source.params } : { problems: problems.length ? problems : ['link failed'] };
}

export function createRuntime(canvas: GlCanvas): Runtime | null {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false }) as WebGLRenderingContext | null;
  if (!gl) {
    return null;
  }

  const passthrough = link(gl, PASSTHROUGH);
  if ('problems' in passthrough) {
    return null;
  }

  return { gl, quad: twgl.createBufferInfoFromArrays(gl, QUAD), passthrough: passthrough.program };
}

export const compile = (rt: Runtime, source: ShaderSource): Compiled => link(rt.gl, source);

function paramUniforms(params: ShaderParam[], values: Record<string, number | string>) {
  return Object.fromEntries(
    params.map((p) => {
      const value = values[p.key] ?? p.default;
      return [uniformName(p.key), p.kind === 'color' ? rgb(String(value)) : Number(value)];
    })
  );
}

export function draw(rt: Runtime, compiled: Compiled | null, source: TexImageSource, uniforms: Uniforms): GlCanvas {
  const { gl } = rt;
  const width = 'width' in source ? Number(source.width) : gl.drawingBufferWidth;
  const height = 'height' in source ? Number(source.height) : gl.drawingBufferHeight;
  const canvas = gl.canvas as GlCanvas;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const usable = compiled && 'program' in compiled ? compiled : null;
  const program = usable?.program ?? rt.passthrough;
  const texture = twgl.createTexture(gl, { src: source as TexImageSource, flipY: 1, min: gl.LINEAR, mag: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE, auto: false });

  gl.viewport(0, 0, width, height);
  gl.useProgram(program.program);
  twgl.setBuffersAndAttributes(gl, program, rt.quad);
  twgl.setUniforms(program, { u_src: texture, u_res: [width, height], u_time: uniforms.time, u_seed: uniforms.seed, ...paramUniforms(usable?.params ?? [], uniforms.values) });
  twgl.drawBufferInfo(gl, rt.quad);
  gl.deleteTexture(texture);

  return canvas;
}

export function read(rt: Runtime): Uint8ClampedArray {
  const { gl } = rt;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  const rows = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rows);

  const stride = width * 4;
  const out = new Uint8ClampedArray(rows.length);
  for (let y = 0; y < height; y++) {
    out.set(rows.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }

  return out;
}

export function drawEffect(rt: Runtime, source: ShaderSource, image: TexImageSource, uniforms: Uniforms): Drawn {
  const compiled = compile(rt, source);
  return { canvas: draw(rt, compiled, image, uniforms), passed: 'program' in compiled };
}
