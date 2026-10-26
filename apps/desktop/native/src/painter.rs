use std::collections::HashMap;

use gpu_core::compositor::{render_tile, Painter};
use gpu_core::engine::Engine;
use gpu_core::filter_passes::layer_texture;
use gpu_core::groups::{Limits, Plan};
use gpu_core::pictures::Pictures;
use gpu_core::reproject::{Draw, Reprojector};
use gpu_core::retained::{Lookup, Quality};
use gpu_core::Skipped;
use vello::kurbo::{Rect, Vec2};
use vello::wgpu;

const POOLED_SIZES: usize = 8;

pub fn texel(texture: &wgpu::Texture, x: u32, y: u32) -> wgpu::TexelCopyTextureInfo<'_> {
    wgpu::TexelCopyTextureInfo { texture, mip_level: 0, origin: wgpu::Origin3d { x, y, z: 0 }, aspect: wgpu::TextureAspect::All }
}

pub fn held_texture(device: &wgpu::Device, (width, height): (u32, u32)) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::COPY_SRC | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::RENDER_ATTACHMENT,
        view_formats: &[],
    })
}

pub fn upload_target(device: &wgpu::Device, (width, height): (u32, u32)) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::COPY_SRC | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    })
}

#[derive(Default)]
pub struct ScratchPool {
    by_size: HashMap<(u32, u32), wgpu::Texture>,
}

impl ScratchPool {
    fn texture(&mut self, device: &wgpu::Device, size: (u32, u32)) -> wgpu::Texture {
        if !self.by_size.contains_key(&size) && self.by_size.len() >= POOLED_SIZES {
            self.by_size.clear();
        }
        self.by_size.entry(size).or_insert_with(|| layer_texture(device, size.0, size.1)).clone()
    }
}

pub struct GpuPainter<'a> {
    pub device: &'a wgpu::Device,
    pub queue: &'a wgpu::Queue,
    pub surface: &'a wgpu::Surface<'static>,
    pub configuration: &'a wgpu::SurfaceConfiguration,
    pub engine: &'a mut Engine,
    pub pictures: &'a Pictures,
    pub cached: &'a mut Pictures,
    pub limits: Limits,
    pub retained: &'a mut wgpu::Texture,
    pub spare: &'a mut wgpu::Texture,
    pub reprojector: &'a mut Reprojector,
    pub scratch: &'a mut ScratchPool,
    pub drawable: &'a mut Option<wgpu::SurfaceTexture>,
    pub last_look: &'a mut Option<Lookup>,
    pub presented: &'a mut bool,
}

pub fn acquire(surface: &wgpu::Surface<'static>, device: &wgpu::Device, configuration: &wgpu::SurfaceConfiguration) -> Option<wgpu::SurfaceTexture> {
    match surface.get_current_texture() {
        wgpu::CurrentSurfaceTexture::Success(texture) => Some(texture),
        wgpu::CurrentSurfaceTexture::Suboptimal(texture) => {
            surface.configure(device, configuration);
            Some(texture)
        }
        wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
            surface.configure(device, configuration);
            None
        }
        wgpu::CurrentSurfaceTexture::Timeout | wgpu::CurrentSurfaceTexture::Occluded | wgpu::CurrentSurfaceTexture::Validation => None,
    }
}

impl Painter for GpuPainter<'_> {
    type Error = String;

    fn limits(&self) -> Limits {
        self.limits
    }

    fn tile(&self) -> (u32, u32) {
        render_tile(self.device.limits().max_texture_dimension_2d)
    }

    fn shift(&mut self, (dx, dy): (i32, i32)) -> Result<(), String> {
        let (w, h) = (self.retained.width() as i32, self.retained.height() as i32);
        let whole = Rect::new(0.0, 0.0, w as f64, h as f64);
        let from = whole.intersect(whole - Vec2::new(dx as f64, dy as f64));
        if from.area() > 0.0 {
            let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
            let (x, y) = (from.x0 as u32, from.y0 as u32);
            encoder.copy_texture_to_texture(texel(self.retained, x, y), texel(self.spare, (x as i32 + dx) as u32, (y as i32 + dy) as u32), wgpu::Extent3d { width: from.width() as u32, height: from.height() as u32, depth_or_array_layers: 1 });
            self.queue.submit([encoder.finish()]);
        }
        std::mem::swap(self.retained, self.spare);
        Ok(())
    }

    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, String> {
        let (list, missing) = self.engine.hold(self.cached, plan, self.pictures, self.device, self.queue).map_err(|e| format!("{e:?}"))?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let scratch = self.scratch.texture(self.device, (list.width.max(1), list.height.max(1)));
        let skipped = self.engine.draw(self.device, self.queue, &list, &pictures, &scratch.create_view(&wgpu::TextureViewDescriptor::default())).map_err(|e| format!("{e:?}"))?;
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        match quality {
            Quality::Sharp => encoder.copy_texture_to_texture(texel(&scratch, 0, 0), texel(self.retained, into.x0 as u32, into.y0 as u32), wgpu::Extent3d { width: list.width, height: list.height, depth_or_array_layers: 1 }),
            Quality::Rough => {
                let scale = list.width as f64 / into.width();
                let look = Lookup { scale, x: -into.x0 * scale, y: -into.y0 * scale };
                let target = self.retained.create_view(&wgpu::TextureViewDescriptor::default());
                self.reprojector.draw(self.device, &mut encoder, Draw { source: &scratch, target: &target, format: wgpu::TextureFormat::Rgba8Unorm, look, within: Some(into) });
            }
        }
        self.queue.submit([encoder.finish()]);
        Ok([skipped, missing].concat())
    }

    fn present(&mut self, look: Lookup) -> Result<(), String> {
        *self.last_look = Some(look);
        let Some(frame) = self.drawable.take().or_else(|| acquire(self.surface, self.device, self.configuration)) else {
            return Ok(());
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.configuration.format), ..Default::default() });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.reprojector.draw(self.device, &mut encoder, Draw { source: self.retained, target: &out, format: self.configuration.format, look, within: None });
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        *self.presented = true;
        Ok(())
    }
}

pub fn snapshot(device: &wgpu::Device, queue: &wgpu::Queue, reprojector: &mut Reprojector, retained: &wgpu::Texture, look: Lookup, (width, height): (u32, u32), path: &str) -> Result<(), String> {
    let target = held_texture(device, (width, height));
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());
    let row = (width * 4).div_ceil(256) * 256;
    let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (row * height) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    reprojector.draw(device, &mut encoder, Draw { source: retained, target: &view, format: wgpu::TextureFormat::Rgba8Unorm, look, within: None });
    encoder.copy_texture_to_buffer(texel(&target, 0, 0), wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(row), rows_per_image: Some(height) } }, wgpu::Extent3d { width, height, depth_or_array_layers: 1 });
    queue.submit([encoder.finish()]);
    buffer.slice(..).map_async(wgpu::MapMode::Read, |_| {});
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).map_err(|e| format!("{e:?}"))?;
    let data = buffer.slice(..).get_mapped_range().map_err(|e| format!("{e:?}"))?;
    let mut pixels = Vec::with_capacity((width * height * 4) as usize);
    for y in 0..height {
        pixels.extend_from_slice(&data[(y * row) as usize..(y * row + width * 4) as usize]);
    }
    let file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    let mut encoder = png::Encoder::new(file, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header().and_then(|mut w| w.write_image_data(&pixels)).map_err(|e| e.to_string())
}
