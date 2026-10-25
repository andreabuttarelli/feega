// ponytail: throwaway spike. Native gpu-core (wgpu/Metal) drawing into an NSView placed BEHIND
// Electron's web contents; the page is transparent where the canvas is, so input stays in the DOM.
use std::collections::HashMap;
use std::ptr::NonNull;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use gpu_core::compositor::{Compositor, Painter};
use gpu_core::display_list::{parse, UseItem};
use gpu_core::engine::Engine;
use gpu_core::filter_passes::layer_texture;
use gpu_core::groups::{Library, Limits, Plan};
use gpu_core::pictures::Pictures;
use gpu_core::reproject::{Draw, Reprojector};
use gpu_core::retained::{Camera, Lookup, Quality};
use gpu_core::world::Patch;
use gpu_core::Skipped;
use napi_derive::napi;
use objc2::rc::Retained;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSView, NSWindowOrderingMode};
use objc2_foundation::{NSPoint, NSRect, NSSize};
use vello::kurbo::Rect;
use vello::wgpu;

const CACHE_SIDE: u32 = 4096;

fn texel(texture: &wgpu::Texture, x: u32, y: u32) -> wgpu::TexelCopyTextureInfo<'_> {
    wgpu::TexelCopyTextureInfo { texture, mip_level: 0, origin: wgpu::Origin3d { x, y, z: 0 }, aspect: wgpu::TextureAspect::All }
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
    last_look: &'a mut Option<Lookup>,
}

impl Painter for GpuPainter<'_> {
    type Error = String;

    fn limits(&self) -> Limits {
        self.limits
    }

    fn tile(&self) -> (u32, u32) {
        let side = self.device.limits().max_texture_dimension_2d;
        (side, side)
    }

    fn shift(&mut self, (dx, dy): (i32, i32)) -> Result<(), String> {
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

    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, String> {
        let (list, missing) = self.engine.hold(self.cached, plan, self.pictures, self.device, self.queue).map_err(|e| format!("{e:?}"))?;
        let pictures: Pictures = self.pictures.iter().chain(self.cached.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
        let scratch = layer_texture(self.device, list.width.max(1), list.height.max(1));
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
        let frame = match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t) | wgpu::CurrentSurfaceTexture::Suboptimal(t) => t,
            _ => return Err("no surface texture".into()),
        };
        let out = frame.texture.create_view(&wgpu::TextureViewDescriptor { format: Some(self.format), ..Default::default() });
        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        self.reprojector.draw(self.device, &mut encoder, Draw { source: self.retained, target: &out, format: self.format, look, within: None });
        self.queue.submit([encoder.finish()]);
        self.queue.present(frame);
        Ok(())
    }
}

#[derive(Default)]
struct Shared {
    camera: (f64, f64, f64),
    size: (u32, u32),
    motion: bool,
    quit: bool,
    presents: Vec<f64>,
    work_ms: Vec<f64>,
    first_frame_ms: f64,
    load_ms: f64,
    error: String,
    snap: Option<String>,
}

struct Motion {
    clip: String,
    group: String,
    x: f64,
    y: f64,
    anim: String,
    period: f64,
    amp: f64,
}

fn animated(m: &Motion, t: f64) -> [f64; 6] {
    let p = (t / m.period) * std::f64::consts::TAU;
    match m.anim.as_str() {
        "orbit" => [1.0, 0.0, 0.0, 1.0, m.x + p.cos() * m.amp, m.y + p.sin() * m.amp],
        "pulse" => {
            let s = 1.0 + 0.25 * p.sin();
            [s, 0.0, 0.0, s, m.x, m.y]
        }
        _ => [1.0, 0.0, 0.0, 1.0, m.x + p.sin() * m.amp, m.y],
    }
}

#[napi]
pub struct NativeCanvas {
    view: Retained<NSView>,
    scale: f64,
    shared: Arc<Mutex<Shared>>,
}

fn view_rect(parent: &NSView, x: f64, y: f64, w: f64, h: f64) -> NSRect {
    let ph = parent.frame().size.height;
    let y = if parent.isFlipped() { y } else { ph - y - h };
    NSRect::new(NSPoint::new(x, y), NSSize::new(w, h))
}

#[napi]
impl NativeCanvas {
    #[napi(constructor)]
    pub fn new(handle: napi::bindgen_prelude::Buffer, x: f64, y: f64, w: f64, h: f64, scale: f64, scene_path: String) -> napi::Result<Self> {
        let started = Instant::now();
        let mtm = MainThreadMarker::new().ok_or_else(|| napi::Error::from_reason("not on main thread"))?;
        let ptr = usize::from_ne_bytes(handle[..8].try_into().unwrap()) as *mut NSView;
        let parent = unsafe { Retained::retain(ptr) }.ok_or_else(|| napi::Error::from_reason("null view"))?;
        let view = NSView::initWithFrame(mtm.alloc(), view_rect(&parent, x, y, w, h));
        parent.addSubview_positioned_relativeTo(&view, NSWindowOrderingMode::Below, None);

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor { backends: wgpu::Backends::METAL, ..wgpu::InstanceDescriptor::new_without_display_handle() });
        let raw = raw_window_handle::AppKitWindowHandle::new(NonNull::from(&*view).cast());
        let surface = unsafe {
            instance.create_surface_unsafe(wgpu::SurfaceTargetUnsafe::RawHandle {
                raw_display_handle: Some(raw_window_handle::RawDisplayHandle::AppKit(raw_window_handle::AppKitDisplayHandle::new())),
                raw_window_handle: raw_window_handle::RawWindowHandle::AppKit(raw),
            })
        }
        .map_err(|e| napi::Error::from_reason(format!("{e:?}")))?;
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions { compatible_surface: Some(&surface), power_preference: wgpu::PowerPreference::HighPerformance, ..Default::default() })).map_err(|e| napi::Error::from_reason(format!("{e:?}")))?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(|e| napi::Error::from_reason(format!("{e:?}")))?;
        let format = surface.get_capabilities(&adapter).formats.into_iter().find(|f| !f.is_srgb()).ok_or_else(|| napi::Error::from_reason("no linear format"))?;

        let size = ((w * scale) as u32, (h * scale) as u32);
        let shared = Arc::new(Mutex::new(Shared { camera: (0.0, 0.0, 0.1), size, ..Default::default() }));
        let worker = shared.clone();
        std::thread::spawn(move || {
            if let Err(e) = run(device, queue, surface, format, size, scene_path, worker.clone(), started) {
                worker.lock().unwrap().error = e;
            }
        });
        Ok(NativeCanvas { view, scale, shared })
    }

    #[napi]
    pub fn set_camera(&self, x: f64, y: f64, zoom: f64) {
        let s = self.scale;
        self.shared.lock().unwrap().camera = (x * s, y * s, zoom * s);
    }

    #[napi]
    pub fn set_motion(&self, on: bool) {
        self.shared.lock().unwrap().motion = on;
    }

    #[napi]
    pub fn resize(&self, x: f64, y: f64, w: f64, h: f64) {
        let parent = unsafe { self.view.superview() }.unwrap();
        self.view.setFrame(view_rect(&parent, x, y, w, h));
        self.shared.lock().unwrap().size = ((w * self.scale) as u32, (h * self.scale) as u32);
    }

    #[napi]
    pub fn stats(&self) -> String {
        let mut s = self.shared.lock().unwrap();
        let presents = std::mem::take(&mut s.presents);
        let work = std::mem::take(&mut s.work_ms);
        serde_json::json!({ "presents": presents, "work": work, "firstFrameMs": s.first_frame_ms, "loadMs": s.load_ms, "error": s.error }).to_string()
    }

    #[napi]
    pub fn snapshot(&self, path: String) {
        self.shared.lock().unwrap().snap = Some(path);
    }

    #[napi]
    pub fn snap_pending(&self) -> bool {
        self.shared.lock().unwrap().snap.is_some()
    }

    #[napi]
    pub fn close(&self) {
        self.shared.lock().unwrap().quit = true;
        self.view.removeFromSuperview();
    }
}

fn configure(surface: &wgpu::Surface, device: &wgpu::Device, format: wgpu::TextureFormat, (width, height): (u32, u32)) {
    surface.configure(device, &wgpu::SurfaceConfiguration { usage: wgpu::TextureUsages::RENDER_ATTACHMENT, format, width, height, present_mode: wgpu::PresentMode::Fifo, alpha_mode: wgpu::CompositeAlphaMode::Auto, view_formats: vec![], desired_maximum_frame_latency: 2, color_space: wgpu::SurfaceColorSpace::Auto });
}

#[allow(clippy::too_many_arguments)]
fn run(device: wgpu::Device, queue: wgpu::Queue, surface: wgpu::Surface<'static>, format: wgpu::TextureFormat, mut size: (u32, u32), scene_path: String, shared: Arc<Mutex<Shared>>, started: Instant) -> Result<(), String> {
    configure(&surface, &device, format, size);
    let text = std::fs::read_to_string(&scene_path).map_err(|e| e.to_string())?;
    let scene: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let dir = std::path::Path::new(&scene_path).parent().unwrap().to_path_buf();

    let mut engine = Engine::new(&device).map_err(|e| format!("{e:?}"))?;
    let mut decoded: HashMap<String, vello::peniko::ImageData> = HashMap::new();
    let mut pictures = Pictures::new();
    for (clip, file) in scene["images"].as_object().unwrap() {
        let file = file.as_str().unwrap().to_string();
        if !decoded.contains_key(&file) {
            let img = image::open(dir.join(&file)).map_err(|e| e.to_string())?.to_rgba8();
            let texture = held_texture(&device, (img.width(), img.height()));
            queue.write_texture(texel(&texture, 0, 0), &img, wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(img.width() * 4), rows_per_image: Some(img.height()) }, wgpu::Extent3d { width: img.width(), height: img.height(), depth_or_array_layers: 1 });
            decoded.insert(file.clone(), engine.vello.register_texture(texture));
        }
        pictures.insert(clip.clone(), decoded[&file].clone());
    }
    let mut library = Library::new();
    library.compose_encodings();
    for (key, list) in scene["groups"].as_object().unwrap() {
        library.put_group(key, &parse(&list.to_string()).map_err(|e| e.to_string())?);
    }
    let uses: Vec<UseItem> = serde_json::from_value(scene["uses"].clone()).map_err(|e| e.to_string())?;
    let motions: Vec<Motion> = scene["motion"].as_array().unwrap().iter().map(|m| Motion { clip: m["clip"].as_str().unwrap().into(), group: m["group"].as_str().unwrap().into(), x: m["x"].as_f64().unwrap(), y: m["y"].as_f64().unwrap(), anim: m["anim"].as_str().unwrap().into(), period: m["period"].as_f64().unwrap(), amp: m["amp"].as_f64().unwrap() }).collect();

    let limits = Limits { side: CACHE_SIDE.min(device.limits().max_texture_dimension_2d), rasters: 1, items: 48 };
    let mut compositor = Compositor::new(size.0, size.1);
    compositor.patch(Patch { put: uses, drop: vec![], order: None }, &library);
    let mut retained = held_texture(&device, compositor.size());
    let mut spare = held_texture(&device, compositor.size());
    let mut reprojector = Reprojector::new(&device);
    let mut cached = Pictures::new();
    shared.lock().unwrap().load_ms = started.elapsed().as_secs_f64() * 1000.0;
    eprintln!("[native] loaded in {:.0} ms", started.elapsed().as_secs_f64() * 1000.0);
    let clock0 = Instant::now();
    let now = || clock0.elapsed().as_secs_f64() * 1000.0;
    let mut first = true;
    let mut last_look: Option<Lookup> = None;

    loop {
        let (camera, want, motion, quit) = {
            let s = shared.lock().unwrap();
            (s.camera, s.size, s.motion, s.quit)
        };
        if quit {
            return Ok(());
        }
        if want != size && want.0 > 0 && want.1 > 0 {
            size = want;
            configure(&surface, &device, format, size);
            let fresh = Compositor::new(size.0, size.1);
            let uses: Vec<UseItem> = serde_json::from_value(scene["uses"].clone()).unwrap();
            compositor = fresh;
            compositor.patch(Patch { put: uses, drop: vec![], order: None }, &library);
            retained = held_texture(&device, compositor.size());
            spare = held_texture(&device, compositor.size());
        }
        if motion {
            let t = now();
            let put = motions.iter().map(|m| UseItem { clip: m.clip.clone(), group: m.group.clone(), matrix: animated(m, t), cache: false, hold: false }).collect();
            compositor.patch(Patch { put, drop: vec![], order: None }, &library);
        }
        let t0 = now();
        let mut painter = GpuPainter { device: &device, queue: &queue, surface: &surface, format, engine: &mut engine, pictures: &pictures, cached: &mut cached, limits, retained: &mut retained, spare: &mut spare, reprojector: &mut reprojector, last_look: &mut last_look };
        let mut clock = || clock0.elapsed().as_secs_f64() * 1000.0;
        let frame = compositor.frame(&mut painter, &mut library, Camera { x: camera.0, y: camera.1, zoom: camera.2 }, t0, &mut clock)?;
        let _ = device.poll(wgpu::PollType::Poll);
        let t1 = now();
        if first { eprintln!("[native] frame {:?} pending {} skipped {}", frame.outcome.map(|o| o.name()), frame.pending, frame.skipped.len()); }
        if frame.outcome.is_some() {
            let mut s = shared.lock().unwrap();
            if first {
                first = false;
                s.first_frame_ms = started.elapsed().as_secs_f64() * 1000.0;
            }
            s.presents.push(t1);
            s.work_ms.push(t1 - t0);
            continue;
        }
        let snap = shared.lock().unwrap().snap.clone();
        if let (Some(path), false, Some(look)) = (snap, frame.pending, last_look) {
            let r = snapshot(&device, &queue, &mut reprojector, &retained, look, size, &path);
            let mut s = shared.lock().unwrap();
            s.snap = None;
            if let Err(e) = r {
                s.error = e;
            }
        }
        if !frame.pending {
            std::thread::sleep(Duration::from_millis(4));
        }
    }
}

fn snapshot(device: &wgpu::Device, queue: &wgpu::Queue, reprojector: &mut Reprojector, retained: &wgpu::Texture, look: Lookup, (w, h): (u32, u32), path: &str) -> Result<(), String> {
    let target = held_texture(device, (w, h));
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());
    let row = (w * 4).div_ceil(256) * 256;
    let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (row * h) as u64, usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ, mapped_at_creation: false });
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    reprojector.draw(device, &mut encoder, Draw { source: retained, target: &view, format: wgpu::TextureFormat::Rgba8Unorm, look, within: None });
    encoder.copy_texture_to_buffer(texel(&target, 0, 0), wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(row), rows_per_image: Some(h) } }, wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 });
    queue.submit([encoder.finish()]);
    buffer.slice(..).map_async(wgpu::MapMode::Read, |_| {});
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).map_err(|e| format!("{e:?}"))?;
    let data = buffer.slice(..).get_mapped_range().map_err(|e| format!("{e:?}"))?;
    let mut px = Vec::with_capacity((w * h * 4) as usize);
    for y in 0..h {
        px.extend_from_slice(&data[(y * row) as usize..(y * row + w * 4) as usize]);
    }
    image::save_buffer(path, &px, w, h, image::ExtendedColorType::Rgba8).map_err(|e| e.to_string())
}
