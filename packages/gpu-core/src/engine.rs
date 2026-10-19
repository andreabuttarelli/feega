use vello::kurbo::Rect;
use vello::peniko::{color::AlphaColor, Color};
use vello::wgpu;
use vello::{AaConfig, AaSupport, RenderParams, RendererOptions, Scene};

use crate::display_list::{Cover, DisplayList, Item, Look, MaskMode};
use crate::passes::{layer_texture, Fold, Passes};
use crate::pictures::Pictures;
use crate::scene::{alone, build, cover, layer_worthy, plain, Layers};
use crate::Skipped;

pub struct Engine {
    pub vello: vello::Renderer,
    passes: Passes,
}

pub type EngineError = vello::Error;

struct Gpu<'a> {
    device: &'a wgpu::Device,
    queue: &'a wgpu::Queue,
    width: u32,
    height: u32,
}

impl Engine {
    pub fn new(device: &wgpu::Device) -> Result<Self, EngineError> {
        let vello = vello::Renderer::new(device, RendererOptions { antialiasing_support: AaSupport::area_only(), ..Default::default() })?;
        Ok(Self { vello, passes: Passes::new(device) })
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures, target: &wgpu::TextureView) -> Result<Vec<Skipped>, EngineError> {
        let gpu = Gpu { device, queue, width: list.width, height: list.height };
        let mut layers = Layers::new();
        for (i, item) in list.items.iter().enumerate().filter(|(_, item)| layer_worthy(item)) {
            let texture = self.layer(&gpu, item, pictures)?;
            layers.insert(i, self.vello.register_texture(texture));
        }
        let (scene, skipped) = build(list, pictures, &layers);
        let base: Color = list.background.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT);
        let drawn = self.render(&gpu, &scene, base, target);
        for image in layers.into_values() {
            self.vello.unregister_texture(image);
        }
        drawn.map(|_| skipped)
    }

    fn render(&mut self, gpu: &Gpu, scene: &Scene, base: Color, target: &wgpu::TextureView) -> Result<(), EngineError> {
        let params = RenderParams { base_color: base, width: gpu.width, height: gpu.height, antialiasing_method: AaConfig::Area };
        self.vello.render_to_texture(gpu.device, gpu.queue, scene, target, &params)
    }

    fn paint(&mut self, gpu: &Gpu, scene: &Scene) -> Result<wgpu::Texture, EngineError> {
        let texture = layer_texture(gpu.device, gpu.width, gpu.height);
        self.render(gpu, scene, Color::TRANSPARENT, &texture.create_view(&wgpu::TextureViewDescriptor::default()))?;
        Ok(texture)
    }

    fn layer(&mut self, gpu: &Gpu, item: &Item, pictures: &Pictures) -> Result<wgpu::Texture, EngineError> {
        let frame = Rect::new(0.0, 0.0, gpu.width as f64, gpu.height as f64);
        let look = item.look().expect("a drawable item");
        let body = self.paint(gpu, &alone(item, pictures, frame))?;
        let body = self.passes.blur(gpu.device, gpu.queue, body, look.blur);
        Ok(match self.mask(gpu, look, pictures, frame)? {
            Some(mask) => self.passes.apply(gpu.device, gpu.queue, &body, &mask),
            None => body,
        })
    }

    fn mask(&mut self, gpu: &Gpu, look: &Look, pictures: &Pictures, frame: Rect) -> Result<Option<wgpu::Texture>, EngineError> {
        let mut acc: Option<wgpu::Texture> = None;
        for layer in look.masks.iter().flatten() {
            let covered = self.paint(gpu, &cover(&layer.cover, pictures))?;
            let covered = self.passes.blur(gpu.device, gpu.queue, covered, layer.feather);
            let luma = matches!(layer.cover, Cover::Picture { luma: true, .. });
            acc = Some(self.passes.fold(gpu.device, gpu.queue, acc.as_ref(), &covered, Fold { mode: layer.mode, level: layer.level, invert: layer.invert, luma }));
        }
        if let Some(matte) = &look.matte {
            let covered = self.paint(gpu, &plain(&matte.items, pictures, frame))?;
            acc = Some(self.passes.fold(gpu.device, gpu.queue, acc.as_ref(), &covered, Fold { mode: MaskMode::Intersect, level: 1.0, invert: matte.invert, luma: matte.luma }));
        }
        Ok(acc)
    }
}
