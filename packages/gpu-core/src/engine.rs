use vello::kurbo::{Affine, Rect};
use vello::peniko::{color::AlphaColor, Color, ImageData};
use vello::wgpu;
use vello::{AaConfig, AaSupport, RenderParams, RendererOptions, Scene};

use crate::display_list::{DisplayList, Rgba};
use crate::groups::{is_cache_clip, Plan};
use crate::filter_passes::{layer_texture, FilterPasses, WgpuRunner};
use crate::layers::{prepare, Surface};
use crate::pictures::Pictures;
use crate::scene::{build, Placed};
use crate::Skipped;

pub struct Engine {
    pub vello: vello::Renderer,
    filters: FilterPasses,
}

pub type EngineError = vello::Error;

struct Gpu<'a> {
    vello: &'a mut vello::Renderer,
    runner: WgpuRunner<'a>,
    width: u32,
    height: u32,
    pictures: &'a Pictures,
}

fn base(colour: Option<Rgba>) -> Color {
    colour.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT)
}

impl Gpu<'_> {
    fn render(&mut self, scene: &Scene, base: Color, target: &wgpu::TextureView, (width, height): (u32, u32)) -> Result<(), EngineError> {
        for (clip, image) in self.pictures {
            if !is_cache_clip(clip) {
                self.vello.mark_override_image_dirty(image);
            }
        }
        let params = RenderParams { base_color: base, width, height, antialiasing_method: AaConfig::Area };
        self.vello.render_to_texture(self.runner.device, self.runner.queue, scene, target, &params)
    }
}

impl<'a> Surface for Gpu<'a> {
    type Canvas = Scene;
    type Runner = WgpuRunner<'a>;
    type Error = EngineError;

    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, self.width as f64, self.height as f64)
    }

    fn paint(&mut self, region: Rect, colour: Option<Rgba>, draw: &dyn Fn(&mut Scene)) -> Result<wgpu::Texture, EngineError> {
        let size = (region.width() as u32, region.height() as u32);
        let texture = layer_texture(self.runner.device, size.0, size.1);
        let mut scene = Scene::new();
        draw(&mut scene);
        let mut moved = Scene::new();
        moved.append(&scene, Some(Affine::translate((-region.x0, -region.y0))));
        self.render(&moved, base(colour), &texture.create_view(&wgpu::TextureViewDescriptor::default()), size)?;
        Ok(texture)
    }

    fn runner(&self) -> &Self::Runner {
        &self.runner
    }

    fn place(&mut self, texture: wgpu::Texture, region: Rect) -> Placed {
        Placed { image: self.vello.register_texture(texture), origin: region.origin() }
    }
}

impl Engine {
    pub fn new(device: &wgpu::Device) -> Result<Self, EngineError> {
        let vello = vello::Renderer::new(device, RendererOptions { antialiasing_support: AaSupport::area_only(), ..Default::default() })?;
        Ok(Self { vello, filters: FilterPasses::new(device) })
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures, target: &wgpu::TextureView) -> Result<Vec<Skipped>, EngineError> {
        let mut gpu = Gpu { vello: &mut self.vello, runner: WgpuRunner { device, queue, passes: &self.filters }, width: list.width, height: list.height, pictures };
        let layers = prepare(&mut gpu, list, pictures)?;
        let (scene, skipped) = build(list, pictures, &layers);
        let drawn = gpu.render(&scene, base(list.background), target, (list.width, list.height));
        for image in layers.into_images() {
            gpu.vello.unregister_texture(image);
        }
        drawn.map(|_| skipped)
    }

    pub fn raster(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures) -> Result<(ImageData, Vec<Skipped>), EngineError> {
        let texture = layer_texture(device, list.width, list.height);
        let skipped = self.draw(device, queue, list, pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default()))?;
        Ok((self.vello.register_texture(texture), skipped))
    }

    pub fn hold(&mut self, held: &mut Pictures, plan: Plan, pictures: &Pictures, device: &wgpu::Device, queue: &wgpu::Queue) -> Result<(DisplayList, Vec<Skipped>), EngineError> {
        for clip in &plan.evicted {
            if let Some(old) = held.remove(clip) {
                self.vello.unregister_texture(old);
            }
        }
        let mut skipped = plan.skipped;
        for raster in plan.rasters {
            let both: Pictures = pictures.iter().chain(held.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
            let (image, missed) = self.raster(device, queue, &raster.list, &both)?;
            skipped.extend(missed);
            if let Some(old) = held.insert(raster.clip, image) {
                self.vello.unregister_texture(old);
            }
        }
        Ok((plan.screen, skipped))
    }
}
