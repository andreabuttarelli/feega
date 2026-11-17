use rustc_hash::FxHashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use vello::wgpu;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap};

use vello::kurbo::Rect;

use crate::compositor::{Compositor, Painter};
use crate::display_list::{parse, parse_packed, parse_splice};
use crate::engine::{Engine, HeldScene};
use crate::held_view::HeldView;
use crate::filter_passes::layer_texture;
use crate::groups::{report, Library, Limits, Motion, Native, Plan};
use crate::layers::Effects;
use crate::pictures::Pictures;
use crate::reproject::{Draw, Output, Reprojector, Tile, OPAQUE};
use crate::retained::{Camera, Damage, Lookup, Quality};
use crate::tiles::{split_render, Piece, Rendered, Building, NEAR_STEPS, Drawn, path_for, GestureDraw, Moment, Path, Warmup, tiles_kept_beside, TILE_BUDGET_BYTES, TILE_BYTES, TILE_GUTTER_PX, batches, batches_of, bake_batches, step_of, step_zoom, Batch, Rest, RasterCredit, TileKey, Tiles, TILE_PX, lifted_keys, magnified, fallback_serves, fallback_bands, ahead_camera, fade_in, fades_over, FADE_MS};
use crate::overlay_kept::{Moving, OverlayDrawn, OverlayKept, OverlayKey, OverlayQuality};
use crate::overlay_seen::OverlaySeen;
use crate::screen_fit::{fit, screen_side};
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
const FALLBACK_FLOORS: crate::lod::Floors = crate::lod::Floors { text: 3.0, effects: 10.0 };
const FALLBACK_PATCHES: usize = 8;
const AHEAD_BUDGET_MS: f64 = 6.0;
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
    textures: FxHashMap<String, wgpu::Texture>,
    arriving: FxHashMap<String, wgpu::Texture>,
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
    warm_wait: f64,
    scratch: Option<wgpu::Texture>,
    motion: CoreMotion,
    rastered_at: f64,
    gpu_full_ms: Arc<AtomicU64>,
    tiled: bool,
    overlay_seen: OverlaySeen,
    overlay_tex: Option<wgpu::Texture>,
    overlay_kept: OverlayKept,
    tiles: Tiles,
    tile_textures: FxHashMap<TileKey, wgpu::Texture>,
    spare_tiles: Vec<wgpu::Texture>,
    atlases: FxHashMap<(u32, u32), wgpu::Texture>,
    rest: Option<Rest>,
    adopted: Option<Camera>,
    drew_tiles: bool,
    warmup: Warmup,
    tile_budget: u64,
    lifted: Vec<(String, Lifted)>,
    changed_at: f64,
    credit: RasterCredit,
    was: Camera,
    rest_shown: Vec<(Rect, wgpu::Texture)>,
    rest_spare: FxHashMap<(u32, u32), Vec<wgpu::Texture>>,
    counted: Counted,
    sharpness: Sharpness,
    fallback: Vec<Fallback>,
    ahead: Option<Ahead>,
    fallback_was: Camera,
    born: FxHashMap<TileKey, f64>,
    gesture_draw: GestureDraw,
    direct: Option<wgpu::Texture>,
    held_scene: Option<HeldScreen>,
    scale: f64,
}

struct HeldScreen {
    view: HeldView,
    scene: HeldScene,
    whole: bool,
    background: Option<crate::display_list::Rgba>,
}

#[derive(Default)]
struct Counted {
    bakes: u32,
    ms: f64,
    upload_bytes: f64,
    unsharp: u32,
    uncovered: u32,
    tiles: u32,
    uploads: u32,
    fallback_ms: f64,
    exact: bool,
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
    Some(Tile { source, look: Lookup { scale: zoom / c.zoom, x: (-c.x / c.zoom - world.x0) * zoom + gutter, y: (-c.y / c.zoom - world.y0) * zoom + gutter }, within, opacity: OPAQUE })
}

struct Ahead {
    camera: Camera,
    size: (u32, u32),
    pieces: Vec<(Piece, wgpu::Texture)>,
    todo: Vec<Rect>,
}

struct Fallback {
    camera: Camera,
    size: (u32, u32),
    pieces: Vec<(Piece, wgpu::Texture)>,
    todo: Vec<Rect>,
}

impl Fallback {
    fn destroy(self) {
        self.pieces.into_iter().for_each(|(_, texture)| texture.destroy());
    }

    fn tiles(&self, c: Camera, screen: Rect) -> Vec<Tile<'_>> {
        let scale = self.camera.zoom / c.zoom;
        self.pieces.iter().filter_map(|(piece, source)| {
            let (x, y) = (self.camera.x - c.x * scale - piece.x as f64, self.camera.y - c.y * scale - piece.y as f64);
            let within = Rect::new((-x / scale).ceil(), (-y / scale).ceil(), ((piece.w as f64 - x) / scale).floor(), ((piece.h as f64 - y) / scale).floor()).intersect(screen);
            (within.area() > 0.0).then_some(Tile { source, look: Lookup { scale, x, y }, within, opacity: OPAQUE })
        }).collect()
    }

    fn on(&self, c: Camera) -> Rect {
        let (w, h) = (self.size.0 as f64, self.size.1 as f64);
        let at = |x: f64, y: f64| ((x - self.camera.x) / self.camera.zoom * c.zoom + c.x, (y - self.camera.y) / self.camera.zoom * c.zoom + c.y);
        let ((x0, y0), (x1, y1)) = (at(0.0, 0.0), at(w, h));
        Rect::new(x0, y0, x1, y1)
    }
}

#[derive(Default)]
struct Sharpness {
    magnified_frames: u32,
    fallbacks: u32,
    fallback_ms: f64,
}

impl Sharpness {
    fn json(&mut self, tally: &str) -> String {
        let Sharpness { magnified_frames, fallbacks, fallback_ms } = std::mem::take(self);
        format!(r#"{},"magnified":{{"n":{magnified_frames},"ms":0}},"fallback":{{"n":{fallbacks},"ms":{fallback_ms:.3}}}}}"#, tally.strip_suffix('}').unwrap_or(tally))
    }
}

struct Lifted {
    rest: Rect,
    by: (f64, f64),
    tiles: FxHashMap<TileKey, wgpu::Texture>,
}

#[derive(Clone, Copy)]
enum Source<'a> {
    Scene,
    Alone(&'a str),
}

fn texture_bytes(texture: &wgpu::Texture) -> u64 {
    crate::texture_budget::bytes_of((texture.width(), texture.height()))
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
        let sized = canvas.clone();
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor { backends: wgpu::Backends::BROWSER_WEBGPU, ..wgpu::InstanceDescriptor::new_without_display_handle() });
        let surface = instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas)).map_err(failed)?;
        let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions { compatible_surface: Some(&surface), ..Default::default() }).await.map_err(failed)?;
        let required_limits = wgpu::Limits { max_texture_dimension_2d: adapter.limits().max_texture_dimension_2d, ..wgpu::Limits::default() };
        let (device, queue) = adapter.request_device(&wgpu::DeviceDescriptor { required_limits, ..Default::default() }).await.map_err(failed)?;
        let fitted = fit((width, height), screen_side(device.limits().max_texture_dimension_2d));
        let (width, height) = fitted.size;
        sized.set_width(width);
        sized.set_height(height);
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
        Ok(WebCore { device, queue, surface, format, engine, target, pictures: Pictures::default(), textures: FxHashMap::default(), arriving: FxHashMap::default(), library, cached: Pictures::default(), limits, pending: false, compositor, camera, retained, spare, reprojector, lost, in_flight: Arc::new(AtomicU32::new(0)), warming: false, warm_wait: 0.0, scratch: None, motion: CoreMotion::Still, rastered_at: f64::NEG_INFINITY, gpu_full_ms: Arc::new(AtomicU64::new(NOT_TIMED)), tiled: false, overlay_tex: None, overlay_kept: OverlayKept::default(), overlay_seen: OverlaySeen::default(), tiles: Tiles::default(), tile_textures: FxHashMap::default(), spare_tiles: Vec::new(), atlases: FxHashMap::default(), rest: None, adopted: None, drew_tiles: false, warmup: Warmup::default(), tile_budget: TILE_BUDGET_BYTES, lifted: Vec::new(), changed_at: f64::NEG_INFINITY, rest_shown: Vec::new(), rest_spare: FxHashMap::default(), counted: Counted::default(), sharpness: Sharpness::default(), fallback: Vec::new(), ahead: None, fallback_was: camera, born: FxHashMap::default(), credit: RasterCredit::default(), was: Camera { x: 0.0, y: 0.0, zoom: 1.0 }, gesture_draw: GestureDraw::Tiles, direct: None, held_scene: None, scale: fitted.scale })
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        self.overlay_kept.forget();
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
        self.counted.uploads += 1;
        self.counted.upload_bytes += f64::from(width) * f64::from(height) * RGBA_BYTES;
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        self.compositor.touch_picture(clip, &self.library);
        Ok(())
    }

    pub fn picture_rows(&mut self, clip: &str, source: JsValue, width: u32, height: u32, top: u32, rows: u32) -> Result<bool, JsValue> {
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        let source = external(source)?;
        if top == 0 {
            self.arriving.insert(clip.into(), upload_target(&self.device, width, height));
        }
        let texture = self.arriving.get(clip).filter(|t| t.width() == width && t.height() == height && top < height).ok_or_else(|| failed("picture rows out of order"))?;
        let rows = rows.min(height - top);
        copy_rows(&self.queue, source, texture, top, rows);
        self.counted.uploads += 1;
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
        self.overlay_kept.forget();
        self.release(clip);
        if let Some(texture) = self.arriving.remove(clip) {
            texture.destroy();
        }
        self.compositor.touch_picture(clip, &self.library);
    }

    fn release(&mut self, clip: &str) {
        let (Some(image), Some(texture)) = (self.pictures.remove(clip), self.textures.remove(clip)) else { return };
        self.engine.retire(image, texture);
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
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group(&mut self, key: &str, list_json: &[u8]) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        self.library.append_group(key, &parse(utf8(list_json)?).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn put_group_packed(&mut self, key: &str, list_json: &[u8], floats: Vec<f64>, ends: Vec<u32>) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse_packed(utf8(list_json)?, floats, ends).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group_packed(&mut self, key: &str, list_json: &[u8], floats: Vec<f64>, ends: Vec<u32>) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        self.library.append_group(key, &parse_packed(utf8(list_json)?, floats, ends).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn patch_group(&mut self, from: &str, to: &str, splice_json: &[u8]) -> Result<bool, JsValue> {
        self.overlay_kept.forget();
        self.warmup.uploaded(js_sys::Date::now());
        self.compositor.touch(to, &self.library);
        let patched = self.library.patch_group(from, to, &parse_splice(utf8(splice_json)?).map_err(failed)?);
        self.compositor.touch(to, &self.library);
        Ok(patched)
    }

    pub fn drop_group(&mut self, key: &str) {
        self.overlay_kept.forget();
        self.compositor.drop_group(key, &mut self.library);
    }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera = Camera { x: x * self.scale, y: y * self.scale, zoom: zoom * self.scale };
    }

    pub fn patch_uses(&mut self, patch_json: &[u8]) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        let patch = parse_patch(utf8(patch_json)?).map_err(failed)?;
        let patch = if self.tiled { patch.for_tiles() } else { patch };
        self.compositor.patch(patch, &self.library);
        Ok(())
    }

    pub fn set_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        if !self.overlay_seen.is_new(OverlayPart::Fixed, items_json) {
            return Ok(());
        }

        self.compositor.set_overlay(OverlayPart::Fixed, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        Ok(())
    }

    pub fn set_selected_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        if !self.overlay_seen.is_new(OverlayPart::Selected, items_json) {
            return Ok(());
        }

        self.compositor.set_overlay(OverlayPart::Selected, parse_overlay(utf8(items_json)?).map_err(failed)?, &mut self.library);
        Ok(())
    }

    pub fn set_live_overlay(&mut self, items_json: &[u8]) -> Result<(), JsValue> {
        self.overlay_kept.forget();
        if !self.overlay_seen.is_new(OverlayPart::Live, items_json) {
            return Ok(());
        }

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
        self.overlay_kept.forget();
        let share = split(bytes as u64, self.compositor.size());
        self.library.set_budget(share.cache);
        self.engine.set_budget(share.pool, share.layers);
    }

    fn frame_limits(&self, now_ms: f64) -> Limits {
        let waiting = matches!(self.motion, CoreMotion::Gesture) && !self.library.is_building() && now_ms - self.rastered_at < GESTURE_RASTER_EVERY_MS;
        Limits { rasters: if waiting { 0 } else { self.limits.rasters }, ..self.limits }
    }

    pub fn set_effect_budget(&mut self, bytes: f64) {
        self.engine.set_effect_budget(bytes as u64);
    }

    pub fn set_image_atlas(&mut self, side: u32) {
        self.engine.set_image_atlas(side);
    }

    pub fn set_tile_budget(&mut self, bytes: f64) {
        self.tile_budget = bytes as u64;
    }

    pub fn set_canvas_tiles(&mut self, allowed: u32) {
        self.tiles.set_canvas_tiles(allowed as usize);
    }

    pub fn set_pixel_ratio(&mut self, ratio: f64) {
        self.overlay_kept.forget();
        self.tiles.set_pixel_ratio(ratio * self.scale);
        self.compositor.set_pixel_ratio(ratio * self.scale);
    }

    pub fn set_tiles(&mut self, on: bool) {
        self.tiled = on;
    }

    pub fn set_direct_gesture(&mut self, on: bool) {
        self.gesture_draw = if on { GestureDraw::Direct } else { GestureDraw::Tiles };
    }

    fn fill_pyramid(&mut self) -> Result<bool, JsValue> {
        if let Some(extent) = self.compositor.extent() {
            self.tiles.set_canvas(extent);
        }
        let started = js_sys::Date::now();
        let screen = (self.target.width(), self.target.height());
        let wanted = self.tiles.pyramid(self.camera, screen, tiles_kept_beside(screen, self.tile_budget, self.beside_tiles()));
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
            self.born.remove(&key);
            if let Some(texture) = self.tile_textures.remove(&key) {
                self.spare(texture);
            }
        }
    }

    fn beside_tiles(&self) -> u64 {
        let spare = self.spare_tiles.iter();
        let lifted = self.lifted.iter().flat_map(|(_, l)| l.tiles.values());
        let fallback = self.fallback.iter().flat_map(|f| f.pieces.iter().map(|(_, t)| t));
        let ahead = self.ahead.iter().flat_map(|a| a.pieces.iter().map(|(_, t)| t));
        let rest = self.rest_shown.iter().map(|(_, t)| t).chain(self.rest_spare.values().flatten());
        spare.chain(lifted).chain(fallback).chain(ahead).chain(rest).chain(self.atlases.values()).map(texture_bytes).sum()
    }

    fn trim_spares(&mut self) {
        if self.tiles.len() as u64 * TILE_BYTES + self.beside_tiles() <= self.tile_budget {
            return;
        }
        self.spare_tiles.drain(..).for_each(|t| t.destroy());
        self.rest_spare.drain().flat_map(|(_, v)| v).for_each(|t| t.destroy());
        self.atlases.drain().for_each(|(_, t)| t.destroy());
    }

    fn spare(&mut self, texture: wgpu::Texture) {
        if self.spare_tiles.len() < SPARE_TILES {
            self.spare_tiles.push(texture);
        } else {
            texture.destroy();
        }
    }

    fn render_batch(&mut self, batch: &Batch, source: Source) -> Result<(Vec<(Piece, wgpu::Texture)>, bool, (u32, u32)), JsValue> {
        let zoom = step_zoom(batch.step);
        let world = batch.world();
        let gutter = TILE_GUTTER_PX as f64;
        let camera = Camera { x: -world.x0 * zoom + gutter, y: -world.y0 * zoom + gutter, zoom };
        let (cols, rows) = batch.span();
        let size = (cols * TILE_PX + 2 * TILE_GUTTER_PX, rows * TILE_PX + 2 * TILE_GUTTER_PX);
        let (pieces, lacking) = self.render_view(camera, size, source)?;
        Ok((pieces, lacking, size))
    }

    fn render_view(&mut self, camera: Camera, size: (u32, u32), source: Source) -> Result<(Vec<(Piece, wgpu::Texture)>, bool), JsValue> {
        let mut drawn: Vec<(Piece, wgpu::Texture)> = Vec::new();
        let mut lacking = false;
        let mut failure = None;
        let kept = split_render(size, |piece| match self.raster_piece(camera, piece, size, source) {
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
        Ok((pieces, lacking))
    }

    fn cut(&self, encoder: &mut wgpu::CommandEncoder, batch: &Batch, key: TileKey, pieces: &[(Piece, wgpu::Texture)], into: wgpu::Texture) -> wgpu::Texture {
        let corner = batch.corner();
        let side = TILE_PX + 2 * TILE_GUTTER_PX;
        let tile = Piece { x: ((key.tx - corner.tx) as u32) * TILE_PX, y: ((key.ty - corner.ty) as u32) * TILE_PX, w: side, h: side };
        for (piece, source) in pieces {
            let Some(shared) = tile.overlap(*piece) else { continue };
            encoder.copy_texture_to_texture(texel(source, shared.x - piece.x, shared.y - piece.y), texel(&into, shared.x - tile.x, shared.y - tile.y), wgpu::Extent3d { width: shared.w, height: shared.h, depth_or_array_layers: 1 });
        }
        into
    }

    fn fresh_tile(&mut self) -> wgpu::Texture {
        self.spare_tiles.pop().unwrap_or_else(|| tile_texture(&self.device, TILE_PX + 2 * TILE_GUTTER_PX))
    }

    fn raster_batch(&mut self, batch: &Batch) -> Result<(), JsValue> {
        let began = now_ms();
        let (pieces, lacking, size) = self.render_batch(batch, Source::Scene)?;
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        for key in &batch.keys {
            if lacking && self.tile_textures.contains_key(key) {
                continue;
            }
            if lacking && !self.tiles.hold_lacking(*key) {
                continue;
            }
            let into = match self.tile_textures.remove(key) {
                Some(texture) => texture,
                None => self.fresh_tile(),
            };
            let texture = self.cut(&mut encoder, batch, *key, &pieces, into);
            self.tile_textures.insert(*key, texture);
            self.born.insert(*key, began);
            if !lacking {
                self.tiles.hold(*key);
            }
        }
        self.queue.submit([encoder.finish()]);
        pieces.into_iter().for_each(|(piece, texture)| self.recycle(piece, size, texture));
        self.counted.tiles += batch.keys.len() as u32;
        self.count_bake(began);
        Ok(())
    }

    fn raster_alone(&mut self, clip: &str, batch: &Batch) -> Result<Vec<(TileKey, wgpu::Texture)>, JsValue> {
        let began = now_ms();
        let (pieces, lacking, size) = self.render_batch(batch, Source::Alone(clip))?;
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        let mut done = Vec::new();
        for key in batch.keys.iter().filter(|_| !lacking) {
            let into = self.fresh_tile();
            done.push((*key, self.cut(&mut encoder, batch, *key, &pieces, into)));
        }
        self.queue.submit([encoder.finish()]);
        pieces.into_iter().for_each(|(piece, texture)| self.recycle(piece, size, texture));
        self.count_bake(began);
        Ok(done)
    }

    fn lift_tiles(&mut self, screen: (u32, u32)) -> Result<(), JsValue> {
        let lifts = self.compositor.lifts(&self.library);
        let step = self.tiles.step_for(self.camera);
        let mut was: FxHashMap<String, Lifted> = self.lifted.drain(..).collect();
        let mut now = Vec::with_capacity(lifts.len());
        for lift in lifts {
            let mut layer = match was.remove(&lift.clip) {
                Some(layer) if layer.rest == lift.rest => layer,
                other => {
                    other.into_iter().flat_map(|l| l.tiles.into_values()).for_each(|t| self.spare(t));
                    Lifted { rest: lift.rest, by: lift.by, tiles: FxHashMap::default() }
                }
            };
            layer.by = lift.by;
            let missing: Vec<TileKey> = lifted_keys(self.camera, screen, lift.rest, lift.by, step).into_iter().filter(|k| !layer.tiles.contains_key(k)).collect();
            for batch in batches(&missing) {
                layer.tiles.extend(self.raster_alone(&lift.clip, &batch)?);
            }
            now.push((lift.clip, layer));
        }
        was.into_values().flat_map(|l| l.tiles.into_values()).for_each(|t| self.spare(t));
        self.lifted = now;
        Ok(())
    }

    fn raster_piece(&mut self, camera: Camera, piece: Piece, whole: (u32, u32), source: Source) -> Result<(Rendered, bool, wgpu::Texture), JsValue> {
        let size = (piece.w, piece.h);
        let shifted = Camera { x: camera.x - piece.x as f64, y: camera.y - piece.y as f64, zoom: camera.zoom };
        let plan = match source {
            Source::Scene => self.compositor.plan_at(&mut self.library, shifted, size, self.limits),
            Source::Alone(clip) => self.compositor.plan_alone(&mut self.library, clip, shifted, size, self.limits),
        };
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

    fn present_tiles(&mut self, draw: &[TileKey], beneath: &[TileKey], fading: &[(TileKey, f32)]) -> Result<(), JsValue> {
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
        let underlay = self.compositor.held_look(c).filter(|(_, stretch)| crate::tiles::underlay_shows(*stretch)).map(|(look, _)| Tile { source: &self.retained, look, within: covered(look), opacity: OPAQUE }).filter(|t| t.within.area() > 0.0);
        let fades = |k: &TileKey| fading.iter().any(|(f, _)| f == k);
        let fallback = self.fallback.iter().flat_map(|f| f.tiles(c, screen));
        let still = beneath.iter().filter_map(tile_of).chain(draw.iter().filter(|k| k.step != step).filter_map(tile_of)).chain(underlay).chain(fallback).chain(draw.iter().filter(|k| k.step == step && !fades(k)).filter_map(tile_of));
        let faded = fading.iter().filter_map(|(k, opacity)| tile_of(k).map(|t| Tile { opacity: *opacity, ..t }));
        let complete = self.rest.as_ref().is_some_and(Rest::adoptable);
        let exact = self.rest_shown.iter().filter(|_| complete).map(|(block, source)| Tile { source, look: Lookup { scale: 1.0, x: -block.x0, y: -block.y0 }, within: *block, opacity: OPAQUE });
        let lifted = self.lifted.iter().flat_map(|(_, layer)| {
            let moved = Camera { x: c.x + (layer.by.0 * c.zoom).round(), y: c.y + (layer.by.1 * c.zoom).round(), zoom: c.zoom };
            let frame = Rect::new(layer.rest.x0 * c.zoom + moved.x, layer.rest.y0 * c.zoom + moved.y, layer.rest.x1 * c.zoom + moved.x, layer.rest.y1 * c.zoom + moved.y).intersect(screen);
            let mut keys: Vec<&TileKey> = layer.tiles.keys().collect();
            keys.sort_by_key(|k| k.step == step);
            keys.into_iter().filter_map(move |k| placed(*k, &layer.tiles[k], moved, frame))
        });
        let placed: Vec<Tile> = still.chain(exact).collect();
        let lifted: Vec<Tile> = faded.chain(lifted).collect();
        self.reprojector.draw_tiles(&self.device, &self.queue, &mut encoder, &out, self.format, Output::Premultiplied, &placed);
        if !lifted.is_empty() {
            self.queue.submit([encoder.finish()]);
            encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
            self.reprojector.draw_tiles(&self.device, &self.queue, &mut encoder, &out, self.format, Output::Over, &lifted);
        }
        if let Some((overlay, look)) = self.overlay_texture()? {
            self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &overlay, target: &out, format: self.format, look, within: Some(screen), output: Output::Over });
            self.overlay_tex = Some(overlay);
        }
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(())
    }

    fn overlay_moving(&self) -> Moving {
        if self.compositor.holding() || !self.compositor.lifts(&self.library).is_empty() {
            return Moving::Lift;
        }
        match self.motion {
            CoreMotion::Gesture => Moving::Camera,
            CoreMotion::Still => Moving::Still,
        }
    }

    fn overlay_texture(&mut self) -> Result<Option<(wgpu::Texture, Lookup)>, JsValue> {
        let quality = OverlayQuality::of(self.overlay_moving());
        let q = quality.scale();
        let size = ((self.target.width() as f64 * q).ceil() as u32, (self.target.height() as f64 * q).ceil() as u32);
        let camera = Camera { x: self.camera.x * q, y: self.camera.y * q, zoom: self.camera.zoom * q };
        let look = Lookup { scale: q, x: 0.0, y: 0.0 };
        let key = OverlayKey { camera: self.camera, size, quality };
        if !self.overlay_kept.stale(&key) {
            return Ok(self.overlay_tex.take().map(|t| (t, look)));
        }
        let plan = self.compositor.overlay_at(&mut self.library, camera, size, self.limits, q);
        let pinned = self.compositor.pinned_at(camera, q, size);
        let drawn = if plan.pending { OverlayDrawn::Pending } else { OverlayDrawn::Settled };
        if plan.screen.items.is_empty() && pinned.is_empty() {
            self.overlay_tex = None;
            self.overlay_kept.drew(key, drawn);
            return Ok(None);
        }
        let began = now_ms();
        let (list, _) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let texture = self.overlay_tex.take().filter(|t| t.width() == size.0 && t.height() == size.1).unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
        self.engine.draw_over(&self.device, &self.queue, &list, &pictures, &pinned, &texture.create_view(&wgpu::TextureViewDescriptor::default())).map_err(failed)?;
        self.count_bake(began);
        self.overlay_kept.drew(key, drawn);
        Ok(Some((texture, look)))
    }

    fn tiled_frame(&mut self) -> Result<String, JsValue> {
        if self.compositor.stirred() || !self.compositor.lifts(&self.library).is_empty() {
            self.changed_at = js_sys::Date::now();
        }
        match self.compositor.take_damage() {
            Damage::Rects(rects) if rects.is_empty() => {}
            Damage::All => {
                self.forget_rest();
                self.forget_fallback();
                self.changed_at = js_sys::Date::now();
                self.tiles.clear();
            }
            Damage::Rects(rects) => {
                self.forget_rest();
                self.forget_fallback();
                self.changed_at = js_sys::Date::now();
                rects.iter().for_each(|r| self.tiles.invalidate(*r));
            }
        }
        let screen = (self.target.width(), self.target.height());
        if !self.rest.as_ref().is_some_and(|r| r.shows(self.camera, screen)) {
            self.forget_rest();
        }
        let budget = if matches!(self.motion, CoreMotion::Gesture) { TILE_BUDGET_GESTURE_MS } else { TILE_BUDGET_STILL_MS };
        let started = js_sys::Date::now();
        let mut rastered = 0;
        self.lift_tiles(screen)?;
        let mut queue = self.tiles.queue(self.tiles.frame(self.camera, screen).missing);
        queue.stale.sort_by_key(|k| !self.lifted.iter().any(|(_, l)| k.world().overlaps(l.rest)));
        let left_blank = queue.blank.clone();
        let order = queue.order();
        let deadline = started + budget;
        let side = if matches!(self.motion, CoreMotion::Gesture) { 1 } else { self.credit.side() };
        self.credit.earn(budget);
        for batch in batches_of(&order, side) {
            if !self.credit.affords(batch.keys.len()) || js_sys::Date::now() >= deadline {
                break;
            }
            rastered += self.paid_batch(&batch)?;
        }
        if matches!(self.motion, CoreMotion::Gesture) && self.credit.allows() {
            rastered += self.bake_ahead(deadline)?;
        }
        self.was = self.camera;
        let tiles = self.tiles.frame(self.camera, screen);
        let served = self.serve_bare(&tiles.bare, screen, deadline)?;
        self.counted.unsharp = if served { 0 } else { tiles.bare.len() as u32 };
        self.sharpness.magnified_frames += u32::from(magnified(&tiles.draw, self.camera.zoom) > 0);
        let underlaid = self.compositor.held_look(self.camera).is_some_and(|(_, stretch)| crate::tiles::underlay_shows(stretch));
        self.counted.uncovered = if underlaid || served { 0 } else { left_blank.iter().filter(|k| !self.tiles.holds(**k)).count() as u32 };
        let resting = matches!(self.motion, CoreMotion::Still) && tiles.missing.iter().all(|k| self.tiles.covered_within(*k, NEAR_STEPS)) && js_sys::Date::now() - self.changed_at >= REST_AFTER_MS;
        let mut exact = false;
        if resting {
            exact = self.raster_rest(started, budget, rastered > 0)?;
        }
        let fading = self.fading(&tiles.draw);
        if tiles.bare.is_empty() && fading.is_empty() {
            self.forget_fallback();
        }
        self.present_tiles(&tiles.draw, &tiles.beneath, &fading)?;
        self.tiles.drawn(&tiles.draw);
        self.trim_spares();
        let kept = tiles_kept_beside(screen, self.tile_budget, self.beside_tiles());
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

    fn serve_bare(&mut self, bare: &[TileKey], screen: (u32, u32), deadline: f64) -> Result<bool, JsValue> {
        if bare.is_empty() {
            return Ok(false);
        }
        let c = self.camera;
        let was = std::mem::replace(&mut self.fallback_was, c);
        let (kept, stale): (Vec<Fallback>, Vec<Fallback>) = std::mem::take(&mut self.fallback).into_iter().partition(|f| fallback_serves(f.camera, c, f.size, &[]));
        stale.into_iter().for_each(Fallback::destroy);
        self.fallback = kept;
        let uncovered: Vec<Rect> = bare.iter().filter(|k| !self.fallback.iter().any(|f| fallback_serves(f.camera, c, f.size, &[**k]))).map(|k| k.screen(c)).collect();
        if uncovered.is_empty() && self.fallback.iter().all(|f| f.todo.is_empty()) {
            self.render_ahead(was, screen, deadline)?;
            return Ok(true);
        }
        let began = js_sys::Date::now();
        let whole = Rect::new(0.0, 0.0, screen.0 as f64, screen.1 as f64);
        let held = self.fallback.iter().map(|f| f.on(c)).reduce(|a, b| a.union(b));
        for band in fallback_bands(held, &uncovered) {
            let area = band.intersect(whole);
            let area = Rect::new(area.x0.floor(), area.y0.floor(), area.x1.ceil(), area.y1.ceil());
            if area.area() <= 0.0 {
                continue;
            }
            let camera = Camera { x: c.x.round() - area.x0, y: c.y.round() - area.y0, zoom: c.zoom };
            let size = (area.width() as u32, area.height() as u32);
            self.fallback.push(Fallback { camera, size, pieces: Vec::new(), todo: Rest::new(camera, size).todo().to_vec() });
            self.sharpness.fallbacks += 1;
        }
        while self.fallback.len() > FALLBACK_PATCHES {
            self.fallback.remove(0).destroy();
        }
        let blank = bare.iter().any(|k| !self.tiles.covered(*k));
        self.draw_fallback_blocks(if blank { f64::INFINITY } else { deadline })?;
        let took = js_sys::Date::now() - began;
        self.credit.spend(took);
        self.sharpness.fallback_ms += took;
        self.counted.fallback_ms += took;
        Ok(true)
    }

    fn draw_fallback_blocks(&mut self, deadline: f64) -> Result<(), JsValue> {
        while js_sys::Date::now() < deadline {
            let Some(at) = self.fallback.iter().position(|f| !f.todo.is_empty()) else { return Ok(()) };
            let block = self.fallback[at].todo.remove(0);
            let camera = self.fallback[at].camera;
            let shifted = Camera { x: camera.x - block.x0, y: camera.y - block.y0, zoom: camera.zoom };
            let limits = self.limits;
            self.limits = Limits { rasters: 0, ..limits };
            let rendered = crate::lod::coarser(FALLBACK_FLOORS, || self.render_view(shifted, (block.width() as u32, block.height() as u32), Source::Scene));
            self.limits = limits;
            let (pieces, _) = rendered?;
            let placed = |p: Piece| Piece { x: p.x + block.x0 as u32, y: p.y + block.y0 as u32, ..p };
            self.fallback[at].pieces.extend(pieces.into_iter().map(|(p, t)| (placed(p), t)));
        }
        Ok(())
    }

    fn fading(&self, draw: &[TileKey]) -> Vec<(TileKey, f32)> {
        let screen = Rect::new(0.0, 0.0, self.target.width() as f64, self.target.height() as f64);
        let under: Vec<Rect> = self.fallback.iter().filter(|f| fallback_serves(f.camera, self.camera, f.size, &[])).flat_map(|f| f.tiles(self.camera, screen)).map(|t| t.within).collect();
        let now = now_ms();
        let young = |k: &TileKey| self.born.get(k).map(|at| now - at).filter(|age| *age < FADE_MS);
        draw.iter().filter(|k| fades_over(k.screen(self.camera).intersect(screen), &under)).filter_map(|k| young(k).map(|age| (*k, fade_in(age)))).collect()
    }

    fn forget_fallback(&mut self) {
        std::mem::take(&mut self.fallback).into_iter().for_each(Fallback::destroy);
        self.forget_ahead();
    }

    fn forget_ahead(&mut self) {
        if let Some(ahead) = self.ahead.take() {
            ahead.pieces.into_iter().for_each(|(_, texture)| texture.destroy());
        }
    }

    fn render_ahead(&mut self, was: Camera, screen: (u32, u32), deadline: f64) -> Result<(), JsValue> {
        let Some(next) = ahead_camera(was, self.camera) else {
            self.forget_ahead();
            return Ok(());
        };
        if !self.ahead.as_ref().is_some_and(|a| a.size == screen && fallback_serves(a.camera, self.camera, a.size, &[])) {
            self.forget_ahead();
            let camera = Camera { x: next.x.round(), y: next.y.round(), zoom: next.zoom };
            self.ahead = Some(Ahead { camera, size: screen, pieces: Vec::new(), todo: Rest::new(camera, screen).todo().to_vec() });
        }
        let began = js_sys::Date::now();
        while js_sys::Date::now() < deadline.min(began + AHEAD_BUDGET_MS) {
            let Some(ahead) = self.ahead.as_mut() else { break };
            if ahead.todo.is_empty() {
                break;
            }
            let block = ahead.todo.remove(0);
            let camera = ahead.camera;
            let shifted = Camera { x: camera.x - block.x0, y: camera.y - block.y0, zoom: camera.zoom };
            let limits = self.limits;
            self.limits = Limits { rasters: 0, ..limits };
            let rendered = crate::lod::coarser(FALLBACK_FLOORS, || self.render_view(shifted, (block.width() as u32, block.height() as u32), Source::Scene));
            self.limits = limits;
            let (pieces, _) = rendered?;
            let at = |p: Piece| Piece { x: p.x + block.x0 as u32, y: p.y + block.y0 as u32, ..p };
            self.ahead.as_mut().expect("ahead started").pieces.extend(pieces.into_iter().map(|(p, t)| (at(p), t)));
        }
        let took = js_sys::Date::now() - began;
        self.credit.spend(took);
        self.sharpness.fallback_ms += took;
        self.counted.fallback_ms += took;
        if self.ahead.as_ref().is_some_and(|a| a.todo.is_empty()) {
            let Ahead { camera, size, pieces, .. } = self.ahead.take().expect("ahead finished");
            self.fallback.push(Fallback { camera, size, pieces, todo: Vec::new() });
            self.sharpness.fallbacks += 1;
        }
        Ok(())
    }

    fn bake_ahead(&mut self, deadline: f64) -> Result<usize, JsValue> {
        let screen = (self.target.width(), self.target.height());
        let mut rastered = 0;
        for batch in batches_of(&self.tiles.ahead(self.was, self.camera, screen), 1) {
            if !self.credit.affords(batch.keys.len()) || js_sys::Date::now() >= deadline {
                break;
            }
            rastered += self.paid_batch(&batch)?;
        }
        Ok(rastered)
    }

    fn paid_batch(&mut self, batch: &Batch) -> Result<usize, JsValue> {
        let began = js_sys::Date::now();
        self.raster_batch(batch)?;
        let took = js_sys::Date::now() - began;
        self.credit.spend(took);
        self.credit.learn(took, batch.keys.len());
        Ok(batch.keys.len())
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
        let moment = || Moment { gesture: moving, lifting: self.compositor.holding() || !self.compositor.lifts(&self.library).is_empty(), settling: self.adopted.is_none() && self.drew_tiles && self.tiles_show_all(), draw: self.gesture_draw };
        let path = path_for(moment());
        if path == Path::Direct {
            self.drew_tiles = false;
            return self.direct_frame(now_ms);
        }
        self.drop_held_scene();
        if self.tiled && path == Path::Tiles {
            self.adopted = None;
            self.drew_tiles = true;
            let report = self.tiled_frame()?;
            if self.rest_done() {
                self.adopt_rest(now_ms);
            }
            return Ok(report);
        }
        self.drew_tiles = false;
        self.counted.exact = true;
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
        self.warm_wait = if self.warming && !coarse_left { self.warmup.wait_ms(js_sys::Date::now()) } else { 0.0 };
        Ok(frame.report())
    }

    fn direct_frame(&mut self, at_ms: f64) -> Result<String, JsValue> {
        let began = now_ms();
        if !matches!(self.compositor.take_damage(), Damage::Rects(rects) if rects.is_empty()) {
            self.engine.forget_fingerprints();
            self.drop_held_scene();
        }
        let size = (self.target.width(), self.target.height());
        if !self.held_scene.as_ref().is_some_and(|h| h.view.holds(self.camera, size)) {
            self.drop_held_scene();
            self.held_scene = Some(self.build_held_scene(size)?);
        }
        let held = self.held_scene.as_ref().expect("a held scene");
        let whole = held.whole;
        let texture = self.direct.take().filter(|t| (t.width(), t.height()) == size).unwrap_or_else(|| layer_texture(&self.device, size.0, size.1));
        self.engine.draw_held(&self.device, &self.queue, &held.scene, held.view.transform(self.camera), held.background, &texture.create_view(&wgpu::TextureViewDescriptor::default()), size).map_err(failed)?;
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err(failed("no surface texture")),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let screen = Rect::new(0.0, 0.0, size.0 as f64, size.1 as f64);
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &texture, target: &out, format: self.format, look: UNMOVED, within: None, output: Output::Premultiplied });
        if let Some((overlay, look)) = self.overlay_texture()? {
            self.reprojector.draw(&self.device, &self.queue, &mut encoder, Draw { source: &overlay, target: &out, format: self.format, look, within: Some(screen), output: Output::Over });
            self.overlay_tex = Some(overlay);
        }
        if whole {
            let o = self.compositor.retained_overscan();
            encoder.copy_texture_to_texture(texel(&texture, 0, 0), texel(&self.retained, o, o), wgpu::Extent3d { width: size.0, height: size.1, depth_or_array_layers: 1 });
        }
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        if whole {
            self.compositor.adopt(self.camera, at_ms);
            self.adopted = Some(self.camera);
        }
        self.direct = Some(texture);
        if !whole {
            self.drop_held_scene();
        }
        self.count_bake(began);
        self.pending = !whole || self.compositor.pending_raster();
        Ok("direct".into())
    }

    fn build_held_scene(&mut self, size: (u32, u32)) -> Result<HeldScreen, JsValue> {
        let view = HeldView::around(self.camera, size);
        let (planned, planned_size) = view.planned();
        self.library.set_native(Native::Vectors);
        let plan = self.compositor.plan_at(&mut self.library, planned, planned_size, self.limits);
        self.library.set_native(Native::Textures);
        let building = plan.pending;
        let (list, missing) = self.engine.hold(&mut self.cached, plan, &self.pictures, &self.device, &self.queue).map_err(failed)?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        self.engine.effects = Effects::Zoomless;
        let built = self.engine.build_held(&self.device, &self.queue, &list, &pictures);
        self.engine.effects = Effects::Screen;
        let (scene, _) = built.map_err(failed)?;
        Ok(HeldScreen { view, scene, whole: !building && missing.is_empty(), background: list.background })
    }

    fn drop_held_scene(&mut self) {
        if let Some(held) = self.held_scene.take() {
            self.engine.drop_held(held.scene);
        }
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
        vec![f64::from(planned.plans), f64::from(planned.walked), planned.ms, f64::from(counted.bakes), counted.ms, counted.upload_bytes, f64::from(counted.unsharp), f64::from(counted.uncovered), f64::from(step_of(self.camera.zoom)), f64::from(counted.tiles), f64::from(self.engine.take_draws()), f64::from(counted.uploads), counted.fallback_ms, f64::from(u8::from(counted.exact))]
    }
    pub fn warming(&self) -> bool {
        self.warming
    }

    pub fn warm_wait(&self) -> f64 {
        self.warm_wait
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
        let tally = self.engine.take_tally().json();
        self.sharpness.json(&tally)
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
