use vello::wgpu;
use vello::wgpu::util::DeviceExt;

use crate::passes::layer_texture;

const GROUP: u32 = 8;

const HEADER: &str = r#"
@group(0) @binding(0) var a: texture_2d<f32>;
@group(0) @binding(1) var b: texture_2d<f32>;
@group(0) @binding(2) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<storage, read> p: array<f32>;

fn size() -> vec2<i32> { return vec2<i32>(textureDimensions(dst)); }
fn texel(t: texture_2d<f32>, xy: vec2<i32>) -> vec4<f32> {
  let c = textureLoad(t, clamp(xy, vec2<i32>(0), vec2<i32>(textureDimensions(t)) - 1), 0);
  return vec4<f32>(c.rgb * c.a, c.a);
}
fn bilinear(t: texture_2d<f32>, q: vec2<f32>) -> vec4<f32> {
  let s = q - 0.5;
  let i = floor(s);
  let f = s - i;
  let x = vec2<i32>(i);
  let top = mix(texel(t, x), texel(t, x + vec2<i32>(1, 0)), f.x);
  let bottom = mix(texel(t, x + vec2<i32>(0, 1)), texel(t, x + vec2<i32>(1, 1)), f.x);
  return mix(top, bottom, f.y);
}
fn inside(q: vec2<f32>) -> bool {
  let s = vec2<f32>(size());
  return q.x >= 0.0 && q.y >= 0.0 && q.x <= s.x && q.y <= s.y;
}
fn straight(c: vec4<f32>) -> vec4<f32> { return select(vec4<f32>(0.0), vec4<f32>(c.rgb / c.a, c.a), c.a > 0.0); }
fn premul(c: vec4<f32>) -> vec4<f32> { let d = clamp(c, vec4<f32>(0.0), vec4<f32>(1.0)); return vec4<f32>(d.rgb * d.a, d.a); }
fn centre(xy: vec2<i32>) -> vec2<f32> { return vec2<f32>(xy) + 0.5; }
"#;

const FOOTER: &str = r#"
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let xy = vec2<i32>(id.xy);
  if (xy.x >= size().x || xy.y >= size().y) { return; }
  let c = clamp(run(xy), vec4<f32>(0.0), vec4<f32>(1.0));
  textureStore(dst, xy, vec4<f32>(select(vec3<f32>(0.0), c.rgb / c.a, c.a > 0.0), c.a));
}
"#;

const MATRIX: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let c = straight(texel(a, xy));
  var o = vec4<f32>(0.0);
  for (var r = 0u; r < 4u; r++) {
    o[r] = p[r * 5u] * c.r + p[r * 5u + 1u] * c.g + p[r * 5u + 2u] * c.b + p[r * 5u + 3u] * c.a + p[r * 5u + 4u];
  }
  return premul(o);
}
"#;

const TABLE: &str = r#"
fn lookup(ch: u32, c: f32) -> f32 {
  let kind = u32(p[ch]);
  if (kind == 2u) { return p[8u + ch] * c + p[12u + ch]; }
  if (kind != 1u) { return c; }
  let n = i32(p[4u + ch]) - 1;
  let base = 16u + ch * 32u;
  if (n <= 0) { return p[base]; }
  let k = clamp(i32(floor(c * f32(n))), 0, n - 1);
  let lo = p[base + u32(k)];
  let hi = p[base + u32(k) + 1u];
  return lo + (c * f32(n) - f32(k)) * (hi - lo);
}
fn run(xy: vec2<i32>) -> vec4<f32> {
  let c = straight(texel(a, xy));
  return premul(vec4<f32>(lookup(0u, c.r), lookup(1u, c.g), lookup(2u, c.b), lookup(3u, c.a)));
}
"#;

const OFFSET: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let q = centre(xy) - vec2<f32>(p[0], p[1]);
  let c = select(vec4<f32>(0.0), bilinear(a, q), inside(q));
  return select(c, vec4<f32>(0.0, 0.0, 0.0, c.a), p[2] > 0.5);
}
"#;

const FLOOD: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> { return vec4<f32>(p[0] * p[3], p[1] * p[3], p[2] * p[3], p[3]); }
"#;

const COMPOSITE: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let x = texel(a, xy);
  let y = texel(b, xy);
  let op = u32(p[0]);
  if (op == 0u) { return x + y * (1.0 - x.a); }
  if (op == 1u) { return x * y.a; }
  if (op == 2u) { return x * (1.0 - y.a); }
  if (op == 3u) { return x * y.a + y * (1.0 - x.a); }
  if (op == 4u) { return x * (1.0 - y.a) + y * (1.0 - x.a); }
  var o = clamp(p[1] * x * y + p[2] * x + p[3] * y + vec4<f32>(p[4]), vec4<f32>(0.0), vec4<f32>(1.0));
  return vec4<f32>(min(o.rgb, vec3<f32>(o.a)), o.a);
}
"#;

const MORPH: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let dir = vec2<i32>(i32(p[0]), i32(p[1]));
  var o = texel(a, xy);
  for (var i = 1; i <= i32(p[2]); i++) {
    let x = texel(a, xy + dir * i);
    let y = texel(a, xy - dir * i);
    o = select(min(o, min(x, y)), max(o, max(x, y)), p[3] > 0.5);
  }
  return o;
}
"#;

const LIGHT: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let pos = vec3<f32>(centre(xy), 0.0);
  let l = normalize(vec3<f32>(p[0], p[1], p[2]) - pos);
  return vec4<f32>(clamp(p[6] * l.z * vec3<f32>(p[3], p[4], p[5]), vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
"#;

const TURBULENCE: &str = r#"
const PERLIN = 4096.0;
const LATTICE = 514u;
fn cell(i: i32, k: i32) -> vec4<f32> {
  let at = 16u + (u32(k) * LATTICE + u32(i)) * 4u;
  return vec4<f32>(p[at], p[at + 1u], p[at + 2u], p[at + 3u]);
}
fn noise2(ch: i32, v: vec2<f32>, stitching: bool, size2: vec2<f32>, wrap: vec2<f32>) -> f32 {
  var t = v.x + PERLIN;
  var bx0 = i32(t);
  var bx1 = bx0 + 1;
  let rx0 = t - floor(t);
  let rx1 = rx0 - 1.0;
  t = v.y + PERLIN;
  var by0 = i32(t);
  var by1 = by0 + 1;
  let ry0 = t - floor(t);
  let ry1 = ry0 - 1.0;
  if (stitching) {
    if (f32(bx0) >= wrap.x) { bx0 -= i32(size2.x); }
    if (f32(bx1) >= wrap.x) { bx1 -= i32(size2.x); }
    if (f32(by0) >= wrap.y) { by0 -= i32(size2.y); }
    if (f32(by1) >= wrap.y) { by1 -= i32(size2.y); }
  }
  bx0 &= 255; bx1 &= 255; by0 &= 255; by1 &= 255;
  let i = i32(cell(bx0, 0).z);
  let j = i32(cell(bx1, 0).z);
  let b00 = i32(cell(i + by0, 0).z);
  let b10 = i32(cell(j + by0, 0).z);
  let b01 = i32(cell(i + by1, 0).z);
  let b11 = i32(cell(j + by1, 0).z);
  let sx = rx0 * rx0 * (3.0 - 2.0 * rx0);
  let sy = ry0 * ry0 * (3.0 - 2.0 * ry0);
  var q = cell(b00, ch).xy; var u = rx0 * q.x + ry0 * q.y;
  q = cell(b10, ch).xy; var w = rx1 * q.x + ry0 * q.y;
  let x = mix(u, w, sx);
  q = cell(b01, ch).xy; u = rx0 * q.x + ry1 * q.y;
  q = cell(b11, ch).xy; w = rx1 * q.x + ry1 * q.y;
  let y = mix(u, w, sx);
  return mix(x, y, sy);
}
fn turbulence(ch: i32, at: vec2<f32>) -> f32 {
  var v = at * vec2<f32>(p[0], p[1]);
  var size2 = vec2<f32>(p[9], p[10]);
  var wrap = vec2<f32>(p[11], p[12]);
  var sum = 0.0;
  var ratio = 1.0;
  for (var o = 0; o < 10; o++) {
    if (o >= i32(p[2])) { break; }
    let n = noise2(ch, v, p[4] > 0.5, size2, wrap);
    sum += select(abs(n), n, p[3] > 0.5) / ratio;
    v *= 2.0;
    ratio *= 2.0;
    size2 *= 2.0;
    wrap = 2.0 * wrap - PERLIN;
  }
  return sum;
}
fn run(xy: vec2<i32>) -> vec4<f32> {
  let cell = centre(xy);
  if (cell.x < p[5] || cell.y < p[6] || cell.x >= p[5] + p[7] || cell.y >= p[6] + p[8]) { return vec4<f32>(0.0); }
  var c = vec4<f32>(0.0);
  for (var ch = 0; ch < 4; ch++) {
    let t = turbulence(ch, cell + 0.5);
    c[ch] = clamp(select(t, (t + 1.0) * 0.5, p[3] > 0.5), 0.0, 1.0);
  }
  return vec4<f32>(c.rgb * c.a, c.a);
}
"#;

const TILE: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let origin = vec2<f32>(p[0], p[1]);
  let span = vec2<f32>(p[2], p[3]);
  let d = centre(xy) - origin;
  return bilinear(a, origin + d - span * floor(d / span));
}
"#;

const DISPLACE: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  var m = straight(texel(b, xy));
  let d = p[0] * (vec2<f32>(m[u32(p[1])], m[u32(p[2])]) - 0.5);
  let q = centre(xy) + d;
  return select(vec4<f32>(0.0), bilinear(a, q), inside(q));
}
"#;

const BLUR: &str = r#"
fn run(xy: vec2<i32>) -> vec4<f32> {
  let dir = vec2<i32>(i32(p[0]), i32(p[1]));
  var sum = texel(a, xy) * p[3];
  for (var i = 1; i < i32(p[2]); i++) {
    sum += (texel(a, xy + dir * i) + texel(a, xy - dir * i)) * p[3u + u32(i)];
  }
  return sum;
}
"#;

const BLEND: &str = r#"
fn lum(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.3, 0.59, 0.11)); }
fn clip_colour(c0: vec3<f32>) -> vec3<f32> {
  var c = c0;
  let l = lum(c); let n = min(min(c.r, c.g), c.b); let x = max(max(c.r, c.g), c.b);
  if (n < 0.0) { c = l + (c - l) * l / max(l - n, 1e-6); }
  if (x > 1.0) { c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6); }
  return c;
}
fn set_lum(c: vec3<f32>, l: f32) -> vec3<f32> { return clip_colour(c + (l - lum(c))); }
fn sat(c: vec3<f32>) -> f32 { return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b); }
fn set_sat(c: vec3<f32>, s: f32) -> vec3<f32> {
  let n = min(min(c.r, c.g), c.b); let x = max(max(c.r, c.g), c.b);
  return select(vec3<f32>(0.0), (c - n) * s / (x - n), x > n);
}
fn dodge(b: f32, s: f32) -> f32 { if (b == 0.0) { return 0.0; } if (s >= 1.0) { return 1.0; } return min(1.0, b / (1.0 - s)); }
fn burn(b: f32, s: f32) -> f32 { if (b >= 1.0) { return 1.0; } if (s <= 0.0) { return 0.0; } return 1.0 - min(1.0, (1.0 - b) / s); }
fn hard(b: f32, s: f32) -> f32 { return select(1.0 - (1.0 - b) * (1.0 - (2.0 * s - 1.0)), b * 2.0 * s, s <= 0.5); }
fn soft(b: f32, s: f32) -> f32 {
  let d = select(sqrt(b), ((16.0 * b - 12.0) * b + 4.0) * b, b <= 0.25);
  return select(b + (2.0 * s - 1.0) * (d - b), b - (1.0 - 2.0 * s) * b * (1.0 - b), s <= 0.5);
}
fn mixed(b: vec3<f32>, s: vec3<f32>) -> vec3<f32> {
  switch u32(p[0]) {
    case 1u: { return b * s; }
    case 2u: { return b + s - b * s; }
    case 3u: { return vec3<f32>(hard(s.r, b.r), hard(s.g, b.g), hard(s.b, b.b)); }
    case 4u: { return min(b, s); }
    case 5u: { return max(b, s); }
    case 6u: { return vec3<f32>(dodge(b.r, s.r), dodge(b.g, s.g), dodge(b.b, s.b)); }
    case 7u: { return vec3<f32>(burn(b.r, s.r), burn(b.g, s.g), burn(b.b, s.b)); }
    case 8u: { return vec3<f32>(hard(b.r, s.r), hard(b.g, s.g), hard(b.b, s.b)); }
    case 9u: { return vec3<f32>(soft(b.r, s.r), soft(b.g, s.g), soft(b.b, s.b)); }
    case 10u: { return abs(b - s); }
    case 11u: { return b + s - 2.0 * b * s; }
    case 12u: { return set_lum(set_sat(s, sat(b)), lum(b)); }
    case 13u: { return set_lum(set_sat(b, sat(s)), lum(b)); }
    case 14u: { return set_lum(s, lum(b)); }
    case 15u: { return set_lum(b, lum(s)); }
    default: { return s; }
  }
}
fn run(xy: vec2<i32>) -> vec4<f32> {
  let s = texel(a, xy);
  let d = texel(b, xy);
  let cs = select(vec3<f32>(0.0), s.rgb / s.a, s.a > 0.0);
  let cb = select(vec3<f32>(0.0), d.rgb / d.a, d.a > 0.0);
  let rgb = s.rgb * (1.0 - d.a) + d.rgb * (1.0 - s.a) + s.a * d.a * clamp(mixed(cb, cs), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(rgb, s.a + d.a - s.a * d.a);
}
"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Op {
    Matrix,
    Table,
    Offset,
    Flood,
    Composite,
    Morph,
    Light,
    Turbulence,
    Tile,
    Displace,
    Blur,
    Blend,
}

const SOURCES: [(Op, &str); 12] = [
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
];

pub struct FilterPasses {
    layout: wgpu::BindGroupLayout,
    pipelines: Vec<(Op, wgpu::ComputePipeline)>,
}

fn entry(binding: u32, ty: wgpu::BindingType) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry { binding, visibility: wgpu::ShaderStages::COMPUTE, ty, count: None }
}

fn sampled() -> wgpu::BindingType {
    wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: false }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }
}

impl FilterPasses {
    pub fn new(device: &wgpu::Device) -> Self {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                entry(0, sampled()),
                entry(1, sampled()),
                entry(2, wgpu::BindingType::StorageTexture { access: wgpu::StorageTextureAccess::WriteOnly, format: wgpu::TextureFormat::Rgba8Unorm, view_dimension: wgpu::TextureViewDimension::D2 }),
                entry(3, wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Storage { read_only: true }, has_dynamic_offset: false, min_binding_size: None }),
            ],
        });
        let shared = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[Some(&layout)], immediate_size: 0 });
        let pipelines = SOURCES
            .iter()
            .map(|(op, body)| {
                let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: None, source: wgpu::ShaderSource::Wgsl(format!("{HEADER}{body}{FOOTER}").into()) });
                (*op, device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor { label: None, layout: Some(&shared), module: &module, entry_point: Some("main"), compilation_options: Default::default(), cache: None }))
            })
            .collect();
        Self { layout, pipelines }
    }

    pub fn run(&self, device: &wgpu::Device, queue: &wgpu::Queue, op: Op, inputs: [&wgpu::Texture; 2], params: &[f32]) -> wgpu::Texture {
        let pipeline = &self.pipelines.iter().find(|(o, _)| *o == op).expect("every op has a pipeline").1;
        let [a, b] = inputs;
        let out = layer_texture(device, a.width(), a.height());
        let padded: Vec<u8> = params.iter().chain(std::iter::once(&0.0)).flat_map(|v| v.to_le_bytes()).collect();
        let buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: &padded, usage: wgpu::BufferUsages::STORAGE });
        let view = |t: &wgpu::Texture| t.create_view(&wgpu::TextureViewDescriptor::default());
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view(a)) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&view(b)) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(&view(&out)) },
                wgpu::BindGroupEntry { binding: 3, resource: buffer.as_entire_binding() },
            ],
        });
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor::default());
            pass.set_pipeline(pipeline);
            pass.set_bind_group(0, &group, &[]);
            pass.dispatch_workgroups(out.width().div_ceil(GROUP), out.height().div_ceil(GROUP), 1);
        }
        queue.submit([encoder.finish()]);
        out
    }
}
