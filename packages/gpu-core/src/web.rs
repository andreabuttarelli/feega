use std::collections::HashMap;

use vello::wgpu;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap};

use vello::kurbo::Rect;

use crate::compositor::{Compositor, Painter};
use crate::display_list::parse;
use crate::engine::Engine;
use crate::filter_passes::layer_texture;
use crate::groups::{report, Library, Limits, Plan};
use crate::pictures::Pictures;
use crate::reproject::{Draw, Reprojector};
use crate::retained::{Camera, Lookup, Quality};
use crate::world::{parse_overlay, parse_patch};
use crate::Skipped;

const CACHE_SIDE: u32 = 4096;
const RASTERS_PER_DRAW: usize = 1;
const ITEMS_PER_RASTER: usize = 48;

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
    library: Library,
    cached: Pictures,
    limits: Limits,
    pending: bool,
    compositor: Compositor,
    camera: Camera,
    retained: wgpu::Texture,
    spare: wgpu::Texture,
    reprojector: Reprojector,
}

struct GpuPainter<'a> {
    device: &'a wgpu::Device,
    queue: &'a wgpu::Queue,
    surface: &'a wgpu::Surface<'static>,
    format: wgpu::TextureFormat,
    engine: &'a mut Engine,
    pictures: &'a Pictures,
    cached: &'a mut Pictures,
    limits: Limits,
    retained: &'a mut wgpu::Texture,
    spare: &'a mut wgpu::Texture,
    reprojector: &'a mut Reprojector,
}

fn held_texture(device: &wgpu::Device, (width, height): (u32, u32)) -> wgpu::Texture {
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

fn texel(texture: &wgpu::Texture, x: u32, y: u32) -> wgpu::TexelCopyTextureInfo<'_> {
    wgpu::TexelCopyTextureInfo { texture, mip_level: 0, origin: wgpu::Origin3d { x, y, z: 0 }, aspect: wgpu::TextureAspect::All }
}

impl Painter for GpuPainter<'_> {
    type Error = JsValue;

    fn limits(&self) -> Limits {
        self.limits
    }

    fn tile(&self) -> (u32, u32) {
        crate::compositor::render_tile(self.device.limits().max_texture_dimension_2d)
    }

    fn shift(&mut self, (dx, dy): (i32, i32)) -> Result<(), JsValue> {
        let (w, h) = (self.retained.width() as i32, self.retained.height() as i32);
        let whole = Rect::new(0.0, 0.0, w as f64, h as f64);
        let from = whole.intersect(whole - vello::kurbo::Vec2::new(dx as f64, dy as f64));
        if from.area() > 0.0 {
            let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
            let (x, y) = (from.x0 as u32, from.y0 as u32);
            encoder.copy_texture_to_texture(texel(self.retained, x, y), texel(self.spare, (x as i32 + dx) as u32, (y as i32 + dy) as u32), wgpu::Extent3d { width: from.width() as u32, height: from.height() as u32, depth_or_array_layers: 1 });
            self.queue.submit([encoder.finish()]);
        }
        std::mem::swap(self.retained, self.spare);
        Ok(())
    }

    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, JsValue> {
        let (list, missing) = self.engine.hold(self.cached, plan, self.pictures, self.device, self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let scratch = layer_texture(self.device, list.width.max(1), list.height.max(1));
        let skipped = self.engine.draw(self.device, self.queue, &list, &pictures, &scratch.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
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

    fn present(&mut self, look: Lookup) -> Result<(), JsValue> {
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err(failed("no surface texture")),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.reprojector.draw(self.device, &mut encoder, Draw { source: self.retained, target: &out, format: self.format, look, within: None });
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(())
    }
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
        surface.configure(&device, &wgpu::SurfaceConfiguration { usage: wgpu::TextureUsages::RENDER_ATTACHMENT, format, width, height, present_mode: wgpu::PresentMode::Fifo, alpha_mode: wgpu::CompositeAlphaMode::PreMultiplied, view_formats: vec![], desired_maximum_frame_latency: 2, color_space: wgpu::SurfaceColorSpace::Auto });
        let engine = Engine::new(&device).map_err(failed)?;
        let blitter = wgpu::util::TextureBlitter::new(&device, format);
        let target = storage(&device, width, height);
        let limits = Limits { side: CACHE_SIDE.min(device.limits().max_texture_dimension_2d), rasters: RASTERS_PER_DRAW, items: ITEMS_PER_RASTER };
        let compositor = Compositor::new(width, height);
        let retained = held_texture(&device, compositor.size());
        let spare = held_texture(&device, compositor.size());
        let reprojector = Reprojector::new(&device);
        let camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
        Ok(WebCore { device, queue, surface, format, engine, blitter, target, pictures: Pictures::new(), textures: HashMap::new(), library: Library::new(), cached: Pictures::new(), limits, pending: false, compositor, camera, retained, spare, reprojector })
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
        self.compositor.touch_picture(clip, &self.library);
        Ok(())
    }

    pub fn put_group(&mut self, key: &str, list_json: &str) -> Result<(), JsValue> {
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse(list_json).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group(&mut self, key: &str, list_json: &str) -> Result<(), JsValue> {
        self.library.append_group(key, &parse(list_json).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn drop_group(&mut self, key: &str) {
        self.compositor.touch(key, &self.library);
        self.library.drop_group(key);
    }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera = Camera { x, y, zoom };
    }

    pub fn patch_uses(&mut self, patch_json: &str) -> Result<(), JsValue> {
        self.compositor.patch(parse_patch(patch_json).map_err(failed)?, &self.library);
        Ok(())
    }

    pub fn set_overlay(&mut self, items_json: &str) -> Result<(), JsValue> {
        self.compositor.set_overlay(parse_overlay(items_json).map_err(failed)?);
        Ok(())
    }

    pub fn frame(&mut self, now_ms: f64) -> Result<String, JsValue> {
        let mut painter = GpuPainter { device: &self.device, queue: &self.queue, surface: &self.surface, format: self.format, engine: &mut self.engine, pictures: &self.pictures, cached: &mut self.cached, limits: self.limits, retained: &mut self.retained, spare: &mut self.spare, reprojector: &mut self.reprojector };
        let frame = self.compositor.frame(&mut painter, &mut self.library, self.camera, now_ms, &mut js_sys::Date::now)?;
        self.pending = frame.pending;
        Ok(frame.report())
    }

    pub fn cache_pending(&self) -> bool {
        self.pending
    }

    pub fn cache_bytes(&self) -> f64 {
        self.library.cache_bytes() as f64
    }

    pub fn draw(&mut self, list_json: &str) -> Result<String, JsValue> {
        let plan = self.library.plan(&parse(list_json).map_err(failed)?, self.limits);
        self.pending = plan.pending;
        let (list, missing) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), v.clone())).collect();
        let view = self.target.create_view(&wgpu::TextureViewDescriptor::default());
        let skipped = self.engine.draw(&self.device, &self.queue, &list, &pictures, &view).map_err(failed)?;
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err(failed("no surface texture")),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.blitter.copy(&self.device, &mut encoder, &view, &out);
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(report(&[skipped, missing].concat()))
    }
}
