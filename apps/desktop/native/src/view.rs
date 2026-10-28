use std::ptr::NonNull;

use objc2::rc::Retained;
use objc2::MainThreadMarker;
use objc2_app_kit::{NSBox, NSBoxType, NSColor, NSView, NSWindowOrderingMode};
use objc2_foundation::{NSPoint, NSRect, NSSize};
use vello::wgpu;

use crate::worker::Gpu;

const POINTER_BYTES: usize = 8;
const FRAME_LATENCY: u32 = 2;
const UNCAPPED_ENV: &str = "FEEGA_NATIVE_UNCAPPED";

fn present_mode() -> wgpu::PresentMode {
    match std::env::var_os(UNCAPPED_ENV) {
        Some(_) => wgpu::PresentMode::Immediate,
        None => wgpu::PresentMode::Fifo,
    }
}

pub struct Placement {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub struct Layers {
    backdrop: Retained<NSBox>,
    canvas: Retained<NSView>,
}

fn rect_in(parent: &NSView, at: &Placement) -> NSRect {
    let parent_height = parent.frame().size.height;
    let y = if parent.isFlipped() { at.y } else { parent_height - at.y - at.height };
    NSRect::new(NSPoint::new(at.x, y), NSSize::new(at.width, at.height))
}

fn backdrop(mtm: MainThreadMarker, frame: NSRect, [red, green, blue]: [f64; 3]) -> Retained<NSBox> {
    let backdrop = NSBox::initWithFrame(mtm.alloc(), frame);
    backdrop.setBoxType(NSBoxType::Custom);
    backdrop.setBorderWidth(0.0);
    backdrop.setFillColor(&NSColor::colorWithSRGBRed_green_blue_alpha(red, green, blue, 1.0));
    backdrop
}

impl Layers {
    pub fn attach(handle: &[u8], at: &Placement, colour: [f64; 3]) -> Result<Layers, String> {
        let mtm = MainThreadMarker::new().ok_or("not on the main thread")?;
        let bytes: [u8; POINTER_BYTES] = handle.get(..POINTER_BYTES).and_then(|b| b.try_into().ok()).ok_or("short window handle")?;
        let parent = unsafe { Retained::retain(usize::from_ne_bytes(bytes) as *mut NSView) }.ok_or("null window handle")?;
        let frame = rect_in(&parent, at);
        let backdrop = backdrop(mtm, frame, colour);
        let canvas = NSView::initWithFrame(mtm.alloc(), frame);
        parent.addSubview_positioned_relativeTo(&backdrop, NSWindowOrderingMode::Below, None);
        parent.addSubview_positioned_relativeTo(&canvas, NSWindowOrderingMode::Above, Some(&backdrop));
        Ok(Layers { backdrop, canvas })
    }

    pub fn place(&self, at: &Placement) {
        let Some(parent) = (unsafe { self.canvas.superview() }) else {
            return;
        };
        let frame = rect_in(&parent, at);
        self.backdrop.setFrame(frame);
        self.canvas.setFrame(frame);
    }

    pub fn remove(&self) {
        self.canvas.removeFromSuperview();
        self.backdrop.removeFromSuperview();
    }

    pub fn gpu(&self, (width, height): (u32, u32)) -> Result<Gpu, String> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor { backends: wgpu::Backends::METAL, ..wgpu::InstanceDescriptor::new_without_display_handle() });
        let handle = raw_window_handle::AppKitWindowHandle::new(NonNull::from(&*self.canvas).cast());
        let surface = unsafe {
            instance.create_surface_unsafe(wgpu::SurfaceTargetUnsafe::RawHandle {
                raw_display_handle: Some(raw_window_handle::RawDisplayHandle::AppKit(raw_window_handle::AppKitDisplayHandle::new())),
                raw_window_handle: raw_window_handle::RawWindowHandle::AppKit(handle),
            })
        }
        .map_err(|e| format!("{e:?}"))?;
        let options = wgpu::RequestAdapterOptions { compatible_surface: Some(&surface), power_preference: wgpu::PowerPreference::HighPerformance, ..Default::default() };
        let adapter = pollster::block_on(instance.request_adapter(&options)).map_err(|e| format!("{e:?}"))?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).map_err(|e| format!("{e:?}"))?;
        let format = surface.get_capabilities(&adapter).formats.into_iter().find(|f| !f.is_srgb()).ok_or("no linear surface format")?;
        let configuration = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width,
            height,
            present_mode: present_mode(),
            alpha_mode: wgpu::CompositeAlphaMode::PostMultiplied,
            view_formats: vec![],
            desired_maximum_frame_latency: FRAME_LATENCY,
            color_space: wgpu::SurfaceColorSpace::Auto,
        };
        surface.configure(&device, &configuration);
        Ok(Gpu { device, queue, surface, configuration })
    }
}
