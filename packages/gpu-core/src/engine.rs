use vello::kurbo::{Affine, Rect};
use vello::peniko::{color::AlphaColor, Color};
use vello::wgpu;
use vello::{AaConfig, AaSupport, RenderParams, RendererOptions, Scene};

use crate::display_list::{Cover, DisplayList, Item, Look, MaskMode};
use crate::filter_passes::FilterPasses;
use crate::filters::Fx;
use crate::passes::{layer_texture, Fold, Passes};
use crate::pictures::Pictures;
use crate::scene::{alone, bounds, build, cover, layer_worthy, plain, silhouette, Layers, Placed};
use crate::Skipped;

const UNIT_SPACE: [f64; 4] = [1.0, 0.0, 0.0, 1.0];
const REACH: f64 = 3.0;
const SLACK: f64 = 2.0;

fn reach(sigma: f64) -> f64 {
    if sigma > 0.0 {
        sigma * REACH + SLACK
    } else {
        SLACK
    }
}

fn snapped(r: Rect, frame: Rect) -> Rect {
    let r = r.intersect(frame);
    Rect::new(r.x0.floor(), r.y0.floor(), r.x1.ceil().max(r.x0.floor() + 1.0), r.y1.ceil().max(r.y0.floor() + 1.0))
}

pub struct Engine {
    pub vello: vello::Renderer,
    passes: Passes,
    filters: FilterPasses,
}

pub type EngineError = vello::Error;

struct Gpu<'a> {
    device: &'a wgpu::Device,
    queue: &'a wgpu::Queue,
    width: u32,
    height: u32,
    pictures: &'a Pictures,
}

impl Engine {
    pub fn new(device: &wgpu::Device) -> Result<Self, EngineError> {
        let vello = vello::Renderer::new(device, RendererOptions { antialiasing_support: AaSupport::area_only(), ..Default::default() })?;
        Ok(Self { vello, passes: Passes::new(device), filters: FilterPasses::new(device) })
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures, target: &wgpu::TextureView) -> Result<Vec<Skipped>, EngineError> {
        let gpu = Gpu { device, queue, width: list.width, height: list.height, pictures };
        let base: Color = list.background.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT);
        let mut layers = Layers::new();
        for (i, item) in list.items.iter().enumerate() {
            if let Some(sigma) = item.look().and_then(|l| l.backdrop) {
                let layer = self.behind(&gpu, list, i, &layers, pictures, base, sigma)?;
                layers.behind.insert(i, layer);
            }
            if layer_worthy(item) {
                let layer = self.layer(&gpu, item, pictures)?;
                layers.bodies.insert(i, layer);
            }
        }
        let (scene, skipped) = build(list, pictures, &layers);
        let drawn = self.render(&gpu, &scene, base, target, (gpu.width, gpu.height));
        for image in layers.into_images() {
            self.vello.unregister_texture(image);
        }
        drawn.map(|_| skipped)
    }

    fn render(&mut self, gpu: &Gpu, scene: &Scene, base: Color, target: &wgpu::TextureView, (width, height): (u32, u32)) -> Result<(), EngineError> {
        for image in gpu.pictures.values() {
            self.vello.mark_override_image_dirty(image);
        }
        let params = RenderParams { base_color: base, width, height, antialiasing_method: AaConfig::Area };
        self.vello.render_to_texture(gpu.device, gpu.queue, scene, target, &params)
    }

    fn frame(gpu: &Gpu) -> Rect {
        Rect::new(0.0, 0.0, gpu.width as f64, gpu.height as f64)
    }

    fn paint(&mut self, gpu: &Gpu, scene: &Scene, region: Rect, base: Color) -> Result<wgpu::Texture, EngineError> {
        let size = (region.width() as u32, region.height() as u32);
        let texture = layer_texture(gpu.device, size.0, size.1);
        let mut moved = Scene::new();
        moved.append(scene, Some(Affine::translate((-region.x0, -region.y0))));
        self.render(gpu, &moved, base, &texture.create_view(&wgpu::TextureViewDescriptor::default()), size)?;
        Ok(texture)
    }

    fn place(&mut self, texture: wgpu::Texture, region: Rect) -> Placed {
        Placed { image: self.vello.register_texture(texture), origin: region.origin() }
    }

    #[allow(clippy::too_many_arguments)]
    fn behind(&mut self, gpu: &Gpu, list: &DisplayList, at: usize, layers: &Layers, pictures: &Pictures, base: Color, sigma: f64) -> Result<Placed, EngineError> {
        let frame = Self::frame(gpu);
        let item = &list.items[at];
        let margin = reach(sigma);
        let region = snapped(bounds(item, pictures).unwrap_or(frame).inflate(margin, margin), frame);
        let under = DisplayList { items: list.items[..at].to_vec(), ..list.clone_empty() };
        let (scene, _) = build(&under, pictures, layers);
        let below = self.paint(gpu, &scene, region, base)?;
        let soft = self.passes.blur(gpu.device, gpu.queue, below, sigma);
        let shape = self.paint(gpu, &silhouette(item, pictures, frame), region, Color::TRANSPARENT)?;
        let texture = self.passes.apply(gpu.device, gpu.queue, &soft, &shape);
        Ok(self.place(texture, region))
    }

    fn region(gpu: &Gpu, item: &Item, look: &Look, pictures: &Pictures) -> Rect {
        let frame = Self::frame(gpu);
        if look.filters.is_some() {
            return frame;
        }
        let feather = look.masks.iter().flatten().map(|m| m.feather).fold(0.0, f64::max);
        let margin = reach(look.blur) + reach(feather);
        snapped(bounds(item, pictures).unwrap_or(frame).inflate(margin, margin), frame)
    }

    fn layer(&mut self, gpu: &Gpu, item: &Item, pictures: &Pictures) -> Result<Placed, EngineError> {
        let frame = Self::frame(gpu);
        let look = item.look().expect("a drawable item");
        let region = Self::region(gpu, item, look, pictures);
        let body = self.paint(gpu, &alone(item, pictures, frame), region, Color::TRANSPARENT)?;
        let body = match &look.filters {
            Some(filters) => Fx { device: gpu.device, queue: gpu.queue, passes: &self.filters }.apply(body, filters, look.space.unwrap_or(UNIT_SPACE)),
            None => body,
        };
        let body = self.passes.blur(gpu.device, gpu.queue, body, look.blur);
        let texture = match self.mask(gpu, look, pictures, region)? {
            Some(mask) => self.passes.apply(gpu.device, gpu.queue, &body, &mask),
            None => body,
        };
        Ok(self.place(texture, region))
    }

    fn mask(&mut self, gpu: &Gpu, look: &Look, pictures: &Pictures, region: Rect) -> Result<Option<wgpu::Texture>, EngineError> {
        let frame = Self::frame(gpu);
        let mut acc: Option<wgpu::Texture> = None;
        for layer in look.masks.iter().flatten() {
            let covered = self.paint(gpu, &cover(&layer.cover, pictures), region, Color::TRANSPARENT)?;
            let covered = self.passes.blur(gpu.device, gpu.queue, covered, layer.feather);
            let luma = matches!(layer.cover, Cover::Picture { luma: true, .. });
            acc = Some(self.passes.fold(gpu.device, gpu.queue, acc.as_ref(), &covered, Fold { mode: layer.mode, level: layer.level, invert: layer.invert, luma }));
        }
        if let Some(matte) = &look.matte {
            let covered = self.paint(gpu, &plain(&matte.items, pictures, frame), region, Color::TRANSPARENT)?;
            acc = Some(self.passes.fold(gpu.device, gpu.queue, acc.as_ref(), &covered, Fold { mode: MaskMode::Intersect, level: 1.0, invert: matte.invert, luma: matte.luma }));
        }
        Ok(acc)
    }
}
