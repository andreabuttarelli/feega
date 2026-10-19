use std::collections::HashMap;

use vello::wgpu;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap};

use crate::display_list::parse;
use crate::engine::Engine;
use crate::pictures::Pictures;

#[wasm_bindgen]
pub struct WebCore {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    format: wgpu::TextureFormat,
    engine: Engine,
    blitter: wgpu::util::TextureBlitter,
    target: wgpu::Texture,
    pictures: Pictures,
    textures: HashMap<String, wgpu::Texture>,
}

fn failed<E: std::fmt::Debug>(e: E) -> JsValue {
    JsValue::from_str(&format!("{e:?}"))
}

fn storage(device: &wgpu::Device, width: u32, height: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING,
        view_formats: &[],
    })
}

fn upload_target(device: &wgpu::Device, width: u32, height: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::COPY_SRC | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::RENDER_ATTACHMENT,
        view_formats: &[],
    })
}

fn external(source: JsValue) -> Result<wgpu::ExternalImageSource, JsValue> {
    let source = match source.dyn_into::<HtmlVideoElement>() {
        Ok(v) => return Ok(wgpu::ExternalImageSource::HTMLVideoElement(v)),
        Err(s) => s,
    };
    let source = match source.dyn_into::<HtmlImageElement>() {
        Ok(i) => return Ok(wgpu::ExternalImageSource::HTMLImageElement(i)),
        Err(s) => s,
    };
    let source = match source.dyn_into::<ImageBitmap>() {
        Ok(b) => return Ok(wgpu::ExternalImageSource::ImageBitmap(b)),
        Err(s) => s,
    };
    source.dyn_into::<HtmlCanvasElement>().map(wgpu::ExternalImageSource::HTMLCanvasElement).map_err(|_| failed("unknown picture source"))
}

#[wasm_bindgen]
impl WebCore {
    pub async fn attach(canvas: HtmlCanvasElement, width: u32, height: u32) -> Result<WebCore, JsValue> {
        canvas.set_width(width);
        canvas.set_height(height);
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor { backends: wgpu::Backends::BROWSER_WEBGPU, ..wgpu::InstanceDescriptor::new_without_display_handle() });
        let surface = instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas)).map_err(failed)?;
        let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions { compatible_surface: Some(&surface), ..Default::default() }).await.map_err(failed)?;
        let (device, queue) = adapter.request_device(&wgpu::DeviceDescriptor::default()).await.map_err(failed)?;
        let format = surface.get_capabilities(&adapter).formats.into_iter().find(|f| !f.is_srgb()).ok_or_else(|| failed("no linear surface format"))?;
        surface.configure(&device, &wgpu::SurfaceConfiguration { usage: wgpu::TextureUsages::RENDER_ATTACHMENT, format, width, height, present_mode: wgpu::PresentMode::Fifo, alpha_mode: wgpu::CompositeAlphaMode::Auto, view_formats: vec![], desired_maximum_frame_latency: 2, color_space: wgpu::SurfaceColorSpace::Auto });
        let engine = Engine::new(&device).map_err(failed)?;
        let blitter = wgpu::util::TextureBlitter::new(&device, format);
        let target = storage(&device, width, height);
        Ok(WebCore { device, queue, surface, format, engine, blitter, target, pictures: Pictures::new(), textures: HashMap::new() })
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        let source = external(source)?;
        let fits = self.textures.get(clip).is_some_and(|t| t.width() == width && t.height() == height);
        if !fits {
            if let Some(old) = self.pictures.remove(clip) {
                self.engine.vello.unregister_texture(old);
            }
            let texture = upload_target(&self.device, width, height);
            self.pictures.insert(clip.into(), self.engine.vello.register_texture(texture.clone()));
            self.textures.insert(clip.into(), texture);
        }
        let texture = &self.textures[clip];
        self.queue.copy_external_image_to_texture(
            &wgpu::CopyExternalImageSourceInfo { source, origin: wgpu::Origin2d::ZERO, flip_y: false },
            wgpu::CopyExternalImageDestInfo { texture, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All, color_space: wgpu::PredefinedColorSpace::Srgb, premultiplied_alpha: false },
            wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        );
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        Ok(())
    }

    pub fn draw(&mut self, list_json: &str) -> Result<String, JsValue> {
        let list = parse(list_json).map_err(failed)?;
        let view = self.target.create_view(&wgpu::TextureViewDescriptor::default());
        let skipped = self.engine.draw(&self.device, &self.queue, &list, &self.pictures, &view).map_err(failed)?;
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err(failed("no surface texture")),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.blitter.copy(&self.device, &mut encoder, &view, &out);
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(skipped.iter().map(|s| format!("{} {}", s.clip, s.what)).collect::<Vec<_>>().join("\n"))
    }
}
