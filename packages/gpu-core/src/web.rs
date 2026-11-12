use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use vello::wgpu;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap};

use vello::kurbo::Rect;

use crate::compositor::{Compositor, Painter};
use crate::display_list::{parse, parse_packed, parse_splice};
use crate::engine::Engine;
use crate::filter_passes::layer_texture;
use crate::groups::{report, Library, Limits, Motion, Plan};
use crate::pictures::Pictures;
use crate::reproject::{Draw, Output, Reprojector, Tile};
use crate::retained::{Camera, Damage, Lookup, Quality};
use crate::tiles::{split_render, Piece, Rendered, Building, NEAR_STEPS, Drawn, path_for, Moment, Path, Warmup, tiles_kept, TILE_BUDGET_BYTES, TILE_GUTTER_PX, batches, bake_batches, step_of, step_zoom, Batch, Rest, RasterCredit, TileKey, Tiles, TILE_PX};
use crate::world::{parse_overlay, parse_patch, OverlayPart};
use crate::texture_budget::split;
use crate::tally::now_ms;
use crate::Skipped;

const CACHE_SIDE: u32 = 4096;
const RASTERS_PER_DRAW: usize = 1;
const POSTER_RASTERS: usize = 64;
const POSTER_BYTES: u32 = 4;
const RGBA_BYTES: f64 = 4.0;
const POSTER_ROW_ALIGN: u32 = 256;
const ITEMS_PER_RASTER: usize = 48;
const FRAMES_IN_FLIGHT: u32 = 1;
const GESTURE_RASTER_EVERY_MS: f64 = 80.0;

const UNMOVED: Lookup = Lookup { scale: 1.0, x: 0.0, y: 0.0 };

const NOT_TIMED: u64 = u64::MAX;
const TILE_BUDGET_GESTURE_MS: f64 = 4.0;
const TILE_BUDGET_STILL_MS: f64 = 12.0;
const SPARE_TILES: usize = 32;
const REST_AFTER_MS: f64 = 200.0;
const EVICT_DOWN_TO_PERCENT: usize = 90;

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
    warming: bool,
    scratch: Option<wgpu::Texture>,
    motion: CoreMotion,
    rastered_at: f64,
    gpu_full_ms: Arc<AtomicU64>,
    tiled: bool,
    overlay_tex: Option<wgpu::Texture>,
    tiles: Tiles,
    tile_textures: HashMap<TileKey, wgpu::Texture>,
    spare_tiles: Vec<wgpu::Texture>,
    atlases: HashMap<(u32, u32), wgpu::Texture>,
    rest: Option<Rest>,
    adopted: Option<Camera>,
    drew_tiles: bool,
    warmup: Warmup,
    tile_budget: u64,
    snapshots: HashMap<String, Snapshot>,
    changed_at: f64,
    credit: RasterCredit,
    rest_shown: Vec<(Rect, wgpu::Texture)>,
    rest_spare: HashMap<(u32, u32), Vec<wgpu::Texture>>,
    counted: Counted,
}

#[derive(Default)]
struct Counted {
    bakes: u32,
    ms: f64,
    upload_bytes: f64,
    unsharp: u32,
    uncovered: u32,
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

fn input_pending() -> bool {
    let global = js_sys::global();
    let call = || -> Option<bool> {
        let navigator = js_sys::Reflect::get(&global, &"navigator".into()).ok()?;
        let scheduling = js_sys::Reflect::get(&navigator, &"scheduling".into()).ok()?;
        let pending: js_sys::Function = js_sys::Reflect::get(&scheduling, &"isInputPending".into()).ok()?.dyn_into().ok()?;
        pending.call0(&scheduling).ok()?.as_bool()
    };
    call().unwrap_or(false)
}

fn placed<'a>(key: TileKey, source: &'a wgpu::Texture, c: Camera, clip: Rect) -> Option<Tile<'a>> {
    let on = key.screen(c);
    let within = Rect::new(on.x0.floor(), on.y0.floor(), on.x1.ceil(), on.y1.ceil()).intersect(clip);
    if within.area() <= 0.0 {
        return None;
    }
    let zoom = step_zoom(key.step);
    let world = key.world();
    let gutter = TILE_GUTTER_PX as f64;
    Some(Tile { source, look: Lookup { scale: zoom / c.zoom, x: (-c.x / c.zoom - world.x0) * zoom + gutter, y: (-c.y / c.zoom - world.y0) * zoom + gutter }, within })
}

struct Snapshot {
    rest: Rect,
    by: (f64, f64),
    tiles: Vec<(TileKey, wgpu::Texture)>,
}

fn tile_texture(device: &wgpu::Device, side: u32) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width: side, height: side, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::COPY_SRC,
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
        Ok(WebCore { device, queue, surface, format, engine, target, pictures: Pictures::new(), textures: HashMap::new(), arriving: HashMap::new(), library, cached: Pictures::new(), limits, pending: false, compositor, camera, retained, spare, reprojector, lost, in_flight: Arc::new(AtomicU32::new(0)), warming: false, scratch: None, motion: CoreMotion::Still, rastered_at: f64::NEG_INFINITY, gpu_full_ms: Arc::new(AtomicU64::new(NOT_TIMED)), tiled: false, overlay_tex: None, tiles: Tiles::default(), tile_textures: HashMap::new(), spare_tiles: Vec::new(), atlases: HashMap::new(), rest: None, adopted: None, drew_tiles: false, warmup: Warmup::default(), tile_budget: TILE_BUDGET_BYTES, snapshots: HashMap::new(), changed_at: f64::NEG_INFINITY, rest_shown: Vec::new(), rest_spare: HashMap::new(), counted: Counted::default(), credit: RasterCredit::default() })
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        let source = external(source)?;
        let fits = self.textures.get(clip).is_some_and(|t| t.width() == width && t.height() == height);
        if !fits {
            self.release(clip);
            let texture = upload_target(&self.device, width, height);
            self.pictures.insert(clip.into(), self.engine.vello.register_texture(texture.clone()));
            self.textures.insert(clip.into(), texture);
        }
        copy_rows(&self.queue, source, &self.textures[clip], 0, height);
        self.counted.upload_bytes += f64::from(width) * f64::from(height) * RGBA_BYTES;
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        self.compositor.touch_picture(clip, &self.library);
        Ok(())
    }

    pub fn picture_rows(&mut self, clip: &str, source: JsValue, width: u32, height: u32, top: u32, rows: u32) -> Result<bool, JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        let source = external(source)?;
        if top == 0 {
            self.arriving.insert(clip.into(), upload_target(&self.device, width, height));
        }
        let texture = self.arriving.get(clip).filter(|t| t.width() == width && t.height() == height && top < height).ok_or_else(|| failed("picture rows out of order"))?;
        let rows = rows.min(height - top);
        copy_rows(&self.queue, source, texture, top, rows);
        self.counted.upload_bytes += f64::from(width) * f64::from(rows) * RGBA_BYTES;
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
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group(&mut self, key: &str, list_json: &[u8]) -> Result<(), JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        self.library.append_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn put_group_packed(&mut self, key: &str, list_json: &[u8], floats: Vec<f64>, ends: Vec<u32>) -> Result<(), JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse_packed(utf8(list_json)?, floats, ends).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group_packed(&mut self, key: &str, list_json: &[u8], floats: Vec<f64>, ends: Vec<u32>) -> Result<(), JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        self.library.append_group(key, &parse_packed(utf8(list_json)?, floats, ends).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn patch_group(&mut self, from: &str, to: &str, splice_json: &[u8]) -> Result<bool, JsValue> {
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(to, &self.library);
        let patched = self.library.patch_group(from, to, &parse_splice(utf8(splice_json)?).map_err(failed)?);
        self.compositor.touch(to, &self.library);
        Ok(patched)
    }

    pub fn drop_group(&mut self, key: &str) {
        self.compositor.drop_group(key, &mut self.library);
    }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera = Camera { x, y, zoom };
    }

    pub fn patch_uses(&mut self, patch_json: &[u8]) -> Result<(), JsValue> {
        let patch = parse_patch(utf8(patch_json)?).map_err(failed)?;
        let patch = if self.tiled { patch.for_tiles() } else { patch };
        self.compositor.patch(patch, &self.library);
        Ok(())
    }

    pub fn set_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.compositor.set_overlay(OverlayPart::Fixed, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        Ok(())
    }

    pub fn set_live_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.compositor.set_overlay(OverlayPart::Live, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        self.changed_at = js_sys::Date::now();
        self.warmup.moved(self.changed_at);
        Ok(())
    }

    pub fn set_motion(&mut self, motion: CoreMotion) {
        if matches!(motion, CoreMotion::Gesture) {
            self.changed_at = js_sys::Date::now();
            self.warmup.moved(self.changed_at);
        }
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

    pub fn set_tile_budget(&mut self, bytes: f64) {
        self.tile_budget = bytes as u64;
    }

    pub fn set_canvas_tiles(&mut self, allowed: u32) {
        self.tiles.set_canvas_tiles(allowed as usize);
    }

    pub fn set_pixel_ratio(&mut self, ratio: f64) {
        self.tiles.set_pixel_ratio(ratio);
    }

    pub fn set_tiles(&mut self, on: bool) {
        self.tiled = on;
    }

    fn fill_pyramid(&mut self) -> Result<bool, JsValue> {
        if let Some(extent) = self.compositor.extent() {
            self.tiles.set_canvas(extent);
        }
        let started = js_sys::Date::now();
        let screen = (self.target.width(), self.target.height());
        let wanted = self.tiles.pyramid(self.camera, screen, tiles_kept(screen, self.tile_budget));
        for batch in bake_batches(&wanted) {
            if js_sys::Date::now() - started > TILE_BUDGET_GESTURE_MS || input_pending() {
                return Ok(true);
            }
            self.raster_batch(&batch)?;
        }
        Ok(false)
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

    fn raster_batch(&mut self, batch: &Batch) -> Result<(), JsValue> {
        let began = now_ms();
        let zoom = step_zoom(batch.step);
        let world = batch.world();
        let gutter = TILE_GUTTER_PX as f64;
        let camera = Camera { x: -world.x0 * zoom + gutter, y: -world.y0 * zoom + gutter, zoom };
        let (cols, rows) = batch.span();
        let size = (cols * TILE_PX + 2 * TILE_GUTTER_PX, rows * TILE_PX + 2 * TILE_GUTTER_PX);
        let mut drawn: Vec<(Piece, wgpu::Texture)> = Vec::new();
        let mut lacking = false;
        let mut failure = None;
        let kept = split_render(size, |piece| match self.raster_piece(camera, piece, size) {
            Ok((rendered, short, texture)) => {
                lacking |= short;
                drawn.push((piece, texture));
                rendered
            }
            Err(e) => {
                failure.get_or_insert(e);
                Rendered { fullness: 0.0 }
            }
        });
        let (pieces, dropped): (Vec<_>, Vec<_>) = drawn.into_iter().partition(|(piece, _)| kept.contains(piece));
        dropped.into_iter().for_each(|(piece, texture)| self.recycle(piece, size, texture));
        if let Some(e) = failure {
            pieces.into_iter().for_each(|(piece, texture)| self.recycle(piece, size, texture));
            return Err(e);
        }
        let corner = batch.corner();
        let side = TILE_PX + 2 * TILE_GUTTER_PX;
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        for key in &batch.keys {
            if lacking && self.tile_textures.contains_key(key) {
                continue;
            }
            if lacking && !self.tiles.hold_lacking(*key) {
                continue;
            }
            let texture = self.tile_textures.remove(key).or_else(|| self.spare_tiles.pop()).unwrap_or_else(|| tile_texture(&self.device, side));
            let tile = Piece { x: ((key.tx - corner.tx) as u32) * TILE_PX, y: ((key.ty - corner.ty) as u32) * TILE_PX, w: side, h: side };
            for (piece, source) in &pieces {
                let Some(shared) = tile.overlap(*piece) else { continue };
                encoder.copy_texture_to_texture(texel(source, shared.x - piece.x, shared.y - piece.y), texel(&texture, shared.x - tile.x, shared.y - tile.y), wgpu::Extent3d { width: shared.w, height: shared.h, depth_or_array_layers: 1 });
            }
            self.tile_textures.insert(*key, texture);
            if !lacking {
                self.tiles.hold(*key);
            }
        }
        self.queue.submit([encoder.finish()]);
        pieces.into_iter().for_each(|(piece, texture)| self.recycle(piece, size, texture));
        self.count_bake(began);
        Ok(())
    }

    fn raster_piece(&mut self, camera: Camera, piece: Piece, whole: (u32, u32)) -> Result<(Rendered, bool, wgpu::Texture), JsValue> {
        let size = (piece.w, piece.h);
        let shifted = Camera { x: camera.x - piece.x as f64, y: camera.y - piece.y as f64, zoom: camera.zoom };
        let plan = self.compositor.plan_at(&mut self.library, shifted, size, self.limits);
        let building = plan.pending;
        let (list, missing) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let pooled = if size == whole { self.atlases.remove(&size) } else { None };
        let texture = pooled.unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        let rendered = Rendered { fullness: self.engine.fullness() };
        Ok((rendered, building || !missing.is_empty(), texture))
    }

    fn recycle(&mut self, piece: Piece, whole: (u32, u32), texture: wgpu::Texture) {
        if (piece.w, piece.h) == whole {
            self.atlases.insert(whole, texture);
        } else {
            texture.destroy();
        }
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
        let step = self.tiles.step_for(c);
        let tile_of = |key: &TileKey| placed(*key, self.tile_textures.get(key)?, c, screen);
        let painted = self.compositor.held_painted();
        let covered = |look: Lookup| Rect::new(((painted.x0 - look.x) / look.scale).ceil(), ((painted.y0 - look.y) / look.scale).ceil(), ((painted.x1 - look.x) / look.scale).floor(), ((painted.y1 - look.y) / look.scale).floor()).intersect(screen);
        let underlay = self.compositor.held_look(c).filter(|(_, stretch)| crate::tiles::underlay_shows(*stretch)).map(|(look, _)| Tile { source: &self.retained, look, within: covered(look) }).filter(|t| t.within.area() > 0.0);
        let still = draw.iter().filter(|k| k.step != step).filter_map(tile_of).chain(underlay).chain(draw.iter().filter(|k| k.step == step).filter_map(tile_of));
        let lifted = self.snapshots.values().flat_map(|shot| {
            let moved = Camera { x: c.x + shot.by.0 * c.zoom, y: c.y + shot.by.1 * c.zoom, zoom: c.zoom };
            let frame = Rect::new(shot.rest.x0 * c.zoom + moved.x, shot.rest.y0 * c.zoom + moved.y, shot.rest.x1 * c.zoom + moved.x, shot.rest.y1 * c.zoom + moved.y).intersect(screen);
            shot.tiles.iter().filter_map(move |(key, source)| placed(*key, source, moved, frame))
        });
        let placed: Vec<Tile> = still.chain(lifted).collect();
        let complete = self.rest.as_ref().is_some_and(Rest::adoptable);
        let exact = self.rest_shown.iter().filter(|_| complete).map(|(block, source)| Tile { source, look: Lookup { scale: 1.0, x: -block.x0, y: -block.y0 }, within: *block });
        let placed: Vec<Tile> = placed.into_iter().chain(exact).collect();
        self.reprojector.draw_tiles(&self.device, &self.queue, &mut encoder, &out, self.format, Output::Premultiplied, &placed);
        if let Some(overlay) = self.overlay_texture()? {
            self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &overlay, target: &out, format: self.format, look: UNMOVED, within: Some(screen), output: Output::Over });
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
        let began = now_ms();
        let (list, _) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let texture = self.overlay_tex.take().filter(|t| t.width() == size.0 && t.height() == size.1).unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        self.count_bake(began);
        Ok(Some(texture))
    }

    fn tiled_frame(&mut self) -> Result<String, JsValue> {
        if self.compositor.stirred() {
            self.changed_at = js_sys::Date::now();
        }
        match self.compositor.take_damage() {
            Damage::Rects(rects) if rects.is_empty() => {}
            Damage::All => {
                self.forget_rest();
                self.changed_at = js_sys::Date::now();
                self.tiles.clear();
            }
            Damage::Rects(rects) => {
                self.forget_rest();
                self.changed_at = js_sys::Date::now();
                rects.iter().for_each(|r| self.tiles.invalidate(*r));
            }
        }
        let screen = (self.target.width(), self.target.height());
        if !self.rest.as_ref().is_some_and(|r| r.shows(self.camera, screen)) {
            self.forget_rest();
        }
        self.snapshot_lifts(screen);
        let budget = if matches!(self.motion, CoreMotion::Gesture) { TILE_BUDGET_GESTURE_MS } else { TILE_BUDGET_STILL_MS };
        let started = js_sys::Date::now();
        let mut rastered = 0;
        let mut queue = self.tiles.queue(self.tiles.frame(self.camera, screen).missing);
        queue.stale.sort_by_key(|k| !self.snapshots.values().any(|shot| k.world().overlaps(shot.rest)));
        let left_blank = queue.blank.clone();
        let order = queue.order();
        let blocks = batches(&order);
        self.credit.earn(budget);
        for batch in blocks {
            if !self.credit.allows() {
                break;
            }
            let began = js_sys::Date::now();
            self.raster_batch(&batch)?;
            self.credit.spend(js_sys::Date::now() - began);
            rastered += batch.keys.len();
        }
        let tiles = self.tiles.frame(self.camera, screen);
        self.counted.unsharp = self.tiles.unsharp(&tiles.missing) as u32;
        let underlaid = self.compositor.held_look(self.camera).is_some_and(|(_, stretch)| crate::tiles::underlay_shows(stretch));
        self.counted.uncovered = if underlaid { 0 } else { left_blank.iter().filter(|k| !self.tiles.holds(**k)).count() as u32 };
        let resting = matches!(self.motion, CoreMotion::Still) && tiles.missing.iter().all(|k| self.tiles.covered_within(*k, NEAR_STEPS)) && js_sys::Date::now() - self.changed_at >= REST_AFTER_MS;
        let mut exact = false;
        if resting {
            exact = self.raster_rest(started, budget, rastered > 0)?;
        }
        self.present_tiles(&tiles.draw)?;
        self.tiles.drawn(&tiles.draw);
        let kept = tiles_kept(screen, self.tile_budget);
        if self.tiles.len() > kept {
            let evicted = self.tiles.evict_beyond(self.camera, screen, kept * EVICT_DOWN_TO_PERCENT / 100);
            self.drop_tiles(evicted);
        }
        let waiting_rest = matches!(self.motion, CoreMotion::Still) && !exact;
        self.pending = waiting_rest || self.compositor.pending_raster();
        if exact {
            self.pending |= self.fill_pyramid()?;
        }
        Ok(if rastered > 0 { "partial".into() } else { "reused".into() })
    }

    fn snapshot_lifts(&mut self, screen: (u32, u32)) {
        let lifts = self.compositor.lifts(&self.library);
        if !lifts.is_empty() {
            self.changed_at = js_sys::Date::now();
        }
        let gone: Vec<String> = self.snapshots.keys().filter(|clip| !lifts.iter().any(|l| &l.clip == *clip)).cloned().collect();
        for clip in gone {
            let shot = self.snapshots.remove(&clip).expect("listed");
            self.spare_tiles.extend(shot.tiles.into_iter().map(|(_, t)| t));
        }
        let side = TILE_PX + 2 * TILE_GUTTER_PX;
        let mut shown: Option<Vec<TileKey>> = None;
        for lift in lifts {
            if let Some(shot) = self.snapshots.get_mut(&lift.clip) {
                shot.by = lift.by;
                continue;
            }
            let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
            let shown = shown.get_or_insert_with(|| self.tiles.frame(self.camera, screen).draw);
            let tiles: Vec<(TileKey, wgpu::Texture)> = shown.iter().filter(|k| k.world().overlaps(lift.rest)).filter_map(|k| {
                let source = self.tile_textures.get(k)?;
                let copy = self.spare_tiles.pop().unwrap_or_else(|| tile_texture(&self.device, side));
                encoder.copy_texture_to_texture(texel(source, 0, 0), texel(&copy, 0, 0), wgpu::Extent3d { width: side, height: side, depth_or_array_layers: 1 });
                Some((*k, copy))
            }).collect();
            self.queue.submit([encoder.finish()]);
            self.snapshots.insert(lift.clip, Snapshot { rest: lift.rest, by: lift.by, tiles });
        }
    }

    fn forget_rest(&mut self) {
        self.rest = None;
        for (_, texture) in self.rest_shown.drain(..) {
            self.rest_spare.entry((texture.width(), texture.height())).or_default().push(texture);
        }
    }

    fn raster_rest(&mut self, started: f64, budget: f64, spent: bool) -> Result<bool, JsValue> {
        let screen = (self.target.width(), self.target.height());
        if self.rest.as_ref().is_some_and(|r| r.todo().is_empty() && !r.adoptable()) {
            self.forget_rest();
        }
        if self.rest.is_none() {
            self.rest = Some(Rest::new(self.camera, screen));
        }
        let mut spent = spent;
        loop {
            if spent && js_sys::Date::now() - started > budget {
                return Ok(false);
            }
            let Some(block) = self.rest.as_mut().and_then(Rest::next) else { return Ok(self.rest.as_ref().is_some_and(Rest::adoptable)) };
            let began = now_ms();
            let size = (block.width() as u32, block.height() as u32);
            let c = Camera { x: self.camera.x.round(), y: self.camera.y.round(), zoom: self.camera.zoom };
            let plan = self.compositor.plan_at(&mut self.library, Camera { x: c.x - block.x0, y: c.y - block.y0, zoom: c.zoom }, size, self.limits);
            let building = plan.pending;
            let (list, missing) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
            let drawn = if building || !missing.is_empty() { Drawn::Lacking } else { Drawn::Whole };
            self.rest.as_mut().expect("rest started").drew(drawn);
            let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
            let texture = self.rest_spare.get_mut(&size).and_then(Vec::pop).unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
            self.engine.draw(&self.device, &self.queue, &list, &pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
            self.rest_shown.push((block, texture));
            self.count_bake(began);
            spent = true;
        }
    }

    pub fn frame(&mut self, now_ms: f64) -> Result<String, JsValue> {
        if self.tiled && self.adopted != Some(self.camera) {
            self.adopted = None;
        }
        let moving = matches!(self.motion, CoreMotion::Gesture);
        let moment = || Moment { gesture: moving, lifting: self.compositor.holding() || !self.compositor.lifts(&self.library).is_empty(), settling: self.adopted.is_none() && self.drew_tiles && self.tiles_show_all() };
        if self.tiled && path_for(moment()) == Path::Tiles {
            self.adopted = None;
            self.drew_tiles = true;
            let report = self.tiled_frame()?;
            if self.rest_done() {
                self.adopt_rest(now_ms);
            }
            return Ok(report);
        }
        self.drew_tiles = false;
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
        self.counted.bakes += frame.rastered as u32;
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
        if moving {
            self.warmup.moved(js_sys::Date::now());
        }
        let building = if self.library.is_building() { Building::Frames } else { Building::Nothing };
        let idle = self.warmup.due_when(js_sys::Date::now(), building);
        let coarse = building == Building::Nothing && self.warmup.coarse_due(js_sys::Date::now());
        let mut coarse_left = false;
        if self.tiled && !frame.pending && idle {
            self.warm_tiles()?;
        } else if self.tiled && !frame.pending && coarse {
            coarse_left = self.fill_pyramid()?;
        }
        self.warming = self.tiled && building == Building::Nothing && (!idle || coarse_left);
        Ok(frame.report())
    }

    fn tiles_show_all(&self) -> bool {
        let queue = self.tiles.queue(self.tiles.frame(self.camera, (self.target.width(), self.target.height())).missing);
        queue.blank.is_empty()
    }

    fn rest_done(&self) -> bool {
        self.rest.as_ref().is_some_and(|r| r.shows(self.camera, (self.target.width(), self.target.height())) && r.adoptable())
    }

    fn adopt_rest(&mut self, now_ms: f64) {
        let o = self.compositor.retained_overscan();
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        for (block, texture) in &self.rest_shown {
            let at = (block.x0 as u32 + o, block.y0 as u32 + o);
            encoder.copy_texture_to_texture(texel(texture, 0, 0), texel(&self.retained, at.0, at.1), wgpu::Extent3d { width: texture.width(), height: texture.height(), depth_or_array_layers: 1 });
        }
        self.queue.submit([encoder.finish()]);
        self.compositor.adopt(self.camera, now_ms);
        self.adopted = Some(self.camera);
        self.drew_tiles = false;
        self.forget_rest();
    }

    fn warm_tiles(&mut self) -> Result<(), JsValue> {
        match self.compositor.take_tile_damage() {
            Damage::All => self.tiles.clear(),
            Damage::Rects(rects) => rects.iter().for_each(|r| self.tiles.invalidate(*r)),
        }
        let screen = (self.target.width(), self.target.height());
        let started = js_sys::Date::now();
        let queue = self.tiles.queue(self.tiles.frame(self.camera, screen).missing);
        let wanted: Vec<TileKey> = queue.blank.into_iter().chain(queue.stale).chain(queue.blurry).collect();
        for batch in bake_batches(&wanted) {
            if js_sys::Date::now() - started > TILE_BUDGET_GESTURE_MS || input_pending() {
                self.pending = true;
                return Ok(());
            }
            self.raster_batch(&batch)?;
        }
        self.pending |= self.fill_pyramid()?;
        Ok(())
    }

    fn count_bake(&mut self, began: f64) {
        self.counted.bakes += 1;
        self.counted.ms += now_ms() - began;
    }

    pub fn frame_counts(&mut self) -> Vec<f64> {
        let planned = self.compositor.take_planned();
        let counted = std::mem::take(&mut self.counted);
        vec![f64::from(planned.plans), f64::from(planned.walked), planned.ms, f64::from(counted.bakes), counted.ms, counted.upload_bytes, f64::from(counted.unsharp), f64::from(counted.uncovered), f64::from(step_of(self.camera.zoom))]
    }
    pub fn warming(&self) -> bool {
        self.warming
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

    pub fn render_tally(&mut self) -> String {
        self.engine.take_tally().json()
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

    pub fn poster(&mut self, group: &str, width: u32, height: u32, scale: f64) -> Result<js_sys::Promise, JsValue> {
        let screen = parse(&format!(r#"{{ "width": {width}, "height": {height}, "background": null, "items": [{{ "kind": "use", "clip": "poster", "group": {group:?}, "matrix": [{scale}, 0, 0, {scale}, 0, 0], "cache": false }}] }}"#)).map_err(failed)?;
        let plan = self.library.plan(&screen, Limits { rasters: POSTER_RASTERS, ..self.limits });
        let (list, _) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), v.clone())).collect();
        let target = layer_texture(&self.device, width, height);
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &target.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        let row = width * POSTER_BYTES;
        let padded = row.div_ceil(POSTER_ROW_ALIGN) * POSTER_ROW_ALIGN;
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor { label: None, size: u64::from(padded * height), usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        encoder.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo { texture: &target, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
            wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(padded), rows_per_image: None } },
            wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
        );
        self.queue.submit([encoder.finish()]);
        Ok(js_sys::Promise::new(&mut |resolve, reject| {
            let mapped = buffer.clone();
            buffer.slice(..).map_async(wgpu::MapMode::Read, move |done| {
                if let Err(e) = done {
                    let _ = reject.call1(&JsValue::NULL, &failed(e));
                    return;
                }
                let pixels: Vec<u8> = match mapped.slice(..).get_mapped_range() {
                    Ok(view) => view.chunks(padded as usize).flat_map(|r| r[..row as usize].iter().copied()).collect(),
                    Err(e) => {
                        let _ = reject.call1(&JsValue::NULL, &failed(e));
                        return;
                    }
                };
                mapped.unmap();
                let _ = resolve.call1(&JsValue::NULL, &js_sys::Uint8Array::from(&pixels[..]));
            });
        }))
    }
}
