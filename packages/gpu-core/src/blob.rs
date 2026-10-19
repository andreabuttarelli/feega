use vello::kurbo::Affine;

use crate::display_list::BlobItem;

pub const ROW_LENGTH: usize = 33;

pub fn params(blob: &BlobItem) -> Vec<f32> {
    let mut row = blob.row.clone();
    row.resize(ROW_LENGTH, 0.0);
    let inverse = Affine::new(blob.look.matrix).inverse().as_coeffs();
    row.extend([blob.time, blob.seed]);
    row.extend(blob.look.matrix.iter().chain(inverse.iter()).map(|v| *v as f32));
    row
}

pub const WGSL: &str = r#"
const FLAT = 0.55;
const DEPTH = 0.55;
const TAU = 6.2831853;
const KEY = vec3<f32>(-0.42, -0.58, 0.70);
const FILL = vec3<f32>(0.78, 0.18, 0.60);
const FROST_TAPS = 12;
const TIME = 33u;
const SEED = 34u;
const FORWARD = 35u;
const BACKWARD = 41u;

fn smin(x: f32, y: f32, k: f32) -> f32 {
  let h = max(k - abs(x - y), 0.0) / k;
  return min(x, y) - h * h * k * 0.25;
}

fn ripple(q: vec3<f32>) -> f32 {
  let t = p[TIME] * p[28] * TAU;
  let s = p[SEED];
  return sin(q.x * 2.3 + t + s) * sin(q.y * 1.9 - t * 0.83 + s * 1.37)
    + 0.55 * sin((q.x - q.y) * 3.1 + t * 1.61 + s * 2.11)
    + 0.3 * sin(q.z * 4.0 + q.x * 2.7 - t * 2.27 + s * 0.71);
}

fn field(at: vec3<f32>) -> f32 {
  let centre = vec2<f32>(p[0], p[1]);
  let rel = at.xy - centre;
  let q = centre + vec2<f32>(p[16] * rel.x + p[17] * rel.y, p[17] * rel.x + p[18] * rel.y);
  var d = 1e5;
  for (var i = 0u; i < 4u; i++) {
    let c = vec3<f32>(p[4u + i * 3u], p[5u + i * 3u], p[6u + i * 3u]);
    if (c.z < 0.5) { continue; }
    d = smin(d, length(vec3<f32>(q - c.xy, at.z / FLAT)) - c.z, p[2]);
  }
  return d + p[3] * ripple(vec3<f32>(q - centre, at.z) / p[6]);
}

fn flat_field(at: vec2<f32>) -> f32 { return field(vec3<f32>(at, 0.0)); }

fn through(base: u32, q: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(p[base] * q.x + p[base + 2u] * q.y + p[base + 4u], p[base + 1u] * q.x + p[base + 3u] * q.y + p[base + 5u]);
}

fn sample(q: vec2<f32>) -> vec3<f32> { return bilinear(a, through(FORWARD, q)).rgb; }

fn content(q: vec2<f32>) -> vec3<f32> {
  let frost = p[21];
  if (frost < 0.5) { return sample(q); }
  var sum = vec3<f32>(0.0);
  for (var i = 0; i < FROST_TAPS; i++) {
    let angle = f32(i) * 2.39996;
    let r = sqrt((f32(i) + 0.5) / f32(FROST_TAPS)) * frost;
    sum += sample(q + vec2<f32>(cos(angle), sin(angle)) * r);
  }
  return sum / f32(FROST_TAPS);
}

fn env(r: vec3<f32>) -> vec3<f32> {
  var c = mix(vec3<f32>(0.025, 0.03, 0.04), vec3<f32>(0.15, 0.16, 0.19), smoothstep(-0.1, 0.9, r.z));
  c += vec3<f32>(1.0) * smoothstep(0.90, 0.985, dot(r, normalize(KEY))) * 1.7;
  c += vec3<f32>(0.75, 0.85, 1.0) * smoothstep(0.955, 0.995, dot(r, normalize(FILL))) * 0.9;
  c += vec3<f32>(0.55) * pow(max(1.0 - abs(r.z), 0.0), 10.0) * 0.3;
  return c;
}

fn bent(at: vec2<f32>, n: vec3<f32>, zs: f32, eta: f32, depth: f32) -> vec2<f32> {
  let inner = refract(vec3<f32>(0.0, 0.0, -1.0), n, eta);
  let off = inner.xy * zs / max(-inner.z, 0.12);
  let leaving = refract(inner, vec3<f32>(0.0, 0.0, 1.0), 1.0 / eta);
  if (dot(leaving, leaving) < 1e-4) { return vec2<f32>(1e5); }
  return at + off + leaving.xy * depth / max(-leaving.z, 0.12);
}

fn look(at: vec2<f32>, n: vec3<f32>) -> vec3<f32> {
  if (at.x > 9e4) { return env(reflect(vec3<f32>(0.0, 0.0, -1.0), n)) * 0.35; }
  return content(at);
}

fn tint() -> vec3<f32> { return vec3<f32>(p[25], p[26], p[27]); }

fn under(at: vec2<f32>, r0: f32) -> vec4<f32> {
  let o = vec2<f32>(0.10, 0.22) * r0;
  let fs = flat_field(at - o);
  let shade = 0.7 * (1.0 - smoothstep(-0.35 * r0, 0.5 * r0, fs));
  let focus = smoothstep(0.0, -0.4 * r0, flat_field(at - o * 1.35) + 0.42 * r0);
  return vec4<f32>(mix(vec3<f32>(1.0), tint(), 0.5) * focus * 0.55, shade);
}

fn grain(at: vec2<f32>) -> f32 {
  return fract(sin(dot(floor(at), vec2<f32>(12.9898, 78.233))) * 43758.5453) - 0.5;
}

fn run(xy: vec2<i32>) -> vec4<f32> {
  let at = through(BACKWARD, centre(xy));
  if (at.x < p[29] || at.y < p[30] || at.x > p[29] + p[31] || at.y > p[30] + p[32]) { return vec4<f32>(0.0); }
  let presence = p[24];
  let r0 = p[6];
  let f0 = flat_field(at);
  let below = under(at, r0);
  if (f0 > 1.0) { return below * presence; }
  var lo = 0.0;
  var hi = r0 * FLAT * 2.2 + p[3] * 2.0;
  for (var i = 0; i < 16; i++) {
    let mid = 0.5 * (lo + hi);
    if (field(vec3<f32>(at, mid)) < 0.0) { lo = mid; } else { hi = mid; }
  }
  let s = vec3<f32>(at, lo);
  let e = vec3<f32>(1.0, 0.0, 0.0);
  let n = normalize(vec3<f32>(field(s + e.xyy) - field(s - e.xyy), field(s + e.yxy) - field(s - e.yxy), field(s + e.yyx) - field(s - e.yyx)));
  let depth = DEPTH * r0;
  let ior = p[19];
  let disp = p[20];
  var seen = vec3<f32>(
    look(bent(at, n, lo, 1.0 / max(ior - disp, 1.0001), depth), n).r,
    look(bent(at, n, lo, 1.0 / ior, depth), n).g,
    look(bent(at, n, lo, 1.0 / (ior + disp), depth), n).b
  );
  let amount = p[23];
  seen = mix(seen, seen * tint(), amount) + tint() * amount * 0.05;
  let f0r = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fresnel = f0r + (1.0 - f0r) * pow(1.0 - max(n.z, 0.0), 5.0);
  let view = vec3<f32>(0.0, 0.0, 1.0);
  let key = normalize(KEY);
  let fill = normalize(FILL);
  let spec = pow(max(dot(n, normalize(key + view)), 0.0), 900.0) * 3.2 + pow(max(dot(n, normalize(key + view)), 0.0), 70.0) * 0.12 + pow(max(dot(n, normalize(fill + view)), 0.0), 500.0) * 1.1;
  let side = select(vec2<f32>(0.0), normalize(n.xy), length(n.xy) > 1e-4);
  let edge = smoothstep(2.6, 0.0, -f0);
  let rim = edge * 1.2 * (0.3 + 0.7 * max(dot(side, normalize(key.xy)), 0.0));
  let glow = smoothstep(0.38 * r0, 0.0, -f0) * max(dot(side, -normalize(key.xy)), 0.0) * 0.22;
  let refl = p[22];
  let glass = seen * (1.0 - fresnel * refl) + env(reflect(-view, n)) * fresnel * refl + (spec + rim) * refl + mix(vec3<f32>(1.0), tint(), 0.6) * glow + grain(at) * 0.03;
  let cover = clamp(0.5 - f0, 0.0, 1.0);
  return (vec4<f32>(glass, 1.0) * cover + below * (1.0 - cover)) * presence;
}
"#;

pub const GLSL: &str = "
const float FLAT = 0.55;
const float DEPTH = 0.55;
const float TAU = 6.2831853;
const vec3 KEY = vec3(-0.42, -0.58, 0.70);
const vec3 FILL = vec3(0.78, 0.18, 0.60);
const int FROST_TAPS = 12;
const int TIME = 33;
const int SEED = 34;
const int FORWARD = 35;
const int BACKWARD = 41;

float smin(float x, float y, float k) {
  float h = max(k - abs(x - y), 0.0) / k;
  return min(x, y) - h * h * k * 0.25;
}

float ripple(vec3 q) {
  float t = p(TIME) * p(28) * TAU;
  float s = p(SEED);
  return sin(q.x * 2.3 + t + s) * sin(q.y * 1.9 - t * 0.83 + s * 1.37)
    + 0.55 * sin((q.x - q.y) * 3.1 + t * 1.61 + s * 2.11)
    + 0.3 * sin(q.z * 4.0 + q.x * 2.7 - t * 2.27 + s * 0.71);
}

float field(vec3 at) {
  vec2 centre = vec2(p(0), p(1));
  vec2 rel = at.xy - centre;
  vec2 q = centre + vec2(p(16) * rel.x + p(17) * rel.y, p(17) * rel.x + p(18) * rel.y);
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    vec3 c = vec3(p(4 + i * 3), p(5 + i * 3), p(6 + i * 3));
    if (c.z < 0.5) { continue; }
    d = smin(d, length(vec3(q - c.xy, at.z / FLAT)) - c.z, p(2));
  }
  return d + p(3) * ripple(vec3(q - centre, at.z) / p(6));
}

float flatField(vec2 at) { return field(vec3(at, 0.0)); }

vec2 through(int base, vec2 q) {
  return vec2(p(base) * q.x + p(base + 2) * q.y + p(base + 4), p(base + 1) * q.x + p(base + 3) * q.y + p(base + 5));
}

vec3 sampled(vec2 q) { return bilinear(a, through(FORWARD, q)).rgb; }

vec3 content(vec2 q) {
  float frost = p(21);
  if (frost < 0.5) { return sampled(q); }
  vec3 sum = vec3(0.0);
  for (int i = 0; i < FROST_TAPS; i++) {
    float angle = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / float(FROST_TAPS)) * frost;
    sum += sampled(q + vec2(cos(angle), sin(angle)) * r);
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

vec2 bent(vec2 at, vec3 n, float zs, float eta, float depth) {
  vec3 inner = refract(vec3(0.0, 0.0, -1.0), n, eta);
  vec2 off = inner.xy * zs / max(-inner.z, 0.12);
  vec3 leaving = refract(inner, vec3(0.0, 0.0, 1.0), 1.0 / eta);
  if (dot(leaving, leaving) < 1e-4) { return vec2(1e5); }
  return at + off + leaving.xy * depth / max(-leaving.z, 0.12);
}

vec3 look(vec2 at, vec3 n) {
  if (at.x > 9e4) { return env(reflect(vec3(0.0, 0.0, -1.0), n)) * 0.35; }
  return content(at);
}

vec3 tint() { return vec3(p(25), p(26), p(27)); }

vec4 under(vec2 at, float r0) {
  vec2 o = vec2(0.10, 0.22) * r0;
  float fs = flatField(at - o);
  float shade = 0.7 * (1.0 - smoothstep(-0.35 * r0, 0.5 * r0, fs));
  float focus = smoothstep(0.0, -0.4 * r0, flatField(at - o * 1.35) + 0.42 * r0);
  return vec4(mix(vec3(1.0), tint(), 0.5) * focus * 0.55, shade);
}

float grain(vec2 at) {
  return fract(sin(dot(floor(at), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
}

vec4 run(ivec2 xy) {
  vec2 at = through(BACKWARD, centre(xy));
  if (at.x < p(29) || at.y < p(30) || at.x > p(29) + p(31) || at.y > p(30) + p(32)) { return vec4(0.0); }
  float presence = p(24);
  float r0 = p(6);
  float f0 = flatField(at);
  vec4 below = under(at, r0);
  if (f0 > 1.0) { return below * presence; }
  float lo = 0.0;
  float hi = r0 * FLAT * 2.2 + p(3) * 2.0;
  for (int i = 0; i < 16; i++) {
    float mid = 0.5 * (lo + hi);
    if (field(vec3(at, mid)) < 0.0) { lo = mid; } else { hi = mid; }
  }
  vec3 s = vec3(at, lo);
  vec3 e = vec3(1.0, 0.0, 0.0);
  vec3 n = normalize(vec3(field(s + e.xyy) - field(s - e.xyy), field(s + e.yxy) - field(s - e.yxy), field(s + e.yyx) - field(s - e.yyx)));
  float depth = DEPTH * r0;
  float ior = p(19);
  float disp = p(20);
  vec3 seen = vec3(
    look(bent(at, n, lo, 1.0 / max(ior - disp, 1.0001), depth), n).r,
    look(bent(at, n, lo, 1.0 / ior, depth), n).g,
    look(bent(at, n, lo, 1.0 / (ior + disp), depth), n).b
  );
  float amount = p(23);
  seen = mix(seen, seen * tint(), amount) + tint() * amount * 0.05;
  float f0r = pow((ior - 1.0) / (ior + 1.0), 2.0);
  float fresnel = f0r + (1.0 - f0r) * pow(1.0 - max(n.z, 0.0), 5.0);
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 key = normalize(KEY);
  vec3 fill = normalize(FILL);
  float spec = pow(max(dot(n, normalize(key + view)), 0.0), 900.0) * 3.2 + pow(max(dot(n, normalize(key + view)), 0.0), 70.0) * 0.12 + pow(max(dot(n, normalize(fill + view)), 0.0), 500.0) * 1.1;
  vec2 side = length(n.xy) > 1e-4 ? normalize(n.xy) : vec2(0.0);
  float edge = smoothstep(2.6, 0.0, -f0);
  float rim = edge * 1.2 * (0.3 + 0.7 * max(dot(side, normalize(key.xy)), 0.0));
  float glow = smoothstep(0.38 * r0, 0.0, -f0) * max(dot(side, -normalize(key.xy)), 0.0) * 0.22;
  float refl = p(22);
  vec3 glass = seen * (1.0 - fresnel * refl) + env(reflect(-view, n)) * fresnel * refl + (spec + rim) * refl + mix(vec3(1.0), tint(), 0.6) * glow + grain(at) * 0.03;
  float cover = clamp(0.5 - f0, 0.0, 1.0);
  return (vec4(glass, 1.0) * cover + below * (1.0 - cover)) * presence;
}
";
