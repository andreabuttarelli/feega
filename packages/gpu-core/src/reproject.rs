use vello::kurbo::Rect;
use vello::wgpu;
use vello::wgpu::util::DeviceExt;

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

@fragment
fn fs(@builtin(position) at: vec4<f32>) -> @location(0) vec4<f32> {
  let px = at.xy * look.scale + look.offset;
  let seen = textureSampleLevel(source, blend_sampler, px / look.size, 0.0);
  let inside = all(px >= vec2<f32>(0.0)) && all(px <= look.size);
  return select(vec4<f32>(0.0), seen, inside);
}
";

pub struct Reprojector {
    pipelines: Vec<(wgpu::TextureFormat, wgpu::RenderPipeline)>,
    sampler: wgpu::Sampler,
    module: wgpu::ShaderModule,
}

pub struct Draw<'a> {
    pub source: &'a wgpu::Texture,
    pub target: &'a wgpu::TextureView,
    pub format: wgpu::TextureFormat,
    pub look: Lookup,
    pub within: Option<Rect>,
}

impl Reprojector {
    pub fn new(device: &wgpu::Device) -> Self {
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: None, source: wgpu::ShaderSource::Wgsl(SHADER.into()) });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor { mag_filter: wgpu::FilterMode::Linear, min_filter: wgpu::FilterMode::Linear, ..Default::default() });
        Reprojector { pipelines: Vec::new(), sampler, module }
    }

    fn pipeline(&mut self, device: &wgpu::Device, format: wgpu::TextureFormat) -> &wgpu::RenderPipeline {
        if let Some(at) = self.pipelines.iter().position(|(f, _)| *f == format) {
            return &self.pipelines[at].1;
        }
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: None,
            layout: None,
            vertex: wgpu::VertexState { module: &self.module, entry_point: Some("vs"), compilation_options: Default::default(), buffers: &[] },
            primitive: wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            fragment: Some(wgpu::FragmentState { module: &self.module, entry_point: Some("fs"), compilation_options: Default::default(), targets: &[Some(wgpu::ColorTargetState { format, blend: None, write_mask: wgpu::ColorWrites::ALL })] }),
            multiview_mask: None,
            cache: None,
        });
        self.pipelines.push((format, pipeline));
        &self.pipelines.last().expect("just pushed").1
    }

    pub fn draw(&mut self, device: &wgpu::Device, encoder: &mut wgpu::CommandEncoder, d: Draw) {
        let size = [d.source.width() as f32, d.source.height() as f32];
        let values: [f32; 8] = [d.look.scale as f32, d.look.scale as f32, d.look.x as f32, d.look.y as f32, size[0], size[1], 0.0, 0.0];
        let bytes: Vec<u8> = values.iter().flat_map(|v| v.to_le_bytes()).collect();
        let uniform = device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: &bytes, usage: wgpu::BufferUsages::UNIFORM });
        let view = d.source.create_view(&wgpu::TextureViewDescriptor::default());
        let sampler = self.sampler.clone();
        let pipeline = self.pipeline(device, d.format).clone();
        let group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &pipeline.get_bind_group_layout(0),
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&sampler) },
                wgpu::BindGroupEntry { binding: 2, resource: uniform.as_entire_binding() },
            ],
        });
        let load = if d.within.is_some() { wgpu::LoadOp::Load } else { wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT) };
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
