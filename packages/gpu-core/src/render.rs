use vello::peniko::{color::AlphaColor, Color};
use vello::wgpu;
use vello::{AaConfig, RenderParams, RendererOptions};

use crate::display_list::DisplayList;
use crate::scene::build;

const ROW_ALIGN: u32 = 256;
const BYTES: u32 = 4;

pub struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    vello: vello::Renderer,
}

#[derive(Debug)]
pub struct RenderError(pub String);

fn failed<E: std::fmt::Debug>(e: E) -> RenderError {
    RenderError(format!("{e:?}"))
}

impl Renderer {
    pub fn new() -> Result<Self, RenderError> {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).map_err(failed)?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(failed)?;
        let vello = vello::Renderer::new(&device, RendererOptions { antialiasing_support: vello::AaSupport::area_only(), ..Default::default() }).map_err(failed)?;
        Ok(Self { device, queue, vello })
    }

    pub fn render(&mut self, list: &DisplayList) -> Result<Vec<u8>, RenderError> {
        let (scene, _) = build(list);
        let size = wgpu::Extent3d { width: list.width, height: list.height, depth_or_array_layers: 1 };
        let target = self.device.create_texture(&wgpu::TextureDescriptor {
            label: None,
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: wgpu::TextureFormat::Rgba8Unorm,
            usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = target.create_view(&wgpu::TextureViewDescriptor::default());
        let base: Color = list.background.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT);
        let params = RenderParams { base_color: base, width: list.width, height: list.height, antialiasing_method: AaConfig::Area };
        self.vello.render_to_texture(&self.device, &self.queue, &scene, &view, &params).map_err(failed)?;
        self.read(&target, size)
    }

    fn read(&self, target: &wgpu::Texture, size: wgpu::Extent3d) -> Result<Vec<u8>, RenderError> {
        let row = size.width * BYTES;
        let padded = row.div_ceil(ROW_ALIGN) * ROW_ALIGN;
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (padded * size.height) as u64, usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo { texture: target, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(padded), rows_per_image: None } },
            size,
        );
        self.queue.submit([encoder.finish()]);
        let slice = buffer.slice(..);
        slice.map_async(wgpu::MapMode::Read, |_| {});
        self.device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).map_err(failed)?;
        let data = slice.get_mapped_range().map_err(failed)?.to_vec();
        Ok(data.chunks(padded as usize).flat_map(|r| r[..row as usize].to_vec()).collect())
    }
}
