use vello::wgpu;

use crate::display_list::DisplayList;
use crate::engine::Engine;
use crate::groups::{Library, Limits};
use crate::pictures::Pictures;
use crate::Skipped;

const ROW_ALIGN: u32 = 256;
const BYTES: u32 = 4;
const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 96 };

pub struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    engine: Engine,
    library: Library,
    cached: Pictures,
    limits: Limits,
}

pub struct Rendered {
    pub pixels: Vec<u8>,
    pub skipped: Vec<Skipped>,
}

#[derive(Debug)]
pub struct RenderError(pub String);

fn failed<E: std::fmt::Debug>(e: E) -> RenderError {
    RenderError(format!("{e:?}"))
}

impl Renderer {
    pub fn new() -> Result<Self, RenderError> {
        Self::with_limits(LIMITS)
    }

    pub fn with_limits(limits: Limits) -> Result<Self, RenderError> {
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).map_err(failed)?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(failed)?;
        let engine = Engine::new(&device).map_err(failed)?;
        Ok(Self { device, queue, engine, library: Library::new(), cached: Pictures::new(), limits })
    }

    pub fn blending(mut self, blending: crate::layers::Blending) -> Self {
        self.engine.blending = blending;
        self
    }

    pub fn put_group(&mut self, key: &str, list: DisplayList) {
        self.library.put_group(key, &list);
    }

    pub fn put_font(&mut self, key: &str, source: gpu_text::Source) {
        self.library.put_font(key, source);
    }

    pub fn has_font(&self, key: &str) -> bool {
        self.library.has_font(key)
    }

    pub fn render(&mut self, list: &DisplayList, pictures: &Pictures) -> Result<Rendered, RenderError> {
        let plan = self.library.plan(list, self.limits);
        let (list, missing) = self.engine.hold(&mut self.cached, plan, pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures = &pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), v.clone())).collect();
        let list = &list;
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
        let skipped = self.engine.draw(&self.device, &self.queue, list, pictures, &view).map_err(failed)?;
        Ok(Rendered { pixels: self.read(&target, size)?, skipped: [skipped, missing].concat() })
    }

    pub fn draw_and_wait(&mut self, list: &DisplayList, pictures: &Pictures) -> Result<(), RenderError> {
        let plan = self.library.plan(list, self.limits);
        let (list, _) = self.engine.hold(&mut self.cached, plan, pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures = &pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), v.clone())).collect();
        let size = wgpu::Extent3d { width: list.width, height: list.height, depth_or_array_layers: 1 };
        let target = self.device.create_texture(&wgpu::TextureDescriptor { label: None, size, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[] });
        let view = target.create_view(&wgpu::TextureViewDescriptor::default());
        self.engine.draw(&self.device, &self.queue, &list, pictures, &view).map_err(failed)?;
        self.device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).map_err(failed)?;
        Ok(())
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
