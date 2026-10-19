use vello::peniko::{color::AlphaColor, Color};
use vello::wgpu;
use vello::{AaConfig, AaSupport, RenderParams, RendererOptions};
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;

use crate::display_list::parse;
use crate::scene::build;

#[wasm_bindgen]
pub struct WebCore {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    format: wgpu::TextureFormat,
    renderer: vello::Renderer,
    blitter: wgpu::util::TextureBlitter,
    target: wgpu::Texture,
    width: u32,
    height: u32,
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
        let renderer = vello::Renderer::new(&device, RendererOptions { antialiasing_support: AaSupport::area_only(), ..Default::default() }).map_err(failed)?;
        let blitter = wgpu::util::TextureBlitter::new(&device, format);
        let target = storage(&device, width, height);
        Ok(WebCore { device, queue, surface, format, renderer, blitter, target, width, height })
    }

    pub fn draw(&mut self, list_json: &str) -> Result<String, JsValue> {
        let list = parse(list_json).map_err(failed)?;
        let (scene, skipped) = build(&list);
        let base: Color = list.background.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT);
        let view = self.target.create_view(&wgpu::TextureViewDescriptor::default());
        let params = RenderParams { base_color: base, width: self.width, height: self.height, antialiasing_method: AaConfig::Area };
        self.renderer.render_to_texture(&self.device, &self.queue, &scene, &view, &params).map_err(failed)?;
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
