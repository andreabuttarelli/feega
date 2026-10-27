use vello::kurbo::{Affine as Matrix, Rect};

use crate::display_list::Item;
use crate::groups::{Library, Limits, Plan};
use crate::retained::{tiles, Camera, Damage, Lookup, Outcome, Quality, Raster, Retained, Step};
use crate::world::{Patch, World};
use crate::Skipped;

const ROUGH_SCALE: f64 = 0.5;
const RENDER_TILE_PX: u32 = 1024;

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

pub struct Frame {
    pub outcome: Option<Outcome>,
    pub pending: bool,
    pub skipped: Vec<Skipped>,
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
}

fn scale_of(quality: Quality) -> f64 {
    match quality {
        Quality::Rough => ROUGH_SCALE,
        Quality::Sharp => 1.0,
    }
}

impl Compositor {
    pub fn new(width: u32, height: u32) -> Self {
        Compositor { world: World::new(), retained: Retained::new(width, height), pending: false }
    }

    pub fn size(&self) -> (u32, u32) {
        self.retained.size()
    }

    pub fn patch(&mut self, patch: Patch, library: &Library) {
        self.world.patch(patch, |g| library.size_of(g));
    }

    pub fn set_overlay(&mut self, items: Vec<Item>) {
        self.world.set_overlay(items);
    }

    pub fn touch(&mut self, group: &str, library: &Library) {
        self.world.touch(group, library.size_of(group));
    }

    pub fn touch_picture(&mut self, clip: &str, library: &Library) {
        for group in library.groups_drawing(clip) {
            self.touch(&group, library);
        }
    }

    fn region<P: Painter>(&mut self, painter: &mut P, library: &mut Library, raster: &Raster, rect: Rect) -> Result<Vec<Skipped>, P::Error> {
        let q = scale_of(raster.quality);
        let o = self.retained.overscan() as f64;
        let to_region = Matrix::scale(q) * Matrix::translate((o - rect.x0, o - rect.y0)) * Matrix::new(raster.camera.matrix());
        let (w, h) = ((rect.width() * q).ceil() as u32, (rect.height() * q).ceil() as u32);
        let plan = library.plan(&self.world.screen(to_region.as_coeffs(), w, h), painter.limits());
        self.pending |= plan.pending || !plan.finished.is_empty();
        for group in plan.finished.iter().chain(&plan.waiting) {
            self.world.touch(group, library.size_of(group));
        }
        painter.paint(plan, rect, raster.quality)
    }

    pub fn frame<P: Painter>(&mut self, painter: &mut P, library: &mut Library, camera: Camera, now_ms: f64, clock: &mut dyn FnMut() -> f64) -> Result<Frame, P::Error> {
        self.pending = false;
        let damage: Damage = self.world.take_damage();
        let step = self.retained.step(camera, damage, now_ms);
        let mut skipped = Vec::new();
        let outcome = match &step {
            Step::Idle => None,
            Step::Present => Some(Outcome::Reused),
            Step::Raster(raster) => {
                let started = clock();
                if let Some(by) = raster.shift {
                    painter.shift(by)?;
                }
                let q = scale_of(raster.quality);
                let (tw, th) = painter.tile();
                let parts: Vec<Rect> = raster.rects.iter().flat_map(|r| tiles(*r, (tw as f64 / q) as u32, (th as f64 / q) as u32)).collect();
                for part in parts {
                    skipped.extend(self.region(painter, library, raster, part)?);
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
        Ok(Frame { outcome, pending: self.pending || self.retained.pending(), skipped })
    }
}
