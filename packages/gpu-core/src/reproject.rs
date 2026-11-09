use vello::kurbo::Rect;
use vello::wgpu;

use crate::retained::Lookup;

const SHADER: &str = "
struct Look { scale: vec2<f32>, offset: vec2<f32>, size: vec2<f32>, unused: vec2<f32> };
@group(0) @binding(0) var source: texture_2d<f32>;
@group(0) @binding(1) var blend_sampler: sampler;
@group(0) @binding(2) var<uniform> look: Look;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
  let p = vec2<f32>(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4<f32>(p * 2.0 - 1.0, 0.0, 1.0);
}

fn seen_at(at: vec4<f32>) -> vec4<f32> {
  let px = at.xy * look.scale + look.offset;
  let seen = textureSampleLevel(source, blend_sampler, px / look.size, 0.0);
  let inside = all(px >= vec2<f32>(0.0)) && all(px <= look.size);
  return select(vec4<f32>(0.0), seen, inside);
}

@fragment
fn straight(@builtin(position) at: vec4<f32>) -> @location(0) vec4<f32> {
  return seen_at(at);
}

@fragment
fn premultiplied(@builtin(position) at: vec4<f32>) -> @location(0) vec4<f32> {
  let seen = seen_at(at);
  return vec4<f32>(seen.rgb * seen.a, seen.a);
}
";

const UNIFORM_BYTES: u64 = 32;
const IN_FLIGHT_SLOTS: usize = 4;

struct Mode {
    entry: &'static str,
    blend: Option<wgpu::BlendState>,
}

const MODES: [(Output, Mode); 3] = [
    (Output::Straight, Mode { entry: "straight", blend: None }),
    (Output::Premultiplied, Mode { entry: "premultiplied", blend: None }),
    (Output::Over, Mode { entry: "premultiplied", blend: Some(wgpu::BlendState::PREMULTIPLIED_ALPHA_BLENDING) }),
];

fn mode(output: Output) -> &'static Mode {
    &MODES.iter().find(|(o, _)| *o == output).expect("every output has a mode").1
}

pub struct Reprojector {
    pipelines: Vec<((wgpu::TextureFormat, Output), wgpu::RenderPipeline)>,
    sampler: wgpu::Sampler,
    module: wgpu::ShaderModule,
    uniforms: Vec<wgpu::Buffer>,
    next: usize,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Output {
    Straight,
    Premultiplied,
    Over,
}

pub struct Draw<'a> {
    pub source: &'a wgpu::Texture,
    pub target: &'a wgpu::TextureView,
    pub format: wgpu::TextureFormat,
    pub look: Lookup,
    pub within: Option<Rect>,
    pub output: Output,
}

impl Reprojector {
    pub fn new(device: &wgpu::Device) -> Self {
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: None, source: wgpu::ShaderSource::Wgsl(SHADER.into()) });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor { mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear, ..Default::default() });
        let uniforms = (0..IN_FLIGHT_SLOTS).map(|_| device.create_buffer(&wgpu::BufferDescriptor { label: None, size: UNIFORM_BYTES, usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false })).collect();
        Reprojector { pipelines: Vec::new(), sampler, module, uniforms, next: 0 }
    }

    pub fn uniform_bytes(&self) -> u64 {
        self.uniforms.iter().map(|b| b.size()).sum()
    }

    fn uniform(&mut self, queue: &wgpu::Queue, bytes: &[u8]) -> wgpu::Buffer {
        let slot = self.uniforms[self.next].clone();
        self.next = (self.next + 1) % self.uniforms.len();
        queue.write_buffer(&slot, 0, bytes);
        slot
    }

    fn pipeline(&mut self, device: &wgpu::Device, format: wgpu::TextureFormat, output: Output) -> &wgpu::RenderPipeline {
        if let Some(at) = self.pipelines.iter().position(|(key, _)| *key == (format, output)) {
            return &self.pipelines[at].1;
        }
        let Mode { entry, blend } = mode(output);
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: None,
            layout: None,
            vertex: wgpu::VertexState { module: &self.module, entry_point: Some("vs"), compilation_options: Default::default(), buffers: &[] },
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            fragment: Some(wgpu::FragmentState { module: &self.module, entry_point: Some(entry), compilation_options: Default::default(), targets: &[Some(wgpu::ColorTargetState { format, blend: *blend, write_mask: wgpu::ColorWrites::ALL })] }),
            multiview_mask: None,
            cache: None,
        });
        self.pipelines.push(((format, output), pipeline));
        &self.pipelines.last().expect("just pushed").1
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, encoder: &mut wgpu::CommandEncoder, d: Draw) {
        let size = [d.source.width() as f32, d.source.height() as f32];
        let values: [f32; 8] = [d.look.scale as f32, d.look.scale as f32, d.look.x as f32, d.look.y as f32, size[0], size[1], 0.0, 0.0];
        let bytes: Vec<u8> = values.iter().flat_map(|v| v.to_le_bytes()).collect();
        let uniform = self.uniform(queue, &bytes);
        let view = d.source.create_view(&wgpu::TextureViewDescriptor::default());
        let sampler = self.sampler.clone();
        let pipeline = self.pipeline(device, d.format, d.output).clone();
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &pipeline.get_bind_group_layout(0),
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&sampler) },
                wgpu::BindGroupEntry { binding: 2, resource: uniform.as_entire_binding() },
            ],
        });
        let load = if d.within.is_some() || mode(d.output).blend.is_some() { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT) };
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: d.target, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load, store: wgpu::StoreOp::Store } })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&pipeline);
        pass.set_bind_group(0, &group, &[]);
        if let Some(r) = d.within {
            pass.set_scissor_rect(r.x0 as u32, r.y0 as u32, r.width() as u32, r.height() as u32);
        }
        pass.draw(0..3, 0..1);
    }
}
