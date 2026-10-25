use std::collections::HashMap;
use std::ffi::{c_char, c_void, CStr};
use std::path::Path;
use std::time::Instant;

use gpu_core::display_list::{DisplayList, Item, UseItem};
use gpu_core::engine::Engine;
use gpu_core::groups::{Library, Limits};
use gpu_core::pictures::{picture, Pictures};
use objc2::rc::Retained;
use objc2::runtime::ProtocolObject;
use objc2_io_surface::IOSurfaceRef;
use objc2_metal::{MTLDevice, MTLPixelFormat, MTLTexture, MTLTextureDescriptor, MTLTextureUsage};
use serde::Deserialize;
use vello::kurbo::Affine;
use vello::wgpu;

const LIMITS: Limits = Limits { side: 4096, rasters: 2, items: 96 };
const BACKGROUND: [f32; 4] = [0.071, 0.071, 0.071, 1.0];
const TAU: f64 = std::f64::consts::TAU;

#[derive(Deserialize)]
struct Motion {
    clip: String,
    group: String,
    x: f64,
    y: f64,
    anim: String,
    period: f64,
    amp: f64,
}

#[derive(Deserialize)]
struct SceneFile {
    groups: HashMap<String, DisplayList>,
    uses: Vec<UseItem>,
    images: HashMap<String, String>,
    #[serde(default)]
    motion: Vec<Motion>,
}

struct Target {
    shared: wgpu::Texture,
    work: wgpu::Texture,
    width: u32,
    height: u32,
}

pub struct Canvas {
    device: wgpu::Device,
    queue: wgpu::Queue,
    engine: Engine,
    library: Library,
    held: Pictures,
    pictures: Pictures,
    uses: Vec<UseItem>,
    motion: Vec<Motion>,
    blitter: wgpu::util::TextureBlitter,
    target: Option<Target>,
}

fn motion_matrix(m: &Motion, t_ms: f64) -> [f64; 6] {
    let phase = (t_ms / m.period) * TAU;
    match m.anim.as_str() {
        "orbit" => [1.0, 0.0, 0.0, 1.0, m.x + m.amp * phase.cos(), m.y + m.amp * phase.sin()],
        "pulse" => {
            let s = 1.0 + 0.25 * phase.sin();
            [s, 0.0, 0.0, s, m.x, m.y]
        }
        _ => [1.0, 0.0, 0.0, 1.0, m.x + m.amp * phase.sin(), m.y],
    }
}

fn decode(path: &Path) -> Option<vello::peniko::ImageData> {
    let img = image::open(path).ok()?.to_rgba8();
    Some(picture(img.width(), img.height(), img.into_raw()))
}

impl Canvas {
    pub fn load(scene: &Path) -> Result<Self, String> {
        let file: SceneFile = serde_json::from_slice(&std::fs::read(scene).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        let dir = scene.parent().unwrap_or(Path::new("."));

        let instance = wgpu::Instance::default();
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions { power_preference: wgpu::PowerPreference::HighPerformance, ..Default::default() })).map_err(|e| format!("{e:?}"))?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(|e| format!("{e:?}"))?;
        let engine = Engine::new(&device).map_err(|e| format!("{e:?}"))?;

        let mut library = Library::new();
        for (key, list) in &file.groups {
            library.put_group(key, list);
        }

        let mut decoded: HashMap<String, vello::peniko::ImageData> = HashMap::new();
        let mut pictures = Pictures::new();
        for (clip, rel) in &file.images {
            if !decoded.contains_key(rel) {
                if let Some(img) = decode(&dir.join(rel)) {
                    decoded.insert(rel.clone(), img);
                }
            }
            if let Some(img) = decoded.get(rel) {
                pictures.insert(clip.clone(), img.clone());
            }
        }

        let blitter = wgpu::util::TextureBlitter::new(&device, wgpu::TextureFormat::Bgra8Unorm);
        Ok(Self { device, queue, engine, library, held: Pictures::new(), pictures, uses: file.uses, motion: file.motion, blitter, target: None })
    }

    /// # Safety
    /// `surface` must be a live IOSurfaceRef of `width`x`height` BGRA8 pixels.
    pub unsafe fn attach(&mut self, surface: *mut c_void, width: u32, height: u32) -> Result<(), String> {
        let hal_device = self.device.as_hal::<wgpu::hal::api::Metal>().ok_or("not metal")?;
        let raw = hal_device.raw_device();
        let desc = MTLTextureDescriptor::texture2DDescriptorWithPixelFormat_width_height_mipmapped(MTLPixelFormat::BGRA8Unorm, width as usize, height as usize, false);
        desc.setUsage(MTLTextureUsage::RenderTarget | MTLTextureUsage::ShaderRead);
        let surface = &*(surface as *const IOSurfaceRef);
        let texture: Retained<ProtocolObject<dyn MTLTexture>> = raw.newTextureWithDescriptor_iosurface_plane(&desc, surface, 0).ok_or("iosurface texture")?;
        drop(hal_device);

        let size = wgpu::Extent3d { width, height, depth_or_array_layers: 1 };
        let hal_texture = wgpu::hal::metal::Device::texture_from_raw(texture, wgpu::TextureFormat::Bgra8Unorm, objc2_metal::MTLTextureType::Type2D, 1, 1, wgpu::hal::CopyExtent { width, height, depth: 1 }, None);
        let shared = self.device.create_texture_from_hal::<wgpu::hal::api::Metal>(
            hal_texture,
            &wgpu::TextureDescriptor { label: Some("shared"), size, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Bgra8Unorm, usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] },
            wgpu::TextureUses::UNINITIALIZED,
        );
        let work = self.device.create_texture(&wgpu::TextureDescriptor { label: Some("work"), size, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] });
        self.target = Some(Target { shared, work, width, height });
        Ok(())
    }

    fn screen(&self, camera: [f64; 6], t_ms: f64, width: u32, height: u32) -> DisplayList {
        let cam = Affine::new(camera);
        let place = |u: &UseItem, m: [f64; 6]| Item::Use(UseItem { matrix: (cam * Affine::new(m)).as_coeffs(), ..u.clone() });
        let moving: HashMap<&str, &Motion> = self.motion.iter().map(|m| (m.clip.as_str(), m)).collect();
        let items = self.uses.iter().map(|u| match moving.get(u.clip.as_str()) {
            Some(m) => place(&UseItem { group: m.group.clone(), ..u.clone() }, motion_matrix(m, t_ms)),
            None => place(u, u.matrix),
        });
        DisplayList { width, height, background: Some(BACKGROUND), items: items.collect(), faces: Vec::new(), fragments: Default::default() }
    }

    pub fn render(&mut self, camera: [f64; 6], t_ms: f64) -> Result<f64, String> {
        let start = Instant::now();
        let Some(target) = &self.target else { return Err("no target".into()) };
        let (width, height) = (target.width, target.height);
        let list = self.screen(camera, t_ms, width, height);

        let plan = self.library.plan(&list, LIMITS);
        let (list, _) = self.engine.hold(&mut self.held, plan, &self.pictures, &self.device, &self.queue).map_err(|e| format!("{e:?}"))?;
        let pictures: Pictures = self.pictures.iter().chain(&self.held).map(|(k, v)| (k.clone(), v.clone())).collect();

        let target = self.target.as_ref().unwrap();
        let work = target.work.create_view(&Default::default());
        self.engine.draw(&self.device, &self.queue, &list, &pictures, &work).map_err(|e| format!("{e:?}"))?;

        let shared = target.shared.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&Default::default());
        self.blitter.copy(&self.device, &mut encoder, &work, &shared);
        self.queue.submit([encoder.finish()]);
        self.device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).map_err(|e| format!("{e:?}"))?;
        Ok(start.elapsed().as_secs_f64() * 1000.0)
    }
}

/// # Safety
/// `path` must be a NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn fc_new(path: *const c_char) -> *mut Canvas {
    let path = CStr::from_ptr(path).to_string_lossy().into_owned();
    match Canvas::load(Path::new(&path)) {
        Ok(c) => Box::into_raw(Box::new(c)),
        Err(e) => {
            eprintln!("fc_new: {e}");
            std::ptr::null_mut()
        }
    }
}

/// # Safety
/// `canvas` from `fc_new`; `surface` a live IOSurfaceRef.
#[no_mangle]
pub unsafe extern "C" fn fc_attach(canvas: *mut Canvas, surface: *mut c_void, width: u32, height: u32) -> i32 {
    match (*canvas).attach(surface, width, height) {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("fc_attach: {e}");
            -1
        }
    }
}

/// # Safety
/// `canvas` from `fc_new`.
#[no_mangle]
pub unsafe extern "C" fn fc_render(canvas: *mut Canvas, a: f64, b: f64, c: f64, d: f64, e: f64, f: f64, t_ms: f64) -> f64 {
    (*canvas).render([a, b, c, d, e, f], t_ms).unwrap_or_else(|err| {
        eprintln!("fc_render: {err}");
        -1.0
    })
}

/// # Safety
/// `canvas` from `fc_new`.
#[no_mangle]
pub unsafe extern "C" fn fc_move(canvas: *mut Canvas, index: u32, x: f64, y: f64) {
    if let Some(u) = (&mut *canvas).uses.get_mut(index as usize) {
        u.matrix[4] = x;
        u.matrix[5] = y;
    }
}
