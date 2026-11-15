use rustc_hash::FxHashMap;

use vello::kurbo::{Affine, Point, Rect};
use vello::peniko::{color::AlphaColor, Color, Fill, Gradient, ImageData};
use vello::wgpu;
use vello::{AaConfig, AaSupport, RenderParams, RendererOptions, Scene};

use crate::atlas::Packer;
use crate::display_list::{Cover, DisplayList, Item, Rgba};
use crate::groups::Plan;
use crate::filter_passes::{layer_texture, FilterPasses, Pooled, WgpuRunner};
use crate::layer_key::{layer_key, LayerKey};
use crate::layers::{prepare, Blending, Surface};
use crate::pictures::Pictures;
use crate::scene::{build_into, Placed};
use crate::tally::{now_ms, Reason, Tally};
use crate::texture_budget::{bytes_of, over_cap};
use crate::Skipped;

const KEPT_LAYERS: usize = 32;
const SPARE_TEXTURES: usize = 4;
const KEPT_FRAMES: u64 = 240;
const LAYER_BYTES: u64 = 32 * 1024 * 1024;
const KEYED_POINTS_MAX: usize = 1000;
const OFF_TARGET: Rect = Rect::new(-2.0, -2.0, -1.0, -1.0);
const SHEET_SIDE: u32 = 2048;
const SHEET_FULLNESS: f64 = 0.5;

struct Cached {
    image: ImageData,
    origin: Point,
    _texture: Pooled,
    used: u64,
}

struct LayerCache {
    entries: FxHashMap<LayerKey, Cached>,
    tick: u64,
    cap: u64,
}

impl Default for LayerCache {
    fn default() -> Self {
        LayerCache { entries: FxHashMap::default(), tick: 0, cap: LAYER_BYTES }
    }
}

impl LayerCache {
    fn holds(&self, image: &ImageData) -> bool {
        self.entries.values().any(|c| c.image.data.id() == image.data.id())
    }

    fn sweep(&mut self, vello: &mut vello::Renderer) {
        self.tick += 1;
        let tick = self.tick;
        let mut stale: Vec<LayerKey> = self.entries.iter().filter(|(_, c)| c.used + KEPT_FRAMES < tick).map(|(k, _)| k.clone()).collect();
        if self.entries.len() - stale.len() > KEPT_LAYERS {
            let mut rest: Vec<(&LayerKey, u64)> = self.entries.iter().filter(|(k, _)| !stale.contains(k)).map(|(k, c)| (k, c.used)).collect();
            rest.sort_by_key(|(_, used)| *used);
            let excess = rest.len() - KEPT_LAYERS;
            stale.extend(rest.into_iter().take(excess).map(|(k, _)| k.clone()));
        }
        let rest: Vec<(LayerKey, u64, u64)> = self.entries.iter().filter(|(k, _)| !stale.contains(k)).map(|(k, c)| (k.clone(), c.used, bytes_of((c._texture.width(), c._texture.height())))).collect();
        stale.extend(over_cap(&rest, self.cap));
        for key in stale {
            if let Some(gone) = self.entries.remove(&key) {
                vello.unregister_texture(gone.image);
            }
        }
    }
}

fn plain_content(item: &Item) -> bool {
    match item {
        Item::Path(_) => clips(std::slice::from_ref(item)).is_empty(),
        Item::Group(group) => clips(std::slice::from_ref(item)).is_empty() && group.items.iter().all(plain_content),
        _ => false,
    }
}

fn corners(contours: &[Vec<f64>]) -> usize {
    contours.iter().map(|c| c.len() / 2).sum()
}

fn points(item: &Item) -> usize {
    let own = match item {
        Item::Path(p) => corners(&p.contours) + p.within.iter().map(|w| corners(&w.contours)).sum::<usize>(),
        Item::Group(g) => g.items.iter().map(points).sum(),
        _ => 0,
    };
    let covers = item.look().and_then(|l| l.masks.as_ref()).into_iter().flatten().map(|m| match &m.cover {
        Cover::Path { contours, .. } | Cover::Ramp { contours, .. } => corners(contours),
        Cover::Picture { .. } => 0,
    });
    own + covers.sum::<usize>()
}

fn reads_itself(list: &DisplayList, clip: &str) -> bool {
    list.items.iter().any(|i| matches!(i, Item::Image(image) if image.clip == clip))
}

fn keyed(item: &Item) -> bool {
    plain_content(item) && points(item) <= KEYED_POINTS_MAX
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Atlas {
    #[default]
    On,
    Off,
}

pub struct Engine {
    pub vello: vello::Renderer,
    pub blending: Blending,
    pub atlas: Atlas,
    filters: FilterPasses,
    cache: LayerCache,
    held: FxHashMap<String, wgpu::Texture>,
    spare: Vec<wgpu::Texture>,
    scenes: Vec<Scene>,
    sheet: Option<wgpu::Texture>,
    tally: Tally,
    drawing: Reason,
    fullness: f64,
    draws: u32,
}

pub type EngineError = vello::Error;

const LINES: u32 = 1 << 21;
const SEGMENTS: u32 = 1 << 21;

pub fn fullness(scene: &Scene) -> f64 {
    let used = scene.bump_estimate(None);
    (used.lines.len() as f64 / LINES as f64).max(used.segments.len() as f64 / SEGMENTS as f64)
}

struct Gpu<'a> {
    vello: &'a mut vello::Renderer,
    runner: WgpuRunner<'a>,
    width: u32,
    height: u32,
    kept: Vec<Pooled>,
    last: Option<Pooled>,
    cache: &'a mut LayerCache,
    scenes: &'a mut Vec<Scene>,
    tally: &'a mut Tally,
    atlas: Atlas,
    sheet: &'a mut Option<wgpu::Texture>,
    open: Option<Sheet>,
    unsettled: rustc_hash::FxHashSet<u64>,
}

struct Sheet {
    scene: Scene,
    packer: Packer,
}

fn reads_any(scene: &Scene, images: &rustc_hash::FxHashSet<u64>) -> bool {
    !images.is_empty() && scene.encoding().resources.patches.iter().any(|p| matches!(p, vello::low_level::vello_encoding::Patch::Image { image, .. } if images.contains(&image.data.id())))
}

fn borrowed(scenes: &mut Vec<Scene>) -> Scene {
    let mut scene = scenes.pop().unwrap_or_default();
    scene.reset();
    scene
}

fn empties_the_atlas(scene: &Scene) -> bool {
    scene.encoding().resources.patches.is_empty()
}

fn atlas_anchor() -> Gradient {
    Gradient::new_linear((0.0, 0.0), (1.0, 0.0)).with_stops([Color::TRANSPARENT, Color::TRANSPARENT])
}

fn clips(items: &[Item]) -> Vec<&str> {
    items
        .iter()
        .flat_map(|item| {
            let own = match item {
                Item::Image(i) => vec![i.clip.as_str()],
                _ => vec![],
            };
            let look = item.look();
            let covers = look.and_then(|l| l.masks.as_ref()).into_iter().flatten().filter_map(|m| match &m.cover {
                Cover::Picture { src, .. } => Some(src.as_str()),
                _ => None,
            });
            let matte = look.and_then(|l| l.matte.as_ref()).map(|m| clips(&m.items)).unwrap_or_default();
            own.into_iter().chain(covers).chain(matte).collect::<Vec<_>>()
        })
        .collect()
}

fn base(colour: Option<Rgba>) -> Color {
    colour.map(AlphaColor::new).unwrap_or(Color::TRANSPARENT)
}

impl Gpu<'_> {
    fn render(&mut self, reason: Reason, scene: &Scene, base: Color, target: &wgpu::TextureView, size: (u32, u32)) -> Result<(), EngineError> {
        self.settle()?;
        let started = now_ms();
        let rendered = self.encode(scene, base, target, size);
        self.tally.add(reason, now_ms() - started);
        rendered
    }

    fn settle(&mut self) -> Result<(), EngineError> {
        self.unsettled.clear();
        let Some(sheet) = self.open.take() else { return Ok(()) };
        let texture = self.sheet.get_or_insert_with(|| layer_texture(self.runner.device, SHEET_SIDE, SHEET_SIDE)).clone();
        let started = now_ms();
        let params = RenderParams { base_color: Color::TRANSPARENT, width: SHEET_SIDE, height: SHEET_SIDE, antialiasing_method: AaConfig::Area };
        let mut anchored = sheet.scene;
        if empties_the_atlas(&anchored) {
            anchored.fill(Fill::NonZero, Affine::IDENTITY, &atlas_anchor(), None, &OFF_TARGET);
        }
        let rendered = self.vello.render_to_texture(self.runner.device, self.runner.queue, &anchored, &texture.create_view(&wgpu::TextureViewDescriptor::default()), &params);
        self.tally.add(Reason::Atlas, now_ms() - started);
        self.scenes.push(anchored);
        self.runner.passes.flush(self.runner.queue);
        rendered
    }

    fn packed(&mut self, region: Rect, colour: Option<Rgba>, drawn: &Scene) -> Result<Option<Pooled>, EngineError> {
        let size = (region.width() as u32, region.height() as u32);
        if size.0 > SHEET_SIDE || size.1 > SHEET_SIDE {
            return Ok(None);
        }
        if reads_any(drawn, &self.unsettled) {
            self.settle()?;
        }
        let mut at = self.open.as_mut().and_then(|s| s.packer.fit(size.0, size.1));
        if at.is_none() || self.open.as_ref().is_some_and(|s| fullness(&s.scene) > SHEET_FULLNESS) {
            self.settle()?;
            let scene = borrowed(self.scenes);
            self.open = Some(Sheet { scene, packer: Packer::new(SHEET_SIDE) });
            at = self.open.as_mut().and_then(|s| s.packer.fit(size.0, size.1));
        }
        let Some((x, y)) = at else { return Ok(None) };
        let sheet = self.open.as_mut().expect("an open sheet");
        let cell = Rect::new(x as f64, y as f64, (x + size.0) as f64, (y + size.1) as f64);
        sheet.scene.push_clip_layer(Fill::NonZero, Affine::IDENTITY, &cell);
        if let Some(colour) = colour {
            sheet.scene.fill(Fill::NonZero, Affine::IDENTITY, base(Some(colour)), None, &cell);
        }
        sheet.scene.append(drawn, Some(Affine::translate((x as f64 - region.x0, y as f64 - region.y0))));
        sheet.scene.pop_layer();
        let texture = self.runner.passes.texture(self.runner.device, size.0, size.1);
        let from = self.sheet.get_or_insert_with(|| layer_texture(self.runner.device, SHEET_SIDE, SHEET_SIDE)).clone();
        self.runner.passes.copy(self.runner.device, &from, (x, y), &texture);
        Ok(Some(texture))
    }

    fn encode(&mut self, scene: &Scene, base: Color, target: &wgpu::TextureView, (width, height): (u32, u32)) -> Result<(), EngineError> {
        self.runner.passes.flush(self.runner.queue);
        let params = RenderParams { base_color: base, width, height, antialiasing_method: AaConfig::Area };
        if !empties_the_atlas(scene) {
            return self.vello.render_to_texture(self.runner.device, self.runner.queue, scene, target, &params);
        }
        let mut anchored = Scene::new();
        anchored.append(scene, None);
        anchored.fill(Fill::NonZero, Affine::IDENTITY, &atlas_anchor(), None, &OFF_TARGET);
        self.vello.render_to_texture(self.runner.device, self.runner.queue, &anchored, target, &params)
    }
}

impl<'a> Surface for Gpu<'a> {
    type Canvas = Scene;
    type Runner = WgpuRunner<'a>;
    type Error = EngineError;

    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, self.width as f64, self.height as f64)
    }

    fn paint(&mut self, reason: Reason, region: Rect, colour: Option<Rgba>, draw: &dyn Fn(&mut Scene)) -> Result<Pooled, EngineError> {
        let size = (region.width() as u32, region.height() as u32);
        let mut scene = borrowed(self.scenes);
        draw(&mut scene);
        if self.atlas == Atlas::On {
            if let Some(texture) = self.packed(region, colour, &scene)? {
                self.scenes.push(scene);
                return Ok(texture);
            }
        }
        let texture = self.runner.passes.texture(self.runner.device, size.0, size.1);
        let mut moved = borrowed(self.scenes);
        moved.append(&scene, Some(Affine::translate((-region.x0, -region.y0))));
        let rendered = self.render(reason, &moved, base(colour), &texture.create_view(&wgpu::TextureViewDescriptor::default()), size);
        self.scenes.extend([scene, moved]);
        rendered.map(|_| texture)
    }

    fn runner(&self) -> &Self::Runner {
        &self.runner
    }

    fn recall(&mut self, item: &Item) -> Option<Placed> {
        if !keyed(item) || item.look().is_some_and(|l| l.backdrop.is_some()) {
            return None;
        }
        let tick = self.cache.tick;
        let cached = self.cache.entries.get_mut(&self.key(item))?;
        cached.used = tick;
        self.vello.mark_override_image_dirty(&cached.image);
        Some(Placed { image: cached.image.clone(), origin: cached.origin })
    }

    fn remember(&mut self, item: &Item, placed: &Placed) {
        if !keyed(item) || item.look().is_some_and(|l| l.backdrop.is_some()) {
            return;
        }
        if let Some(texture) = self.last.take() {
            let used = self.cache.tick;
            let key = self.key(item);
            self.cache.entries.insert(key, Cached { image: placed.image.clone(), origin: placed.origin, _texture: texture, used });
        }
    }

    fn place(&mut self, texture: Pooled, region: Rect) -> Placed {
        let image = self.vello.register_texture((*texture).clone());
        self.unsettled.insert(image.data.id());
        self.last = Some(texture.clone());
        self.kept.push(texture);
        Placed { image, origin: region.origin() }
    }
}

impl Gpu<'_> {
    fn key(&self, item: &Item) -> LayerKey {
        layer_key((self.width, self.height), item)
    }
}

impl Engine {
    pub fn new(device: &wgpu::Device) -> Result<Self, EngineError> {
        let vello = vello::Renderer::new(device, RendererOptions { antialiasing_support: AaSupport::area_only(), ..Default::default() })?;
        Ok(Self { vello, blending: Blending::Native, atlas: Atlas::On, filters: FilterPasses::new(device), cache: LayerCache::default(), held: FxHashMap::default(), spare: Vec::new(), scenes: Vec::new(), sheet: None, tally: Tally::default(), drawing: Reason::Screen, fullness: 0.0, draws: 0 })
    }

    pub fn set_budget(&mut self, pool: u64, layers: u64) {
        self.filters.set_pool_bytes(pool);
        self.cache.cap = layers;
    }

    pub fn take_tally(&mut self) -> Tally {
        std::mem::take(&mut self.tally)
    }

    pub fn take_draws(&mut self) -> u32 {
        std::mem::take(&mut self.draws)
    }

    pub fn cached_layers(&self) -> usize {
        self.cache.entries.len()
    }

    pub fn draw(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures, target: &wgpu::TextureView) -> Result<Vec<Skipped>, EngineError> {
        let mut gpu = Gpu { vello: &mut self.vello, runner: WgpuRunner { device, queue, passes: &self.filters }, width: list.width, height: list.height, kept: Vec::new(), last: None, cache: &mut self.cache, scenes: &mut self.scenes, tally: &mut self.tally, atlas: self.atlas, sheet: &mut self.sheet, open: None, unsettled: Default::default() };
        let layers = prepare(&mut gpu, list, pictures, self.blending)?;
        let mut scene = borrowed(gpu.scenes);
        let skipped = build_into(&mut scene, list, pictures, &layers);
        let fullness = fullness(&scene);
        let drawn = gpu.render(self.drawing, &scene, base(list.background), target, (list.width, list.height));
        gpu.scenes.push(scene);
        for image in layers.into_images() {
            if !gpu.cache.holds(&image) {
                gpu.vello.unregister_texture(image);
            }
        }
        gpu.cache.sweep(gpu.vello);
        self.fullness = fullness;
        self.draws += 1;
        drawn.map(|_| skipped)
    }

    pub fn fullness(&self) -> f64 {
        self.fullness
    }

    fn raster(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, list: &DisplayList, pictures: &Pictures) -> Result<(ImageData, wgpu::Texture, Vec<Skipped>), EngineError> {
        let texture = self.reused(list.width, list.height).unwrap_or_else(|| layer_texture(device, list.width, list.height));
        self.drawing = Reason::Raster;
        let drawn = self.draw(device, queue, list, pictures, &texture.create_view(&wgpu::TextureViewDescriptor::default()));
        self.drawing = Reason::Screen;
        let skipped = drawn?;
        Ok((self.vello.register_texture(texture.clone()), texture, skipped))
    }

    pub fn held(&self, clip: &str) -> Option<&wgpu::Texture> {
        self.held.get(clip)
    }

    fn reused(&mut self, width: u32, height: u32) -> Option<wgpu::Texture> {
        let at = self.spare.iter().position(|t| t.width() == width && t.height() == height)?;
        Some(self.spare.swap_remove(at))
    }

    fn release(&mut self, clip: &str, image: ImageData) {
        self.vello.unregister_texture(image);
        let Some(texture) = self.held.remove(clip) else { return };
        self.spare.push(texture);
        if self.spare.len() > SPARE_TEXTURES {
            self.spare.remove(0).destroy();
        }
    }

    pub fn scratch_bytes(&self) -> u64 {
        let layers: u64 = self.cache.entries.values().map(|c| bytes_of((c._texture.width(), c._texture.height()))).sum();
        self.filters.pooled_bytes() + layers + self.spare_bytes()
    }

    pub fn spare_bytes(&self) -> u64 {
        self.spare.iter().map(|t| t.width() as u64 * t.height() as u64 * 4).sum()
    }

    pub fn hold(&mut self, held: &mut Pictures, plan: Plan, pictures: &Pictures, device: &wgpu::Device, queue: &wgpu::Queue) -> Result<(DisplayList, Vec<Skipped>), EngineError> {
        for clip in &plan.evicted {
            if let Some(old) = held.remove(clip) {
                self.release(clip, old);
            }
        }
        let mut skipped = plan.skipped;
        for raster in plan.rasters {
            if !reads_itself(&raster.list, &raster.clip) {
                if let Some(old) = held.remove(&raster.clip) {
                    self.release(&raster.clip, old);
                }
            }
            let both: Pictures = pictures.iter().chain(held.iter()).map(|(k, v)| (k.clone(), v.clone())).collect();
            let (image, texture, missed) = self.raster(device, queue, &raster.list, &both)?;
            skipped.extend(missed);
            if let Some(old) = held.remove(&raster.clip) {
                self.release(&raster.clip, old);
            }
            held.insert(raster.clip.clone(), image);
            self.held.insert(raster.clip, texture);
        }
        Ok((plan.screen, skipped))
    }
}
