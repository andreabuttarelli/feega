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
const TILE_UNIFORM_STRIDE: u64 = 256;

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

fn tile_slots(looks: &[[f32; 8]]) -> Vec<u8> {
    let mut bytes = vec![0u8; looks.len() * TILE_UNIFORM_STRIDE as usize];
    for (slot, look) in bytes.chunks_exact_mut(TILE_UNIFORM_STRIDE as usize).zip(looks) {
        for (at, value) in slot.chunks_exact_mut(4).zip(look) {
            at.copy_from_slice(&value.to_le_bytes());
        }
    }
    bytes
}

struct FrameKept<K, V> {
    last: std::collections::HashMap<K, V>,
    this: std::collections::HashMap<K, V>,
}

impl<K, V> Default for FrameKept<K, V> {
    fn default() -> Self {
        FrameKept { last: std::collections::HashMap::new(), this: std::collections::HashMap::new() }
    }
}

impl<K: std::hash::Hash + Eq, V> FrameKept<K, V> {
    fn take(&mut self, key: &K) -> Option<V> {
        self.this.remove(key).or_else(|| self.last.remove(key))
    }

    fn keep(&mut self, key: K, value: V) {
        self.this.insert(key, value);
    }

    fn turn(&mut self) {
        self.last = std::mem::take(&mut self.this);
    }

    fn clear(&mut self) {
        self.last.clear();
        self.this.clear();
    }
}

pub struct Reprojector {
    pipelines: Vec<((wgpu::TextureFormat, Output), wgpu::RenderPipeline)>,
    sampler: wgpu::Sampler,
    module: wgpu::ShaderModule,
    uniforms: Vec<wgpu::Buffer>,
    next: usize,
    tiles: Option<wgpu::Buffer>,
    layout: wgpu::BindGroupLayout,
    bound: FrameKept<wgpu::Texture, wgpu::BindGroup>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Output {
    Straight,
    Premultiplied,
    Over,
}

pub struct Tile<'a> {
    pub source: &'a wgpu::Texture,
    pub look: Lookup,
    pub within: Rect,
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
        let entry = |binding, ty| wgpu::BindGroupLayoutEntry { binding, visibility: wgpu::ShaderStages::FRAGMENT, ty, count: None };
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                entry(0, wgpu::BindingType::Texture { sample_type: wgpu::TextureSampleType::Float { filterable: true }, view_dimension: wgpu::TextureViewDimension::D2, multisampled: false }),
                entry(1, wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering)),
                entry(2, wgpu::BindingType::Buffer { ty: wgpu::BufferBindingType::Uniform, has_dynamic_offset: true, min_binding_size: wgpu::BufferSize::new(UNIFORM_BYTES) }),
            ],
        });
        Reprojector { pipelines: Vec::new(), sampler, module, uniforms, next: 0, tiles: None, layout, bound: Default::default() }
    }

    fn bind(&self, device: &wgpu::Device, source: &wgpu::Texture, uniform: &wgpu::Buffer) -> wgpu::BindGroup {
        let view = source.create_view(&wgpu::TextureViewDescriptor::default());
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.sampler) },
                wgpu::BindGroupEntry { binding: 2, resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding { buffer: uniform, offset: 0, size: wgpu::BufferSize::new(UNIFORM_BYTES) }) },
            ],
        })
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
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[Some(&self.layout)], immediate_size: 0 });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: None,
            layout: Some(&layout),
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

    fn tile_uniforms(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, tiles: &[Tile]) -> wgpu::Buffer {
        let looks: Vec<[f32; 8]> = tiles.iter().map(|t| [t.look.scale as f32, t.look.scale as f32, t.look.x as f32, t.look.y as f32, t.source.width() as f32, t.source.height() as f32, 0.0, 0.0]).collect();
        let bytes = tile_slots(&looks);
        let fits = self.tiles.as_ref().is_some_and(|b| b.size() >= bytes.len() as u64);
        if !fits {
            self.bound.clear();
            self.tiles = Some(device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (bytes.len() as u64).next_power_of_two(), usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false }));
        }
        let buffer = self.tiles.clone().expect("just sized");
        queue.write_buffer(&buffer, 0, &bytes);
        buffer
    }

    pub fn draw_tiles(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, encoder: &mut wgpu::CommandEncoder, target: &wgpu::TextureView, format: wgpu::TextureFormat, output: Output, tiles: &[Tile]) {
        if tiles.is_empty() {
            return;
        }
        let buffer = self.tile_uniforms(device, queue, tiles);
        let pipeline = self.pipeline(device, format, output).clone();
        let groups: Vec<wgpu::BindGroup> = tiles.iter().map(|t| self.bound.take(t.source).unwrap_or_else(|| self.bind(device, t.source, &buffer))).collect();
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: target, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store } })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&pipeline);
        for (i, (tile, group)) in tiles.iter().zip(&groups).enumerate() {
            let r = tile.within;
            pass.set_bind_group(0, group, &[(i as u64 * TILE_UNIFORM_STRIDE) as u32]);
            pass.set_scissor_rect(r.x0 as u32, r.y0 as u32, r.width() as u32, r.height() as u32);
            pass.draw(0..3, 0..1);
        }
        drop(pass);
        for (t, g) in tiles.iter().zip(groups) {
            self.bound.keep(t.source.clone(), g);
        }
    }

    pub fn end_frame(&mut self) {
        self.bound.turn();
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, encoder: &mut wgpu::CommandEncoder, d: Draw) {
        let size = [d.source.width() as f32, d.source.height() as f32];
        let values: [f32; 8] = [d.look.scale as f32, d.look.scale as f32, d.look.x as f32, d.look.y as f32, size[0], size[1], 0.0, 0.0];
        let bytes: Vec<u8> = values.iter().flat_map(|v| v.to_le_bytes()).collect();
        let uniform = self.uniform(queue, &bytes);
        let pipeline = self.pipeline(device, d.format, d.output).clone();
        let group = self.bind(device, d.source, &uniform);
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
        pass.set_bind_group(0, &group, &[0]);
        if let Some(r) = d.within {
            pass.set_scissor_rect(r.x0 as u32, r.y0 as u32, r.width() as u32, r.height() as u32);
        }
        pass.draw(0..3, 0..1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_binding_used_by_either_draw_of_a_frame_is_kept_for_the_next_frame() {
        let mut kept = FrameKept::default();
        kept.keep(1, "placed");
        kept.keep(2, "lifted");
        kept.turn();
        assert_eq!(kept.take(&1), Some("placed"));
        assert_eq!(kept.take(&2), Some("lifted"));
    }

    #[test]
    fn a_binding_unused_for_a_whole_frame_is_dropped() {
        let mut kept = FrameKept::default();
        kept.keep(1, "placed");
        kept.turn();
        kept.turn();
        assert_eq!(kept.take(&1), None);
    }

    #[test]
    fn each_tile_look_lands_at_the_start_of_its_own_aligned_slot() {
        let looks = [[1.0, 1.0, 2.0, 3.0, 256.0, 256.0, 0.0, 0.0], [0.5, 0.5, -4.0, 8.0, 128.0, 64.0, 0.0, 0.0]];
        let bytes = tile_slots(&looks);
        assert_eq!(bytes.len(), 2 * TILE_UNIFORM_STRIDE as usize);
        for (i, look) in looks.iter().enumerate() {
            let at = i * TILE_UNIFORM_STRIDE as usize;
            let floats: Vec<f32> = bytes[at..at + UNIFORM_BYTES as usize].chunks(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect();
            assert_eq!(floats, look.to_vec());
            assert!(bytes[at + UNIFORM_BYTES as usize..at + TILE_UNIFORM_STRIDE as usize].iter().all(|&b| b == 0));
        }
    }
}
