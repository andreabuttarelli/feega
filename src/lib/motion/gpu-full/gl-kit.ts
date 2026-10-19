import { MAX_TAPS } from './kernel';

export const BLEND_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform sampler2D u_dst;
uniform float u_opacity;
uniform int u_mode;
uniform sampler2D u_mask;
uniform int u_masked;
out vec4 outColor;
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColor(vec3 c) {
  float l = lum(c); float n = min(min(c.r, c.g), c.b); float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / max(l - n, 1e-6); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6); }
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColor(c + (l - lum(c))); }
float sat(vec3 c) { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
vec3 setSat(vec3 c, float s) {
  float n = min(min(c.r, c.g), c.b); float x = max(max(c.r, c.g), c.b);
  return x > n ? (c - n) * s / (x - n) : vec3(0.0);
}
float dodge(float b, float s) { return b == 0.0 ? 0.0 : s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float burn(float b, float s) { return b >= 1.0 ? 1.0 : s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
float hard(float b, float s) { return s <= 0.5 ? b * 2.0 * s : 1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)); }
float soft(float b, float s) {
  float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
  return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
vec3 mixed(vec3 b, vec3 s) {
  if (u_mode == 1) return b * s;
  if (u_mode == 2) return b + s - b * s;
  if (u_mode == 3) return vec3(hard(s.r, b.r), hard(s.g, b.g), hard(s.b, b.b));
  if (u_mode == 4) return min(b, s);
  if (u_mode == 5) return max(b, s);
  if (u_mode == 6) return vec3(dodge(b.r, s.r), dodge(b.g, s.g), dodge(b.b, s.b));
  if (u_mode == 7) return vec3(burn(b.r, s.r), burn(b.g, s.g), burn(b.b, s.b));
  if (u_mode == 8) return vec3(hard(b.r, s.r), hard(b.g, s.g), hard(b.b, s.b));
  if (u_mode == 9) return vec3(soft(b.r, s.r), soft(b.g, s.g), soft(b.b, s.b));
  if (u_mode == 10) return abs(b - s);
  if (u_mode == 11) return b + s - 2.0 * b * s;
  if (u_mode == 12) return setLum(setSat(s, sat(b)), lum(b));
  if (u_mode == 13) return setLum(setSat(b, sat(s)), lum(b));
  if (u_mode == 14) return setLum(s, lum(b));
  if (u_mode == 15) return setLum(b, lum(s));
  return s;
}
void main() {
  vec4 s = texture(u_src, v_uv) * u_opacity * (u_masked == 1 ? texture(u_mask, v_uv).a : 1.0);
  vec4 d = texture(u_dst, v_uv);
  vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
  vec3 cb = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
  vec3 rgb = s.rgb * (1.0 - d.a) + d.rgb * (1.0 - s.a) + s.a * d.a * clamp(mixed(cb, cs), 0.0, 1.0);
  outColor = vec4(rgb, s.a + d.a - s.a * d.a);
}`;

export const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export const BLUR_FS = `#version 300 es
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

export function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
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

export function texture(gl: WebGL2RenderingContext, width: number, height: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function plain(gl: WebGL2RenderingContext, width: number, height: number): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
  const tex = texture(gl, width, height);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { fbo, texture: tex };
}
