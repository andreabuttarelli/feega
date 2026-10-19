import type { Affine } from '../affine';
import { program } from './gl-kit';

export type Box = [x0: number, y0: number, x1: number, y1: number];

export type Coverage = { accumulate: (contours: number[][], matrix: Affine) => Box | null; texture: WebGLTexture; clear: (box: Box) => void };

const FLOATS_PER_EDGE = 4;
const QUAD_CORNERS = 6;

const EDGE_VS = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_edge;
uniform vec2 u_frame;
uniform float u_right;
out vec4 v_edge;
void main() {
  v_edge = a_edge;
  float left = floor(min(a_edge.x, a_edge.z)) - 1.0;
  float top = floor(min(a_edge.y, a_edge.w));
  float bottom = ceil(max(a_edge.y, a_edge.w));
  vec2 p = vec2(mix(left, u_right, a_corner.x), mix(top, bottom, a_corner.y));
  gl_Position = vec4(p.x / u_frame.x * 2.0 - 1.0, 1.0 - p.y / u_frame.y * 2.0, 0.0, 1.0);
}`;

const EDGE_FS = `#version 300 es
precision highp float;
in vec4 v_edge;
uniform float u_height;
out vec4 outColor;
float rising(float x, float l) {
  float d = x - l;
  return d <= 0.0 ? 0.0 : d >= 1.0 ? d - 0.5 : 0.5 * d * d;
}
void main() {
  float l = gl_FragCoord.x - 0.5;
  float t = u_height - gl_FragCoord.y - 0.5;
  vec2 a = v_edge.xy;
  vec2 b = v_edge.zw;
  float ya = clamp(a.y, t, t + 1.0);
  float yb = clamp(b.y, t, t + 1.0);
  float h = yb - ya;
  if (h == 0.0) { discard; }
  float k = (b.x - a.x) / (b.y - a.y);
  float xa = a.x + (ya - a.y) * k;
  float xb = a.x + (yb - a.y) * k;
  float inside = abs(xb - xa) < 1e-6 ? clamp(xa - l, 0.0, 1.0) : (rising(xb, l) - rising(xa, l)) / (xb - xa);
  outColor = vec4(h * (1.0 - inside), 0.0, 0.0, 0.0);
}`;

export function createCoverage(gl: WebGL2RenderingContext, width: number, height: number): Coverage {
  gl.getExtension('EXT_color_buffer_float');
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const edges = program(gl, EDGE_VS, EDGE_FS);
  const corners = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
  const instances = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, FLOATS_PER_EDGE, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1);
  gl.bindVertexArray(null);
  const u = (name: string) => gl.getUniformLocation(edges, name);

  function edgesOf(contours: number[][], m: Affine): { data: Float32Array; box: Box } | null {
    const out: number[] = [];
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const c of contours) {
      const n = c.length / 2;
      if (n < 3) {
        continue;
      }
      const pts = Array.from({ length: n }, (_, i) => [m[0] * c[2 * i] + m[2] * c[2 * i + 1] + m[4], m[1] * c[2 * i] + m[3] * c[2 * i + 1] + m[5]]);
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % n];
        x0 = Math.min(x0, ax);
        y0 = Math.min(y0, ay);
        x1 = Math.max(x1, ax);
        y1 = Math.max(y1, ay);
        if (ay !== by) {
          out.push(ax, ay, bx, by);
        }
      }
    }
    return out.length ? { data: new Float32Array(out), box: [Math.max(0, Math.floor(x0) - 1), Math.max(0, Math.floor(y0) - 1), Math.min(width, Math.ceil(x1) + 1), Math.min(height, Math.ceil(y1) + 1)] } : null;
  }

  function accumulate(contours: number[][], matrix: Affine): Box | null {
    const found = edgesOf(contours, matrix);
    if (!found) {
      return null;
    }
    const back = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const previous = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
    const blending = gl.isEnabled(gl.BLEND);
    const scissoring = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.useProgram(edges);
    gl.uniform2f(u('u_frame'), width, height);
    gl.uniform1f(u('u_right'), found.box[2] + 1);
    gl.uniform1f(u('u_height'), height);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    gl.bufferData(gl.ARRAY_BUFFER, found.data, gl.STREAM_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, QUAD_CORNERS, found.data.length / FLOATS_PER_EDGE);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    toggle(gl.BLEND, blending);
    toggle(gl.SCISSOR_TEST, scissoring);
    gl.bindVertexArray(previous);
    gl.bindFramebuffer(gl.FRAMEBUFFER, back);
    return found.box;
  }

  const toggle = (cap: number, on: boolean) => (on ? gl.enable(cap) : gl.disable(cap));

  function clear([x0, y0, x1, y1]: Box) {
    const back = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const scissoring = gl.isEnabled(gl.SCISSOR_TEST);
    const box = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
    const colour = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, height - y1, x1 - x0, y1 - y0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(colour[0], colour[1], colour[2], colour[3]);
    gl.scissor(box[0], box[1], box[2], box[3]);
    toggle(gl.SCISSOR_TEST, scissoring);
    gl.bindFramebuffer(gl.FRAMEBUFFER, back);
  }

  return { accumulate, texture, clear };
}
