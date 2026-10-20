use std::rc::Rc;

use js_sys::Float32Array;
use web_sys::{WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlShader, WebGlTexture};

use crate::filter_passes::Op;
use crate::filters::Runner;

const VERTEX: &str = "#version 300 es
void main() {
  vec2 p = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 4.0 - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
}";

const HEADER: &str = "#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D a;
uniform highp sampler2D b;
uniform highp sampler2D params;
uniform ivec2 outSize;
out vec4 outColor;
float p(int i) { return texelFetch(params, ivec2(i / 4, 0), 0)[i % 4]; }
vec4 texel(highp sampler2D t, ivec2 xy) { return texelFetch(t, clamp(xy, ivec2(0), textureSize(t, 0) - 1), 0); }
vec4 bilinear(highp sampler2D t, vec2 q) {
  vec2 s = q - 0.5;
  vec2 i = floor(s);
  vec2 f = s - i;
  ivec2 x = ivec2(i);
  vec4 top = mix(texel(t, x), texel(t, x + ivec2(1, 0)), f.x);
  vec4 bottom = mix(texel(t, x + ivec2(0, 1)), texel(t, x + ivec2(1, 1)), f.x);
  return mix(top, bottom, f.y);
}
bool inside(vec2 q) { vec2 s = vec2(outSize); return q.x >= 0.0 && q.y >= 0.0 && q.x <= s.x && q.y <= s.y; }
vec4 straight(vec4 c) { return c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0); }
vec4 premul(vec4 c) { vec4 d = clamp(c, 0.0, 1.0); return vec4(d.rgb * d.a, d.a); }
vec2 centre(ivec2 xy) { return vec2(xy) + 0.5; }
";

const FOOTER: &str = "
void main() { outColor = clamp(run(ivec2(gl_FragCoord.xy)), 0.0, 1.0); }";

const MATRIX: &str = "
vec4 run(ivec2 xy) {
  vec4 c = straight(texel(a, xy));
  vec4 o = vec4(0.0);
  for (int r = 0; r < 4; r++) {
    o[r] = p(r * 5) * c.r + p(r * 5 + 1) * c.g + p(r * 5 + 2) * c.b + p(r * 5 + 3) * c.a + p(r * 5 + 4);
  }
  return premul(o);
}";

const TABLE: &str = "
float lookup(int ch, float c) {
  int kind = int(p(ch));
  if (kind == 2) { return p(8 + ch) * c + p(12 + ch); }
  if (kind != 1) { return c; }
  int n = int(p(4 + ch)) - 1;
  int base = 16 + ch * 32;
  if (n <= 0) { return p(base); }
  int k = clamp(int(floor(c * float(n))), 0, n - 1);
  float lo = p(base + k);
  float hi = p(base + k + 1);
  return lo + (c * float(n) - float(k)) * (hi - lo);
}
vec4 run(ivec2 xy) {
  vec4 c = straight(texel(a, xy));
  return premul(vec4(lookup(0, c.r), lookup(1, c.g), lookup(2, c.b), lookup(3, c.a)));
}";

const OFFSET: &str = "
vec4 run(ivec2 xy) {
  vec2 q = centre(xy) - vec2(p(0), p(1));
  vec4 c = inside(q) ? bilinear(a, q) : vec4(0.0);
  return p(2) > 0.5 ? vec4(0.0, 0.0, 0.0, c.a) : c;
}";

const FLOOD: &str = "
vec4 run(ivec2 xy) { return vec4(p(0) * p(3), p(1) * p(3), p(2) * p(3), p(3)); }";

const COMPOSITE: &str = "
vec4 run(ivec2 xy) {
  vec4 x = texel(a, xy);
  vec4 y = texel(b, xy);
  int op = int(p(0));
  if (op == 0) { return x + y * (1.0 - x.a); }
  if (op == 1) { return x * y.a; }
  if (op == 2) { return x * (1.0 - y.a); }
  if (op == 3) { return x * y.a + y * (1.0 - x.a); }
  if (op == 4) { return x * (1.0 - y.a) + y * (1.0 - x.a); }
  vec4 o = clamp(p(1) * x * y + p(2) * x + p(3) * y + vec4(p(4)), 0.0, 1.0);
  return vec4(min(o.rgb, vec3(o.a)), o.a);
}";

const MORPH: &str = "
vec4 run(ivec2 xy) {
  ivec2 dir = ivec2(int(p(0)), int(p(1)));
  vec4 o = texel(a, xy);
  int taps = int(p(2));
  for (int i = 1; i <= 64; i++) {
    if (i > taps) { break; }
    vec4 x = texel(a, xy + dir * i);
    vec4 y = texel(a, xy - dir * i);
    o = p(3) > 0.5 ? max(o, max(x, y)) : min(o, min(x, y));
  }
  return o;
}";

const LIGHT: &str = "
vec4 run(ivec2 xy) {
  vec3 pos = vec3(centre(xy), 0.0);
  vec3 l = normalize(vec3(p(0), p(1), p(2)) - pos);
  return vec4(clamp(p(6) * l.z * vec3(p(3), p(4), p(5)), 0.0, 1.0), 1.0);
}";

const TURBULENCE: &str = "
const float PERLIN = 4096.0;
const int LATTICE = 514;
vec4 cell(int i, int k) {
  int at = 16 + (k * LATTICE + i) * 4;
  return vec4(p(at), p(at + 1), p(at + 2), p(at + 3));
}
float noise2(int ch, vec2 v, bool stitching, vec2 size2, vec2 wrap) {
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
    if (float(bx0) >= wrap.x) { bx0 -= int(size2.x); }
    if (float(bx1) >= wrap.x) { bx1 -= int(size2.x); }
    if (float(by0) >= wrap.y) { by0 -= int(size2.y); }
    if (float(by1) >= wrap.y) { by1 -= int(size2.y); }
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
  float x = mix(u, w, sx);
  q = cell(b01, ch).xy; u = rx0 * q.x + ry1 * q.y;
  q = cell(b11, ch).xy; w = rx1 * q.x + ry1 * q.y;
  float y = mix(u, w, sx);
  return mix(x, y, sy);
}
float turbulence(int ch, vec2 at) {
  vec2 v = at * vec2(p(0), p(1));
  vec2 size2 = vec2(p(9), p(10));
  vec2 wrap = vec2(p(11), p(12));
  float sum = 0.0;
  float ratio = 1.0;
  int octaves = int(p(2));
  for (int o = 0; o < 10; o++) {
    if (o >= octaves) { break; }
    float n = noise2(ch, v, p(4) > 0.5, size2, wrap);
    sum += (p(3) > 0.5 ? n : abs(n)) / ratio;
    v *= 2.0;
    ratio *= 2.0;
    size2 *= 2.0;
    wrap = 2.0 * wrap - PERLIN;
  }
  return sum;
}
vec4 run(ivec2 xy) {
  vec2 c0 = centre(xy);
  if (c0.x < p(5) || c0.y < p(6) || c0.x >= p(5) + p(7) || c0.y >= p(6) + p(8)) { return vec4(0.0); }
  vec4 c = vec4(0.0);
  for (int ch = 0; ch < 4; ch++) {
    float t = turbulence(ch, c0 + 0.5);
    c[ch] = clamp(p(3) > 0.5 ? (t + 1.0) * 0.5 : t, 0.0, 1.0);
  }
  return vec4(c.rgb * c.a, c.a);
}";

const TILE: &str = "
vec4 run(ivec2 xy) {
  vec2 origin = vec2(p(0), p(1));
  vec2 span = vec2(p(2), p(3));
  vec2 d = centre(xy) - origin;
  return bilinear(a, origin + d - span * floor(d / span));
}";

const DISPLACE: &str = "
vec4 run(ivec2 xy) {
  vec4 m = straight(texel(b, xy));
  vec2 d = p(0) * (vec2(m[int(p(1))], m[int(p(2))]) - 0.5);
  vec2 q = centre(xy) + d;
  return inside(q) ? bilinear(a, q) : vec4(0.0);
}";

const BLUR: &str = "
vec4 run(ivec2 xy) {
  ivec2 dir = ivec2(int(p(0)), int(p(1)));
  int taps = int(p(2));
  vec4 sum = texel(a, xy) * p(3);
  for (int i = 1; i < 64; i++) {
    if (i >= taps) { break; }
    sum += (texel(a, xy + dir * i) + texel(a, xy - dir * i)) * p(3 + i);
  }
  return sum;
}";

const BLEND: &str = "
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clipColour(vec3 c) {
  float l = lum(c); float n = min(min(c.r, c.g), c.b); float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / max(l - n, 1e-6); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6); }
  return c;
}
vec3 setLum(vec3 c, float l) { return clipColour(c + (l - lum(c))); }
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
  int mode = int(p(0));
  if (mode == 1) return b * s;
  if (mode == 2) return b + s - b * s;
  if (mode == 3) return vec3(hard(s.r, b.r), hard(s.g, b.g), hard(s.b, b.b));
  if (mode == 4) return min(b, s);
  if (mode == 5) return max(b, s);
  if (mode == 6) return vec3(dodge(b.r, s.r), dodge(b.g, s.g), dodge(b.b, s.b));
  if (mode == 7) return vec3(burn(b.r, s.r), burn(b.g, s.g), burn(b.b, s.b));
  if (mode == 8) return vec3(hard(b.r, s.r), hard(b.g, s.g), hard(b.b, s.b));
  if (mode == 9) return vec3(soft(b.r, s.r), soft(b.g, s.g), soft(b.b, s.b));
  if (mode == 10) return abs(b - s);
  if (mode == 11) return b + s - 2.0 * b * s;
  if (mode == 12) return setLum(setSat(s, sat(b)), lum(b));
  if (mode == 13) return setLum(setSat(b, sat(s)), lum(b));
  if (mode == 14) return setLum(s, lum(b));
  if (mode == 15) return setLum(b, lum(s));
  return s;
}
vec4 run(ivec2 xy) {
  vec4 s = texel(a, xy);
  vec4 d = texel(b, xy);
  vec3 cs = s.a > 0.0 ? s.rgb / s.a : vec3(0.0);
  vec3 cb = d.a > 0.0 ? d.rgb / d.a : vec3(0.0);
  vec3 rgb = s.rgb * (1.0 - d.a) + d.rgb * (1.0 - s.a) + s.a * d.a * clamp(mixed(cb, cs), 0.0, 1.0);
  return vec4(rgb, s.a + d.a - s.a * d.a);
}";

const FOLD: &str = "
vec4 run(ivec2 xy) {
  vec4 c = texel(b, xy);
  float cov = p(3) > 0.5 ? dot(c.rgb, vec3(0.2125, 0.7154, 0.0721)) : c.a;
  float l = p(2) > 0.5 ? 1.0 - p(4) * cov : p(4) * cov;
  int mode = int(p(0));
  float seed = (mode == 1 || mode == 2) ? 1.0 : 0.0;
  float k = p(1) > 0.5 ? seed : texel(a, xy).a;
  float o = k + l - 2.0 * k * l;
  if (mode == 0) { o = k + l - k * l; }
  if (mode == 1) { o = k * (1.0 - l); }
  if (mode == 2) { o = k * l; }
  return vec4(o);
}";

const FLIP: &str = "
vec4 run(ivec2 xy) { return texelFetch(a, ivec2(xy.x, textureSize(a, 0).y - 1 - xy.y), 0); }";

const LENS: &str = "
const float FLAT = 0.55;
const float DEPTH = 0.55;
const float TAU = 6.2831853;
const vec3 KEY = vec3(-0.42, -0.58, 0.70);
const vec3 FILL = vec3(0.78, 0.18, 0.60);
const int FROST_TAPS = 12;

float ss(float e0, float e1, float x) { float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec2 middle() { return vec2(p(0), p(1)); }
vec3 dropAt(int i) { return vec3(p(2 + i * 3), p(3 + i * 3), p(4 + i * 3)); }
vec3 tint() { return vec3(p(28), p(29), p(30)); }

float smin(float x, float y, float k) {
  float h = max(k - abs(x - y), 0.0) / k;
  return min(x, y) - h * h * k * 0.25;
}

float ripple(vec3 q) {
  float t = p(20) * p(19) * TAU;
  float s = p(21);
  return sin(q.x * 2.3 + t + s) * sin(q.y * 1.9 - t * 0.83 + s * 1.37)
    + 0.55 * sin((q.x - q.y) * 3.1 + t * 1.61 + s * 2.11)
    + 0.3 * sin(q.z * 4.0 + q.x * 2.7 - t * 2.27 + s * 0.71);
}

float field(vec3 at) {
  vec2 c0 = middle();
  vec2 rel = at.xy - c0;
  vec2 q = c0 + vec2(p(14) * rel.x + p(15) * rel.y, p(15) * rel.x + p(16) * rel.y);
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    vec3 c = dropAt(i);
    if (c.z < 0.5) { continue; }
    d = smin(d, length(vec3(q - c.xy, at.z / FLAT)) - c.z, p(17));
  }
  return d + p(18) * ripple(vec3(q - c0, at.z) / dropAt(0).z);
}

float flatField(vec2 at) { return field(vec3(at, 0.0)); }

vec3 sampled(vec2 q) { return straight(bilinear(a, q)).rgb; }

vec3 content(vec2 q) {
  if (p(24) < 0.5) { return sampled(q); }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < FROST_TAPS; i++) {
    float turn = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / float(FROST_TAPS)) * p(24);
    sum += sampled(q + vec2(cos(turn), sin(turn)) * r);
  }
  return sum / float(FROST_TAPS);
}

vec3 env(vec3 r) {
  vec3 c = mix(vec3(0.025, 0.03, 0.04), vec3(0.15, 0.16, 0.19), ss(-0.1, 0.9, r.z));
  c += vec3(1.0) * ss(0.90, 0.985, dot(r, normalize(KEY))) * 1.7;
  c += vec3(0.75, 0.85, 1.0) * ss(0.955, 0.995, dot(r, normalize(FILL))) * 0.9;
  c += vec3(0.55) * pow(max(1.0 - abs(r.z), 0.0), 10.0) * 0.3;
  return c;
}

vec2 bent(vec2 at, vec3 n, float zs, float eta, float depth) {
  vec3 inner = refract(vec3(0.0, 0.0, -1.0), n, eta);
  vec2 off = inner.xy * zs / max(-inner.z, 0.12);
  vec3 leaving = refract(inner, vec3(0.0, 0.0, 1.0), 1.0 / eta);
  if (dot(leaving, leaving) < 1e-4) { return vec2(1e5); }
  return at + off + leaving.xy * depth / max(-leaving.z, 0.12);
}

vec3 seenAt(vec2 at, vec3 n) {
  if (at.x > 9e4) { return env(reflect(vec3(0.0, 0.0, -1.0), n)) * 0.35; }
  return content(at);
}

vec4 under(vec2 at, float r0) {
  vec2 o = vec2(0.10, 0.22) * r0;
  float fs = flatField(at - o);
  float shade = 0.7 * (1.0 - ss(-0.35 * r0, 0.5 * r0, fs));
  float focus = ss(0.0, -0.4 * r0, flatField(at - o * 1.35) + 0.42 * r0);
  vec3 light = mix(vec3(1.0), tint(), 0.5) * focus * 0.55;
  return vec4(light, shade);
}

float grain(vec2 at) { return fract(sin(dot(floor(at), vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

bool boxed(vec2 at) {
  vec2 lo = vec2(max(floor(p(31)), 0.0), max(floor(p(32)), 0.0));
  vec2 hi = vec2(ceil(p(31) + p(33)), ceil(p(32) + p(34)));
  return at.x >= lo.x && at.y >= lo.y && at.x < hi.x && at.y < hi.y;
}

vec4 run(ivec2 xy) {
  vec2 at = centre(xy);
  float presence = p(27);
  if (presence <= 0.0 || !boxed(at)) { return vec4(0.0); }
  float r0 = dropAt(0).z;
  float f0 = flatField(at);
  vec4 below = under(at, r0);
  if (f0 > 1.0) { return below * presence; }
  float lo = 0.0;
  float hi = r0 * FLAT * 2.2 + p(18) * 2.0;
  for (int i = 0; i < 16; i++) {
    float mid = 0.5 * (lo + hi);
    if (field(vec3(at, mid)) < 0.0) { lo = mid; } else { hi = mid; }
  }
  vec3 s = vec3(at, lo);
  vec3 e = vec3(1.0, 0.0, 0.0);
  vec3 n = normalize(vec3(field(s + e.xyy) - field(s - e.xyy), field(s + e.yxy) - field(s - e.yxy), field(s + e.yyx) - field(s - e.yyx)));
  float depth = DEPTH * r0;
  float ior = p(22);
  float disp = p(23);
  vec3 seen = vec3(
    seenAt(bent(at, n, lo, 1.0 / max(ior - disp, 1.0001), depth), n).r,
    seenAt(bent(at, n, lo, 1.0 / ior, depth), n).g,
    seenAt(bent(at, n, lo, 1.0 / (ior + disp), depth), n).b
  );
  vec3 tinted = tint();
  float amount = p(26);
  seen = mix(seen, seen * tinted, amount) + tinted * amount * 0.05;
  float f0r = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float fresnel = f0r + (1.0 - f0r) * pow(1.0 - max(n.z, 0.0), 5.0);
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 key = normalize(KEY);
  vec3 fill = normalize(FILL);
  float refl = p(25);
  float spec = pow(max(dot(n, normalize(key + view)), 0.0), 900.0) * 3.2 + pow(max(dot(n, normalize(key + view)), 0.0), 70.0) * 0.12 + pow(max(dot(n, normalize(fill + view)), 0.0), 500.0) * 1.1;
  vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
  float edge = ss(2.6, 0.0, -f0);
  float rim = edge * 1.2 * (0.3 + 0.7 * max(dot(side, normalize(key.xy)), 0.0));
  float glow = ss(0.38 * r0, 0.0, -f0) * max(dot(side, -normalize(key.xy)), 0.0) * 0.22;
  vec3 glass = seen * (1.0 - fresnel * refl) + env(reflect(-view, n)) * fresnel * refl + (spec + rim) * refl + mix(vec3(1.0), tinted, 0.6) * glow + grain(at) * 0.03;
  float cover = clamp(0.5 - f0, 0.0, 1.0);
  return (vec4(glass, 1.0) * cover + below * (1.0 - cover)) * presence;
}";

const SOURCES: [(Op, &str); 14] = [
    (Op::Matrix, MATRIX),
    (Op::Table, TABLE),
    (Op::Offset, OFFSET),
    (Op::Flood, FLOOD),
    (Op::Composite, COMPOSITE),
    (Op::Morph, MORPH),
    (Op::Light, LIGHT),
    (Op::Turbulence, TURBULENCE),
    (Op::Tile, TILE),
    (Op::Displace, DISPLACE),
    (Op::Blur, BLUR),
    (Op::Blend, BLEND),
    (Op::Fold, FOLD),
    (Op::Lens, LENS),
];

pub struct GlTex {
    gl: Gl,
    pub texture: WebGlTexture,
    pub width: u32,
    pub height: u32,
}

impl Drop for GlTex {
    fn drop(&mut self) {
        self.gl.delete_texture(Some(&self.texture));
    }
}

pub type Tex = Rc<GlTex>;

pub struct GlRunner {
    gl: Gl,
    programs: Vec<(Op, WebGlProgram)>,
    flip: WebGlProgram,
    fbo: WebGlFramebuffer,
}

fn shader(gl: &Gl, kind: u32, source: &str) -> WebGlShader {
    let s = gl.create_shader(kind).expect("a shader");
    gl.shader_source(&s, source);
    gl.compile_shader(&s);
    s
}

fn program(gl: &Gl, body: &str) -> WebGlProgram {
    let p = gl.create_program().expect("a program");
    gl.attach_shader(&p, &shader(gl, Gl::VERTEX_SHADER, VERTEX));
    gl.attach_shader(&p, &shader(gl, Gl::FRAGMENT_SHADER, &format!("{HEADER}{body}{FOOTER}")));
    gl.link_program(&p);
    p
}

pub fn texture(gl: &Gl, width: u32, height: u32) -> Tex {
    let texture = gl.create_texture().expect("a texture");
    gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
    gl.tex_storage_2d(Gl::TEXTURE_2D, 1, Gl::RGBA8, width as i32, height as i32);
    for (k, v) in [(Gl::TEXTURE_MIN_FILTER, Gl::NEAREST), (Gl::TEXTURE_MAG_FILTER, Gl::NEAREST), (Gl::TEXTURE_WRAP_S, Gl::CLAMP_TO_EDGE), (Gl::TEXTURE_WRAP_T, Gl::CLAMP_TO_EDGE)] {
        gl.tex_parameteri(Gl::TEXTURE_2D, k, v as i32);
    }
    Rc::new(GlTex { gl: gl.clone(), texture, width, height })
}

impl GlRunner {
    pub fn new(gl: &Gl) -> Self {
        let programs = SOURCES.iter().map(|(op, body)| (*op, program(gl, body))).collect();
        GlRunner { gl: gl.clone(), programs, flip: program(gl, FLIP), fbo: gl.create_framebuffer().expect("a framebuffer") }
    }

    fn params(&self, values: &[f32]) -> WebGlTexture {
        let gl = &self.gl;
        let mut padded = values.to_vec();
        padded.resize(values.len().div_ceil(4).max(1) * 4, 0.0);
        let texture = gl.create_texture().expect("a texture");
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, Gl::NEAREST as i32);
        gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::NEAREST as i32);
        let view = Float32Array::from(padded.as_slice());
        let _ = gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_array_buffer_view(Gl::TEXTURE_2D, 0, Gl::RGBA32F as i32, (padded.len() / 4) as i32, 1, 0, Gl::RGBA, Gl::FLOAT, Some(&view));
        texture
    }

    fn pass(&self, program: &WebGlProgram, inputs: [&Tex; 2], values: &[f32]) -> Tex {
        let gl = &self.gl;
        let [a, b] = inputs;
        let out = texture(gl, a.width, a.height);
        let params = self.params(values);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&self.fbo));
        gl.framebuffer_texture_2d(Gl::FRAMEBUFFER, Gl::COLOR_ATTACHMENT0, Gl::TEXTURE_2D, Some(&out.texture), 0);
        gl.viewport(0, 0, out.width as i32, out.height as i32);
        for cap in [Gl::BLEND, Gl::SCISSOR_TEST, Gl::DEPTH_TEST, Gl::STENCIL_TEST] {
            gl.disable(cap);
        }
        gl.color_mask(true, true, true, true);
        gl.bind_vertex_array(None);
        gl.use_program(Some(program));
        for (unit, (name, tex)) in [("a", &a.texture), ("b", &b.texture), ("params", &params)].into_iter().enumerate() {
            gl.active_texture(Gl::TEXTURE0 + unit as u32);
            gl.bind_texture(Gl::TEXTURE_2D, Some(tex));
            gl.uniform1i(gl.get_uniform_location(program, name).as_ref(), unit as i32);
        }
        gl.uniform2i(gl.get_uniform_location(program, "outSize").as_ref(), out.width as i32, out.height as i32);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.active_texture(Gl::TEXTURE0);
        gl.delete_texture(Some(&params));
        out
    }

    pub fn flipped(&self, tex: &Tex) -> Tex {
        self.pass(&self.flip, [tex, tex], &[])
    }
}

impl Runner for GlRunner {
    type Tex = Tex;

    fn run(&self, op: Op, inputs: [&Tex; 2], params: &[f32]) -> Tex {
        let program = &self.programs.iter().find(|(o, _)| *o == op).expect("every op has a program").1;
        self.pass(program, inputs, params)
    }

    fn size(tex: &Tex) -> (u32, u32) {
        (tex.width, tex.height)
    }
}
