use vello::wgpu;
use vello::wgpu::util::DeviceExt;

use crate::display_list::MaskMode;
use crate::kernel::{gaussian, MAX_TAPS};

const GROUP: u32 = 8;

const SHARED: &str = r#"
@group(0) @binding(0) var a: texture_2d<f32>;
@group(0) @binding(1) var b: texture_2d<f32>;
@group(0) @binding(2) var dst: texture_storage_2d<rgba8unorm, write>;

fn load(t: texture_2d<f32>, xy: vec2<i32>) -> vec4<f32> {
  let size = vec2<i32>(textureDimensions(t));
  let c = textureLoad(t, clamp(xy, vec2<i32>(0), size - 1), 0);
  return vec4<f32>(c.rgb * c.a, c.a);
}

fn store(xy: vec2<i32>, c: vec4<f32>) {
  let rgb = select(vec3<f32>(0.0), c.rgb / c.a, c.a > 0.0);
  textureStore(dst, xy, vec4<f32>(rgb, c.a));
}
"#;

const BLUR: &str = r#"
struct Blur { dir: vec2<i32>, taps: u32, pad: u32, w: array<vec4<f32>, 16> }
@group(0) @binding(3) var<uniform> p: Blur;

fn weight(i: u32) -> f32 { return p.w[i / 4u][i % 4u]; }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(a);
  if (id.x >= size.x || id.y >= size.y) { return; }
  let xy = vec2<i32>(id.xy);
  var sum = load(a, xy) * weight(0u);
  for (var i = 1u; i < p.taps; i++) {
    let o = p.dir * i32(i);
    sum += (load(a, xy + o) + load(a, xy - o)) * weight(i);
  }
  store(xy, sum);
}
"#;

const FOLD: &str = r#"
struct Fold { mode: u32, first: u32, invert: u32, luma: u32, level: f32, pad0: f32, pad1: f32, pad2: f32 }
@group(0) @binding(3) var<uniform> p: Fold;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(b);
  if (id.x >= size.x || id.y >= size.y) { return; }
  let xy = vec2<i32>(id.xy);
  let c = load(b, xy);
  let cov = select(c.a, dot(c.rgb, vec3<f32>(0.2125, 0.7154, 0.0721)), p.luma == 1u);
  let l = select(p.level * cov, 1.0 - p.level * cov, p.invert == 1u);
  let seed = select(0.0, 1.0, p.mode == 1u || p.mode == 2u);
  let k = select(load(a, xy).a, seed, p.first == 1u);
  var o = k + l - 2.0 * k * l;
  if (p.mode == 0u) { o = k + l - k * l; }
  if (p.mode == 1u) { o = k * (1.0 - l); }
  if (p.mode == 2u) { o = k * l; }
  textureStore(dst, xy, vec4<f32>(1.0, 1.0, 1.0, o));
}
"#;

const APPLY: &str = r#"
@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let size = textureDimensions(a);
  if (id.x >= size.x || id.y >= size.y) { return; }
  let xy = vec2<i32>(id.xy);
  store(xy, load(a, xy) * textureLoad(b, xy, 0).a);
}
"#;

fn words(ints: &[u32], floats: &[f32]) -> Vec<u8> {
    ints.iter().flat_map(|v| v.to_le_bytes()).chain(floats.iter().flat_map(|v| v.to_le_bytes())).collect()
}

pub struct Fold {
    pub mode: MaskMode,
    pub level: f32,
    pub invert: bool,
    pub luma: bool,
}

const MODE_CODE: [(MaskMode, u32); 4] = [(MaskMode::Add, 0), (MaskMode::Subtract, 1), (MaskMode::Intersect, 2), (MaskMode::Difference, 3)];

fn mode_code(mode: MaskMode) -> u32 {
    MODE_CODE.iter().find(|(m, _)| *m == mode).map_or(0, |(_, c)| *c)
}

pub struct Passes {
    layout: wgpu::BindGroupLayout,
    blur: wgpu::ComputePipeline,
    fold: wgpu::ComputePipeline,
    apply: wgpu::ComputePipeline,
    blank: wgpu::Buffer,
}

pub fn layer_texture(device: &wgpu::Device, width: u32, height: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    })
}

fn entry(binding: u32, ty: wgpu::BindingType) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry { binding, visibility: wgpu::ShaderStages::COMPUTE, ty, count: None }
}

fn sampled() -> wgpu::BindingType {
    wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: false }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }
}

impl Passes {
    pub fn new(device: &wgpu::Device) -> Self {
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                entry(0, sampled()),
                entry(1, sampled()),
                entry(2, wgpu::BindingType::StorageTexture { access: wgpu::StorageTextureAccess::WriteOnly, format: wgpu::TextureFormat::Rgba8Unorm, view_dimension: wgpu::TextureViewDimension::D2 }),
                entry(3, wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: false, min_binding_size: None }),
            ],
        });
        let pipelines = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[Some(&layout)], immediate_size: 0 });
        let pipeline = |body: &str| {
            let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: None, source: wgpu::ShaderSource::Wgsl(format!("{SHARED}{body}").into()) });
            device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor { label: None, layout: Some(&pipelines), module: &module, entry_point: Some("main"), compilation_options: Default::default(), cache: None })
        };
        let blank = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: &[0; 32], usage: wgpu::BufferUsages::UNIFORM });
        Self { blur: pipeline(BLUR), fold: pipeline(FOLD), apply: pipeline(APPLY), layout, blank }
    }

    fn run(&self, device: &wgpu::Device, queue: &wgpu::Queue, pipeline: &wgpu::ComputePipeline, a: &wgpu::Texture, b: &wgpu::Texture, params: &wgpu::Buffer) -> wgpu::Texture {
        let out = layer_texture(device, a.width(), a.height());
        let view = |t: &wgpu::Texture| t.create_view(&wgpu::TextureViewDescriptor::default());
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view(a)) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::TextureView(&view(b)) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::TextureView(&view(&out)) },
                wgpu::BindGroupEntry { binding: 3, resource: params.as_entire_binding() },
            ],
        });
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        {
            let mut pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor::default());
            pass.set_pipeline(pipeline);
            pass.set_bind_group(0, &group, &[]);
            pass.dispatch_workgroups(a.width().div_ceil(GROUP), a.height().div_ceil(GROUP), 1);
        }
        queue.submit([encoder.finish()]);
        out
    }

    fn uniform(device: &wgpu::Device, contents: &[u8]) -> wgpu::Buffer {
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents, usage: wgpu::BufferUsages::UNIFORM })
    }

    pub fn blur(&self, device: &wgpu::Device, queue: &wgpu::Queue, src: wgpu::Texture, sigma: f64) -> wgpu::Texture {
        if sigma <= 0.0 {
            return src;
        }
        let kernel = gaussian(sigma);
        let mut w = [0.0; MAX_TAPS];
        w[..kernel.weights.len()].copy_from_slice(&kernel.weights);
        let taps = kernel.weights.len() as u32;
        let along = |dx: u32, dy: u32| Self::uniform(device, &words(&[dx, dy, taps, 0], &w));
        let across = self.run(device, queue, &self.blur, &src, &src, &along(kernel.step, 0));
        self.run(device, queue, &self.blur, &across, &across, &along(0, kernel.step))
    }

    pub fn fold(&self, device: &wgpu::Device, queue: &wgpu::Queue, acc: Option<&wgpu::Texture>, cover: &wgpu::Texture, step: Fold) -> wgpu::Texture {
        let params = words(&[mode_code(step.mode), acc.is_none() as u32, step.invert as u32, step.luma as u32], &[step.level, 0.0, 0.0, 0.0]);
        self.run(device, queue, &self.fold, acc.unwrap_or(cover), cover, &Self::uniform(device, &params))
    }

    pub fn apply(&self, device: &wgpu::Device, queue: &wgpu::Queue, body: &wgpu::Texture, mask: &wgpu::Texture) -> wgpu::Texture {
        self.run(device, queue, &self.apply, body, mask, &self.blank)
    }
}
