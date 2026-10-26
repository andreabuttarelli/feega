use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use gpu_core::compositor::Compositor;
use gpu_core::display_list::{parse, parse_splice};
use gpu_core::engine::Engine;
use gpu_core::groups::{Library, Limits};
use gpu_core::pictures::Pictures;
use gpu_core::reproject::Reprojector;
use gpu_core::retained::{Camera, Lookup};
use gpu_core::world::{parse_overlay, parse_patch};
use vello::wgpu;

use crate::inbox::{Batch, Command, Inbox};
use crate::painter::{acquire, snapshot, held_texture, texel, upload_target, GpuPainter, ScratchPool};
use crate::priority;

const CACHE_SIDE: u32 = 4096;
const RASTERS_PER_DRAW: usize = 1;
const ITEMS_PER_RASTER: usize = 48;
const STARVED_RETRY: Duration = Duration::from_millis(4);
const STATS_KEPT: usize = 4096;
const BYTES_PER_PIXEL: u32 = 4;

pub struct Gpu {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub surface: wgpu::Surface<'static>,
    pub configuration: wgpu::SurfaceConfiguration,
}

#[derive(Default)]
pub struct Stats {
    pub presents: Vec<f64>,
    pub work_ms: Vec<f64>,
    pub first_frame_ms: f64,
    pub error: String,
}

impl Stats {
    fn record(&mut self, at: f64, work: f64) {
        if self.presents.len() >= STATS_KEPT {
            self.presents.drain(..STATS_KEPT / 2);
            self.work_ms.drain(..STATS_KEPT / 2);
        }
        self.presents.push(at);
        self.work_ms.push(work);
    }
}

pub type Report = Box<dyn Fn(String) + Send>;

pub struct Link {
    pub inbox: Arc<Inbox>,
    pub stats: Arc<Mutex<Stats>>,
    pub report: Report,
    pub started: Instant,
}

struct Core {
    gpu: Gpu,
    engine: Engine,
    library: Library,
    compositor: Compositor,
    pictures: Pictures,
    textures: HashMap<String, wgpu::Texture>,
    cached: Pictures,
    limits: Limits,
    retained: wgpu::Texture,
    spare: wgpu::Texture,
    reprojector: Reprojector,
    scratch: ScratchPool,
    camera: Camera,
    pending: bool,
    drawable: Option<wgpu::SurfaceTexture>,
    last_look: Option<Lookup>,
    size: (u32, u32),
}

fn failure<E: std::fmt::Debug>(e: E) -> String {
    format!("{e:?}")
}

impl Core {
    fn new(gpu: Gpu, size: (u32, u32)) -> Result<Core, String> {
        let engine = Engine::new(&gpu.device).map_err(failure)?;
        let mut library = Library::new();
        library.compose_encodings();
        let limits = Limits { side: CACHE_SIDE.min(gpu.device.limits().max_texture_dimension_2d), rasters: RASTERS_PER_DRAW, items: ITEMS_PER_RASTER };
        let compositor = Compositor::new(size.0, size.1);
        let retained = held_texture(&gpu.device, compositor.size());
        let spare = held_texture(&gpu.device, compositor.size());
        let reprojector = Reprojector::new(&gpu.device);
        Ok(Core { gpu, engine, library, compositor, pictures: Pictures::new(), textures: HashMap::new(), cached: Pictures::new(), limits, retained, spare, reprojector, scratch: ScratchPool::default(), camera: Camera { x: 0.0, y: 0.0, zoom: 1.0 }, pending: false, drawable: None, last_look: None, size })
    }

    fn picture(&mut self, clip: &str, rgba: &[u8], width: u32, height: u32) {
        let fits = self.textures.get(clip).is_some_and(|t| t.width() == width && t.height() == height);
        if !fits {
            if let Some(old) = self.pictures.remove(clip) {
                self.engine.vello.unregister_texture(old);
            }
            let texture = upload_target(&self.gpu.device, (width, height));
            self.pictures.insert(clip.into(), self.engine.vello.register_texture(texture.clone()));
            self.textures.insert(clip.into(), texture);
        }
        let layout = wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(width * BYTES_PER_PIXEL), rows_per_image: Some(height) };
        self.gpu.queue.write_texture(texel(&self.textures[clip], 0, 0), rgba, layout, wgpu::Extent3d { width, height, depth_or_array_layers: 1 });
        self.engine.vello.mark_override_image_dirty(&self.pictures[clip]);
        self.compositor.touch_picture(clip, &self.library);
    }

    fn apply(&mut self, command: Command) -> Result<(), String> {
        match command {
            Command::Picture { clip, rgba, width, height } => self.picture(&clip, &rgba, width, height),
            Command::PutGroup { key, json } => {
                self.compositor.touch(&key, &self.library);
                self.library.put_group(&key, &parse(&json).map_err(failure)?);
                self.compositor.touch(&key, &self.library);
            }
            Command::AppendGroup { key, json } => {
                self.library.append_group(&key, &parse(&json).map_err(failure)?);
                self.compositor.touch(&key, &self.library);
            }
            Command::PatchGroup { from, to, json } => {
                self.compositor.touch(&to, &self.library);
                self.library.patch_group(&from, &to, &parse_splice(&json).map_err(failure)?);
                self.compositor.touch(&to, &self.library);
            }
            Command::DropGroup(key) => {
                self.compositor.touch(&key, &self.library);
                self.library.drop_group(&key);
            }
            Command::PatchUses(json) => self.compositor.patch(parse_patch(&json).map_err(failure)?, &self.library),
            Command::Snapshot(path) => {
                let look = self.last_look.ok_or("nothing presented yet")?;
                snapshot(&self.gpu.device, &self.gpu.queue, &mut self.reprojector, &self.retained, look, self.size, &path)?;
            }
            Command::SetOverlay(json) => self.compositor.set_overlay(parse_overlay(&json).map_err(failure)?),
        }
        Ok(())
    }

    fn hold_drawable(&mut self) {
        if self.drawable.is_none() {
            self.drawable = acquire(&self.gpu.surface, &self.gpu.device, &self.gpu.configuration);
        }
    }

    fn frame(&mut self, now_ms: f64, clock: &mut dyn FnMut() -> f64) -> Result<Painted, String> {
        let mut presented = false;
        let mut painter = GpuPainter {
            device: &self.gpu.device,
            queue: &self.gpu.queue,
            surface: &self.gpu.surface,
            configuration: &self.gpu.configuration,
            engine: &mut self.engine,
            pictures: &self.pictures,
            cached: &mut self.cached,
            limits: self.limits,
            retained: &mut self.retained,
            spare: &mut self.spare,
            reprojector: &mut self.reprojector,
            scratch: &mut self.scratch,
            drawable: &mut self.drawable,
            last_look: &mut self.last_look,
            presented: &mut presented,
        };
        let frame = self.compositor.frame(&mut painter, &mut self.library, self.camera, now_ms, clock)?;
        self.drawable = None;
        let _ = self.gpu.device.poll(wgpu::PollType::Poll);
        self.pending = frame.pending;
        Ok(Painted { drew: frame.outcome.is_some(), presented, pending: frame.pending, report: frame.report(), cache_bytes: self.library.cache_bytes() })
    }
}

struct Painted {
    drew: bool,
    presented: bool,
    pending: bool,
    report: String,
    cache_bytes: u64,
}

#[derive(PartialEq, Default)]
struct Told {
    pending: bool,
    drew: bool,
    cache_bytes: u64,
    skipped: String,
}

impl Told {
    fn of(painted: &Painted) -> Told {
        Told { pending: painted.pending, drew: painted.drew, cache_bytes: painted.cache_bytes, skipped: painted.report.split_once('\n').map(|(_, rest)| rest.to_string()).unwrap_or_default() }
    }
}

fn message(painted: &Painted) -> String {
    serde_json::json!({ "report": painted.report, "pending": painted.pending, "cacheBytes": painted.cache_bytes }).to_string()
}

fn wait_after(painted: &Painted) -> Option<Duration> {
    match (painted.pending, painted.drew) {
        (false, _) => None,
        (true, true) => Some(Duration::ZERO),
        (true, false) => Some(STARVED_RETRY),
    }
}

pub fn spawn(gpu: Gpu, size: (u32, u32), link: Link) {
    std::thread::Builder::new()
        .name("feega-native-canvas".into())
        .spawn(move || {
            priority::interactive();
            let stats = link.stats.clone();
            if let Err(e) = run(gpu, size, link) {
                stats.lock().unwrap().error = e;
            }
        })
        .expect("spawn render thread");
}

struct Work {
    framed: bool,
    changed: bool,
}

fn drain(core: &mut Core, batch: Batch, stats: &Mutex<Stats>) -> Work {
    let edited = !batch.commands.is_empty();
    for command in batch.commands {
        if let Err(e) = core.apply(command) {
            stats.lock().unwrap().error = e;
        }
    }
    let moved = batch.camera.is_some();
    if let Some(camera) = batch.camera {
        core.camera = camera;
    }
    Work { framed: batch.frame || moved, changed: moved || edited }
}

fn run(gpu: Gpu, size: (u32, u32), link: Link) -> Result<(), String> {
    let mut core = Core::new(gpu, size)?;
    let clock0 = Instant::now();
    let now = || clock0.elapsed().as_secs_f64() * 1000.0;
    let mut wait: Option<Duration> = None;
    let mut told = Told::default();
    let mut first = true;

    loop {
        let batch = link.inbox.take(wait);
        if batch.closed {
            return Ok(());
        }
        let work = drain(&mut core, batch, &link.stats);
        if !work.framed && !core.pending {
            wait = None;
            continue;
        }
        if work.changed || core.pending {
            core.hold_drawable();
            let latest = link.inbox.take(Some(Duration::ZERO));
            if latest.closed {
                return Ok(());
            }
            drain(&mut core, latest, &link.stats);
        }

        let started = now();
        let mut clock = now;
        let painted = core.frame(started, &mut clock)?;
        wait = wait_after(&painted);

        if painted.presented {
            let mut stats = link.stats.lock().unwrap();
            if first {
                first = false;
                stats.first_frame_ms = link.started.elapsed().as_secs_f64() * 1000.0;
            }
            stats.record(now(), now() - started);
        }

        let current = Told::of(&painted);
        if current != told {
            (link.report)(message(&painted));
            told = current;
        }
    }
}
