use vello::kurbo::{Affine as Matrix, Rect};

use crate::display_list::Item;
use crate::groups::{Library, Limits, Plan, Unseen};
use crate::retained::{tiles, Camera, Damage, Lookup, Outcome, Quality, Raster, Retained, Step};
use crate::tile_pyramid::{cover, side, Cover, Key, Pyramid, Target};
use crate::world::{OverlayPart, Patch, World};
use crate::Skipped;

const RENDER_TILE_PX: u32 = 1024;
const ZOOM_IDLE_MS: f64 = 100.0;
const TILE_BUDGET_MS: f64 = 4.0;
const TILES_PER_FRAME: usize = 4;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RasterMode {
    Retained,
    Tiles,
}

pub fn render_tile(max_texture: u32) -> (u32, u32) {
    let side = max_texture.min(RENDER_TILE_PX);
    (side, side)
}

pub trait Painter {
    type Error;
    fn limits(&self) -> Limits;
    fn tile(&self) -> (u32, u32);
    fn shift(&mut self, by: (i32, i32)) -> Result<(), Self::Error>;
    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, Self::Error>;
    fn present(&mut self, look: Lookup) -> Result<(), Self::Error>;
}

pub trait TilePainter: Painter {
    fn paint_tile(&mut self, key: Key, plan: Plan) -> Result<Vec<Skipped>, Self::Error>;
    fn drop_tiles(&mut self, keys: &[Key]);
    fn present_tiles(&mut self, covers: &[Cover]) -> Result<(), Self::Error>;
}

struct Tiles {
    pyramid: Pyramid,
    zoom_seen: f64,
    zoom_moved_at: f64,
    shown: Option<Camera>,
}

impl Tiles {
    fn target(&mut self, camera: Camera, now_ms: f64) -> Target {
        if camera.zoom != self.zoom_seen {
            self.zoom_seen = camera.zoom;
            self.zoom_moved_at = now_ms;
        }
        if now_ms - self.zoom_moved_at < ZOOM_IDLE_MS {
            return Target::Gesture;
        }
        Target::Settled
    }
}

pub struct Frame {
    pub outcome: Option<Outcome>,
    pub pending: bool,
    pub skipped: Vec<Skipped>,
    pub rastered: usize,
    pub sharp_full: bool,
}

impl Frame {
    pub fn report(&self) -> String {
        let head = self.outcome.map_or("idle", Outcome::name);
        std::iter::once(head.to_string()).chain(self.skipped.iter().map(|s| format!("{} {}", s.clip, s.what))).collect::<Vec<_>>().join("\n")
    }
}

pub struct Compositor {
    world: World,
    retained: Retained,
    pending: bool,
    viewport: (u32, u32),
    tiles: Option<Tiles>,
}

impl Compositor {
    pub fn new(width: u32, height: u32) -> Self {
        Compositor { world: World::new(), retained: Retained::new(width, height), pending: false, viewport: (width, height), tiles: None }
    }

    pub fn set_mode(&mut self, mode: RasterMode, cap: u64) {
        self.tiles = match mode {
            RasterMode::Retained => None,
            RasterMode::Tiles => Some(Tiles { pyramid: Pyramid::new(cap), zoom_seen: 0.0, zoom_moved_at: f64::NEG_INFINITY, shown: None }),
        };
    }

    pub fn mode(&self) -> RasterMode {
        match self.tiles {
            Some(_) => RasterMode::Tiles,
            None => RasterMode::Retained,
        }
    }

    pub fn set_tile_cap(&mut self, cap: u64) {
        if let Some(tiles) = self.tiles.as_mut() {
            tiles.pyramid.set_cap(cap);
        }
    }

    pub fn tile_bytes(&self) -> u64 {
        self.tiles.as_ref().map_or(0, |t| t.pyramid.bytes())
    }

    pub fn size(&self) -> (u32, u32) {
        self.retained.size()
    }

    pub fn patch(&mut self, patch: Patch, library: &Library) {
        self.world.patch(patch, |g| library.size_of(g));
    }

    pub fn set_overlay(&mut self, part: OverlayPart, items: Vec<Item>, library: &mut Library) {
        self.world.set_overlay(part, items);
        match self.world.overlay_group(part) {
            Some((list, placement)) => {
                library.put_group(part.group(), &list);
                self.world.place_overlay(part, Some(placement));
            }
            None => {
                library.drop_group(part.group());
                self.world.place_overlay(part, None);
            }
        }
    }

    pub fn touch(&mut self, group: &str, library: &Library) {
        self.world.touch(group, library.size_of(group));
    }

    pub fn touch_picture(&mut self, clip: &str, library: &Library) {
        for group in library.groups_drawing(clip) {
            self.touch(&group, library);
        }
    }

    fn region<P: Painter>(&mut self, painter: &mut P, library: &mut Library, raster: &Raster, rect: Rect, limits: Limits) -> Result<(Vec<Skipped>, usize), P::Error> {
        let q = raster.quality.scale();
        let o = self.retained.overscan() as f64;
        let to_region = Matrix::scale(q) * Matrix::translate((o - rect.x0, o - rect.y0)) * Matrix::new(raster.camera.matrix());
        let (w, h) = ((rect.width() * q).ceil() as u32, (rect.height() * q).ceil() as u32);
        let plan = library.plan(&self.world.screen(to_region.as_coeffs(), w, h), limits);
        let rastered = plan.rasters.len();
        self.pending |= plan.pending || !plan.finished.is_empty();
        for group in plan.finished.iter().chain(&plan.waiting) {
            self.world.touch(group, library.size_of(group));
        }
        Ok((painter.paint(plan, rect, raster.quality)?, rastered))
    }

    pub fn gpu_took(&mut self, ms: f64) {
        self.retained.gpu_took(ms);
    }

    pub fn frame<P: Painter>(&mut self, painter: &mut P, library: &mut Library, camera: Camera, now_ms: f64, clock: &mut dyn FnMut() -> f64) -> Result<Frame, P::Error> {
        self.pending = false;
        let damage: Damage = self.world.take_damage();
        let step = self.retained.step(camera, damage, now_ms);
        let mut skipped = Vec::new();
        let mut rastered_all = 0;
        let sharp_full = matches!(&step, Step::Raster(r) if r.outcome == Outcome::Full && r.quality == Quality::Sharp);
        let outcome = match &step {
            Step::Idle => None,
            Step::Present => Some(Outcome::Reused),
            Step::Raster(raster) => {
                let started = clock();
                if let Some(by) = raster.shift {
                    painter.shift(by)?;
                }
                let q = raster.quality.scale();
                let (tw, th) = painter.tile();
                let parts: Vec<Rect> = raster.rects.iter().flat_map(|r| tiles(*r, (tw as f64 / q) as u32, (th as f64 / q) as u32)).collect();
                let mut limits = painter.limits();
                for part in parts {
                    let (missed, rastered) = self.region(painter, library, raster, part, limits)?;
                    skipped.extend(missed);
                    limits.rasters = limits.rasters.saturating_sub(rastered);
                    rastered_all += rastered;
                }
                if raster.outcome == Outcome::Full && raster.quality == Quality::Sharp {
                    self.retained.took(clock() - started);
                }
                Some(raster.outcome)
            }
        };
        if outcome.is_some() {
            painter.present(self.retained.lookup(camera))?;
        }
        Ok(Frame { outcome, pending: self.pending || self.retained.pending(), skipped, rastered: rastered_all, sharp_full })
    }

    pub fn frame_tiles<P: TilePainter>(&mut self, painter: &mut P, library: &mut Library, camera: Camera, now_ms: f64, clock: &mut dyn FnMut() -> f64) -> Result<Frame, P::Error> {
        let Some(tiles) = self.tiles.as_mut() else {
            return self.frame(painter, library, camera, now_ms, clock);
        };
        let mut pending = false;
        let damage = self.world.take_damage();
        let dropped = tiles.pyramid.invalidate(&damage);
        painter.drop_tiles(&dropped);
        let c = Camera { x: camera.x.round(), y: camera.y.round(), zoom: camera.zoom };
        let target = tiles.target(c, now_ms);
        let plan = tiles.pyramid.plan(c, self.viewport, target);
        let mut covers = plan.covers;
        let mut skipped = Vec::new();
        let mut limits = painter.limits();
        let mut drawn = 0;
        let mut rastered_all = 0;
        let started = clock();
        for render in &plan.render {
            let over = drawn >= TILES_PER_FRAME || (drawn > 0 && clock() - started > TILE_BUDGET_MS);
            if over && !render.forced {
                continue;
            }
            let list = self.world.screen(render.key.camera().matrix(), side(), side());
            let tile_plan = library.plan_part(&list, limits, Unseen::Keep);
            rastered_all += tile_plan.rasters.len();
            limits.rasters = limits.rasters.saturating_sub(tile_plan.rasters.len());
            pending |= tile_plan.pending || !tile_plan.finished.is_empty();
            for group in tile_plan.finished.iter().chain(&tile_plan.waiting) {
                self.world.touch(group, library.size_of(group));
            }
            skipped.extend(painter.paint_tile(render.key, tile_plan)?);
            tiles.pyramid.kept(render.key);
            covers.extend(cover(render.key, c, self.viewport));
            drawn += 1;
        }
        painter.drop_tiles(&tiles.pyramid.evict());
        let moved = tiles.shown != Some(c);
        let outcome = match (drawn > 0, moved || !dropped.is_empty()) {
            (true, _) => Some(Outcome::Full),
            (false, true) => Some(Outcome::Reused),
            (false, false) => None,
        };
        if outcome.is_some() {
            painter.present_tiles(&covers)?;
            tiles.shown = Some(c);
        }
        let unsettled = drawn < plan.render.len() || target == Target::Gesture;
        Ok(Frame { outcome, pending: pending || unsettled, skipped, rastered: rastered_all, sharp_full: false })
    }
}
