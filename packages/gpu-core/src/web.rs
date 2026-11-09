use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use vello::wgpu;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap};

use vello::kurbo::Rect;

use crate::compositor::{Compositor, Painter};
use crate::display_list::{parse, parse_splice};
use crate::engine::Engine;
use crate::filter_passes::layer_texture;
use crate::groups::{report, Library, Limits, Motion, Plan};
use crate::pictures::Pictures;
use crate::reproject::{Draw, Output, Reprojector};
use crate::retained::{Camera, Damage, Lookup, Quality};
use crate::tiles::{step_zoom, TileKey, Tiles, TILE_PX};
use crate::world::{parse_overlay, parse_patch, OverlayPart};
use crate::texture_budget::split;
use crate::Skipped;

const CACHE_SIDE: u32 = 4096;
const RASTERS_PER_DRAW: usize = 1;
const ITEMS_PER_RASTER: usize = 48;
const FRAMES_IN_FLIGHT: u32 = 1;
const GESTURE_RASTER_EVERY_MS: f64 = 80.0;

const UNMOVED: Lookup = Lookup { scale: 1.0, x: 0.0, y: 0.0 };

const NOT_TIMED: u64 = u64::MAX;
const TILE_BUDGET_GESTURE_MS: f64 = 4.0;
const TILE_BUDGET_STILL_MS: f64 = 12.0;
const TILES_KEPT: usize = 320;
const SPARE_TILES: usize = 32;
const TILE_REFINE_EVERY_MS: f64 = 120.0;
const TILE_GUTTER_PX: u32 = 2;

#[wasm_bindgen]
#[derive(Clone, Copy)]
pub enum CoreMotion {
    Still = 0,
    Gesture = 1,
}

impl From<CoreMotion> for Motion {
    fn from(m: CoreMotion) -> Motion {
        match m {
            CoreMotion::Still => Motion::Still,
            CoreMotion::Gesture => Motion::Gesture,
        }
    }
}

#[wasm_bindgen]
pub struct WebCore {
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: wgpu::Surface<'static>,
    format: wgpu::TextureFormat,
    engine: Engine,
    target: wgpu::Texture,
    pictures: Pictures,
    textures: HashMap<String, wgpu::Texture>,
    arriving: HashMap<String, wgpu::Texture>,
    library: Library,
    cached: Pictures,
    limits: Limits,
    pending: bool,
    compositor: Compositor,
    camera: Camera,
    retained: wgpu::Texture,
    spare: wgpu::Texture,
    reprojector: Reprojector,
    lost: Arc<AtomicBool>,
    in_flight: Arc<AtomicU32>,
    scratch: Option<wgpu::Texture>,
    motion: CoreMotion,
    rastered_at: f64,
    gpu_full_ms: Arc<AtomicU64>,
    tiled: bool,
    overlay_tex: Option<wgpu::Texture>,
    exact_shown: bool,
    refined_at: f64,
    tiles: Tiles,
    tile_textures: HashMap<TileKey, wgpu::Texture>,
    spare_tiles: Vec<wgpu::Texture>,
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
    scratch: &'a mut Option<wgpu::Texture>,
}

fn scratch_of<'s>(device: &wgpu::Device, kept: &'s mut Option<wgpu::Texture>, (width, height): (u32, u32)) -> &'s wgpu::Texture {
    if let Some(stale) = kept.take_if(|t| t.width() != width || t.height() != height) {
        stale.destroy();
    }
    kept.get_or_insert_with(|| layer_texture(device, width, height))
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
        let scratch = scratch_of(self.device, self.scratch, (list.width.max(1), list.height.max(1)));
        let whole = wgpu::TextureViewDescriptor::default();
        let skipped = self.engine.draw(self.device, self.queue, &list, &pictures, &scratch.create_view(&whole)).map_err(failed)?;
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        match quality {
            Quality::Sharp => encoder.copy_texture_to_texture(texel(&scratch, 0, 0), texel(self.retained, into.x0 as u32, into.y0 as u32), wgpu::Extent3d { width: list.width, height: list.height, depth_or_array_layers: 1 }),
            Quality::Rough => {
                let scale = list.width as f64 / into.width();
                let look = Lookup { scale, x: -into.x0 * scale, y: -into.y0 * scale };
                let target = self.retained.create_view(&wgpu::TextureViewDescriptor::default());
                self.reprojector.draw(self.device, self.queue, &mut encoder, Draw { source: &scratch, target: &target, format: wgpu::TextureFormat::Rgba8Unorm, look, within: Some(into), output: Output::Straight });
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
        self.reprojector.draw(self.device, self.queue, &mut encoder, Draw { source: self.retained, target: &out, format: self.format, look, within: None, output: Output::Premultiplied });
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(())
    }
}

fn utf8(bytes: &[u8]) -> Result<&str, JsValue> {
    std::str::from_utf8(bytes).map_err(failed)
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

fn copy_rows(queue: &wgpu::Queue, source: wgpu::ExternalImageSource, texture: &wgpu::Texture, top: u32, rows: u32) {
    queue.copy_external_image_to_texture(
        &wgpu::CopyExternalImageSourceInfo { source, origin: wgpu::Origin2d { x: 0, y: top }, flip_y: false },
        wgpu::CopyExternalImageDestInfo { texture, mip_level: 0, origin: wgpu::Origin3d { x: 0, y: top, z: 0 }, aspect: wgpu::TextureAspect::All, color_space: wgpu::PredefinedColorSpace::Srgb, premultiplied_alpha: false },
        wgpu::Extent3d { width: texture.width(), height: rows, depth_or_array_layers: 1 },
    );
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
        let lost = Arc::new(AtomicBool::new(false));
        let flag = lost.clone();
        device.set_device_lost_callback(move |_, _| flag.store(true, Ordering::Relaxed));
        let format = surface.get_capabilities(&adapter).formats.into_iter().find(|f| !f.is_srgb()).ok_or_else(|| failed("no linear surface format"))?;
        surface.configure(&device, &wgpu::SurfaceConfiguration { usage: wgpu::TextureUsages::RENDER_ATTACHMENT, format, width, height, present_mode: wgpu::PresentMode::Fifo, alpha_mode: wgpu::CompositeAlphaMode::PreMultiplied, view_formats: vec![], desired_maximum_frame_latency: 2, color_space: wgpu::SurfaceColorSpace::Auto });
        let engine = Engine::new(&device).map_err(failed)?;
        let mut library = Library::new();
        library.compose_encodings();
        let target = storage(&device, width, height);
        let limits = Limits { side: CACHE_SIDE.min(device.limits().max_texture_dimension_2d), rasters: RASTERS_PER_DRAW, items: ITEMS_PER_RASTER };
        let compositor = Compositor::new(width, height);
        let retained = held_texture(&device, compositor.size());
        let spare = held_texture(&device, compositor.size());
        let reprojector = Reprojector::new(&device);
        let camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
        Ok(WebCore { device, queue, surface, format, engine, target, pictures: Pictures::new(), textures: HashMap::new(), arriving: HashMap::new(), library, cached: Pictures::new(), limits, pending: false, compositor, camera, retained, spare, reprojector, lost, in_flight: Arc::new(AtomicU32::new(0)), scratch: None, motion: CoreMotion::Still, rastered_at: f64::NEG_INFINITY, gpu_full_ms: Arc::new(AtomicU64::new(NOT_TIMED)), tiled: false, overlay_tex: None, exact_shown: false, refined_at: f64::NEG_INFINITY, tiles: Tiles::default(), tile_textures: HashMap::new(), spare_tiles: Vec::new() })
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        let source = external(source)?;
        let fits = self.textures.get(clip).is_some_and(|t| t.width() == width && t.height() == height);
        if !fits {
            self.release(clip);
            let texture = upload_target(&self.device, width, height);
            self.pictures.insert(clip.into(), self.engine.vello.register_texture(texture.clone()));
            self.textures.insert(clip.into(), texture);
        }
        copy_rows(&self.queue, source, &self.textures[clip], 0, height);
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        self.compositor.touch_picture(clip, &self.library);
        Ok(())
    }

    pub fn picture_rows(&mut self, clip: &str, source: JsValue, width: u32, height: u32, top: u32, rows: u32) -> Result<bool, JsValue> {
        let source = external(source)?;
        if top == 0 {
            self.arriving.insert(clip.into(), upload_target(&self.device, width, height));
        }
        let texture = self.arriving.get(clip).filter(|t| t.width() == width && t.height() == height && top < height).ok_or_else(|| failed("picture rows out of order"))?;
        let rows = rows.min(height - top);
        copy_rows(&self.queue, source, texture, top, rows);
        if top + rows < height {
            return Ok(false);
        }
        let texture = self.arriving.remove(clip).expect("arriving picture");
        self.release(clip);
        self.pictures.insert(clip.into(), self.engine.vello.register_texture(texture.clone()));
        self.textures.insert(clip.into(), texture);
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        self.compositor.touch_picture(clip, &self.library);
        Ok(true)
    }

    pub fn forget_picture(&mut self, clip: &str) {
        self.release(clip);
        if let Some(texture) = self.arriving.remove(clip) {
            texture.destroy();
        }
        self.compositor.touch_picture(clip, &self.library);
    }

    fn release(&mut self, clip: &str) {
        if let Some(old) = self.pictures.remove(clip) {
            self.engine.vello.unregister_texture(old);
        }
        if let Some(texture) = self.textures.remove(clip) {
            texture.destroy();
        }
    }

    pub fn picture_bytes(&self) -> f64 {
        self.textures.values().map(|t| t.width() as f64 * t.height() as f64 * 4.0).sum()
    }

    pub fn busy(&self) -> bool {
        self.in_flight.load(Ordering::Relaxed) >= FRAMES_IN_FLIGHT
    }

    pub fn lost(&self) -> bool {
        self.lost.load(Ordering::Relaxed)
    }

    pub fn put_group(&mut self, key: &str, list_json: &[u8]) -> Result<(), JsValue> {
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group(&mut self, key: &str, list_json: &[u8]) -> Result<(), JsValue> {
        self.library.append_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn patch_group(&mut self, from: &str, to: &str, splice_json: &[u8]) -> Result<bool, JsValue> {
        self.compositor.touch(to, &self.library);
        let patched = self.library.patch_group(from, to, &parse_splice(utf8(splice_json)?).map_err(failed)?);
        self.compositor.touch(to, &self.library);
        Ok(patched)
    }

    pub fn drop_group(&mut self, key: &str) {
        self.compositor.touch(key, &self.library);
        self.library.drop_group(key);
    }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera = Camera { x, y, zoom };
    }

    pub fn patch_uses(&mut self, patch_json: &[u8]) -> Result<(), JsValue> {
        let patch = parse_patch(utf8(patch_json)?).map_err(failed)?;
        let patch = if self.tiled { patch.uncached() } else { patch };
        self.compositor.patch(patch, &self.library);
        Ok(())
    }

    pub fn set_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.compositor.set_overlay(OverlayPart::Fixed, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        Ok(())
    }

    pub fn set_live_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.compositor.set_overlay(OverlayPart::Live, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        Ok(())
    }

    pub fn set_motion(&mut self, motion: CoreMotion) {
        self.motion = motion;
        self.library.set_motion(motion.into());
    }

    pub fn set_budget(&mut self, bytes: f64) {
        let share = split(bytes as u64, self.compositor.size());
        self.library.set_budget(share.cache);
        self.engine.set_budget(share.pool, share.layers);
    }

    fn frame_limits(&self, now_ms: f64) -> Limits {
        let waiting = matches!(self.motion, CoreMotion::Gesture) && !self.library.is_building() && now_ms - self.rastered_at < GESTURE_RASTER_EVERY_MS;
        Limits { rasters: if waiting { 0 } else { self.limits.rasters }, ..self.limits }
    }

    pub fn set_tiles(&mut self, on: bool) {
        self.tiled = on;
    }

    fn fill_reserve(&mut self) -> Result<bool, JsValue> {
        let started = js_sys::Date::now();
        let reserve = self.tiles.reserve(self.camera, (self.target.width(), self.target.height()));
        for key in &reserve {
            if js_sys::Date::now() - started > TILE_BUDGET_GESTURE_MS {
                return Ok(true);
            }
            self.raster_tile(*key)?;
        }
        Ok(false)
    }

    fn settled(&self) -> bool {
        matches!(self.motion, CoreMotion::Still) && self.tiles.frame(self.camera, (self.target.width(), self.target.height())).missing.is_empty()
    }

    fn drop_tiles(&mut self, gone: Vec<TileKey>) {
        for key in gone {
            if let Some(texture) = self.tile_textures.remove(&key) {
                if self.spare_tiles.len() < SPARE_TILES {
                    self.spare_tiles.push(texture);
                } else {
                    texture.destroy();
                }
            }
        }
    }

    fn raster_tile(&mut self, key: TileKey) -> Result<(), JsValue> {
        let zoom = step_zoom(key.step);
        let world = key.world();
        let gutter = TILE_GUTTER_PX as f64;
        let camera = Camera { x: -world.x0 * zoom + gutter, y: -world.y0 * zoom + gutter, zoom };
        let side = TILE_PX + 2 * TILE_GUTTER_PX;
        let plan = self.compositor.plan_at(&mut self.library, camera, (side, side), self.limits);
        let (list, _) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let texture = self.spare_tiles.pop().unwrap_or_else(|| layer_texture(&self.device, side, side));
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        self.tile_textures.insert(key, texture);
        self.tiles.hold(key);
        Ok(())
    }

    fn present_tiles(&mut self, draw: &[TileKey]) -> Result<(), JsValue> {
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err(failed("no surface texture")),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let screen = Rect::new(0.0, 0.0, self.target.width() as f64, self.target.height() as f64);
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        drop(encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment { view: &out, depth_slice: None, resolve_target: None, ops: wgpu::Operations { load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT), store: wgpu::StoreOp::Store } })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        }));
        let c = self.camera;
        for key in draw {
            let Some(source) = self.tile_textures.get(key) else { continue };
            let on = key.screen(c);
            let within = Rect::new(on.x0.floor(), on.y0.floor(), on.x1.ceil(), on.y1.ceil()).intersect(screen);
            if within.area() <= 0.0 {
                continue;
            }
            let zoom = step_zoom(key.step);
            let world = key.world();
            let gutter = TILE_GUTTER_PX as f64;
            let look = Lookup { scale: zoom / c.zoom, x: (-c.x / c.zoom - world.x0) * zoom + gutter, y: (-c.y / c.zoom - world.y0) * zoom + gutter };
            self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source, target: &out, format: self.format, look, within: Some(within), output: Output::Premultiplied });
            self.queue.submit([std::mem::replace(&mut encoder, self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default())).finish()]);
        }
        if let Some(overlay) = self.overlay_texture()? {
            self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &overlay, target: &out, format: self.format, look: UNMOVED, within: Some(screen), output: Output::Premultiplied });
            self.overlay_tex = Some(overlay);
        }
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(())
    }

    fn overlay_texture(&mut self) -> Result<Option<wgpu::Texture>, JsValue> {
        let size = (self.target.width(), self.target.height());
        let plan = self.compositor.overlay_at(&mut self.library, self.camera, size, self.limits);
        if plan.screen.items.is_empty() {
            return Ok(None);
        }
        let (list, _) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let texture = self.overlay_tex.take().filter(|t| t.width() == size.0 && t.height() == size.1).unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        Ok(Some(texture))
    }

    fn tiled_frame(&mut self, now_ms: f64) -> Result<String, JsValue> {
        let gone = match self.compositor.take_damage() {
            Damage::All => self.tiles.clear(),
            Damage::Rects(rects) => rects.iter().flat_map(|r| self.tiles.invalidate(*r)).collect(),
        };
        self.drop_tiles(gone);
        let screen = (self.target.width(), self.target.height());
        let budget = if matches!(self.motion, CoreMotion::Gesture) { TILE_BUDGET_GESTURE_MS } else { TILE_BUDGET_STILL_MS };
        let started = js_sys::Date::now();
        let mut rastered = 0;
        let gesture = matches!(self.motion, CoreMotion::Gesture);
        let refine = !gesture || now_ms - self.refined_at >= TILE_REFINE_EVERY_MS;
        for key in self.tiles.frame(self.camera, screen).missing {
            let blank = !self.tiles.covered(key);
            if (rastered > 0 && js_sys::Date::now() - started > budget) || !(blank || refine) {
                continue;
            }
            self.raster_tile(key)?;
            rastered += 1;
        }
        if rastered > 0 {
            self.refined_at = now_ms;
        }
        let tiles = self.tiles.frame(self.camera, screen);
        self.present_tiles(&tiles.draw)?;
        let evicted = self.tiles.evict_beyond(self.camera, screen, TILES_KEPT);
        self.drop_tiles(evicted);
        self.pending = !tiles.missing.is_empty() || self.compositor.pending_raster();
        Ok(if rastered > 0 { "partial".into() } else { "reused".into() })
    }

    pub fn frame(&mut self, now_ms: f64) -> Result<String, JsValue> {
        if self.tiled && !self.settled() {
            self.exact_shown = false;
            return self.tiled_frame(now_ms);
        }
        if self.tiled && !self.exact_shown {
            self.exact_shown = true;
            self.compositor.forget();
        }
        let limits = self.frame_limits(now_ms);
        let mut painter = GpuPainter { device: &self.device, queue: &self.queue, surface: &self.surface, format: self.format, engine: &mut self.engine, pictures: &self.pictures, cached: &mut self.cached, limits, retained: &mut self.retained, spare: &mut self.spare, reprojector: &mut self.reprojector, scratch: &mut self.scratch };
        let timed = self.gpu_full_ms.swap(NOT_TIMED, Ordering::Relaxed);
        if timed != NOT_TIMED {
            self.compositor.gpu_took(f64::from_bits(timed));
        }
        let frame = self.compositor.frame(&mut painter, &mut self.library, self.camera, now_ms, &mut js_sys::Date::now)?;
        if frame.rastered > 0 {
            self.rastered_at = now_ms;
        }
        self.pending = frame.pending;
        self.in_flight.fetch_add(1, Ordering::Relaxed);
        let done = self.in_flight.clone();
        let full = frame.sharp_full.then(|| (self.gpu_full_ms.clone(), js_sys::Date::now()));
        self.queue.on_submitted_work_done(move || {
            done.fetch_sub(1, Ordering::Relaxed);
            if let Some((cost, started)) = &full {
                cost.store((js_sys::Date::now() - started).to_bits(), Ordering::Relaxed);
            }
        });
        if self.tiled {
            self.pending |= self.fill_reserve()?;
        }
        Ok(frame.report())
    }

    pub fn cache_pending(&self) -> bool {
        self.pending
    }

    pub fn cache_bytes(&self) -> f64 {
        self.library.cache_bytes() as f64
    }

    pub fn scratch_bytes(&self) -> f64 {
        self.engine.scratch_bytes() as f64
    }

    pub fn draw(&mut self, list_json: &[u8]) -> Result<String, JsValue> {
        let plan = self.library.plan(&parse(utf8(list_json)?).map_err(failed)?, self.limits);
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
        self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &self.target, target: &out, format: self.format, look: UNMOVED, within: None, output: Output::Premultiplied });
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(report(&[skipped, missing].concat()))
    }
}
