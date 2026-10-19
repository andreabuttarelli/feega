use vello::kurbo::Affine;
use vello::wgpu;

const IDENTITY: [f64; 6] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

use crate::display_list::DisplayList;
use crate::engine::Engine;
use crate::pictures::Pictures;
use crate::Skipped;

const ROW_ALIGN: u32 = 256;
const BYTES: u32 = 4;

pub struct Renderer {
    device: wgpu::Device,
    queue: wgpu::Queue,
    engine: Engine,
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
        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).map_err(failed)?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(failed)?;
        let engine = Engine::new(&device).map_err(failed)?;
        Ok(Self { device, queue, engine })
    }

    pub fn render(&mut self, list: &DisplayList, pictures: &Pictures) -> Result<Rendered, RenderError> {
        self.render_at(list, pictures, IDENTITY)
    }

    pub fn render_at(&mut self, list: &DisplayList, pictures: &Pictures, camera: [f64; 6]) -> Result<Rendered, RenderError> {
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
        let staged = self.engine.stage(&self.device, &self.queue, list, pictures).map_err(failed)?;
        let shown = self.engine.show(&self.device, &self.queue, &staged, pictures, Affine::new(camera), &view);
        let skipped = self.engine.release(staged);
        shown.map_err(failed)?;
        Ok(Rendered { pixels: self.read(&target, size)?, skipped })
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
