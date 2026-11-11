use vello::kurbo::{Affine as Matrix, Rect};

use crate::display_list::Item;
use crate::groups::{Library, Limits, Plan, Sweep};
use crate::retained::{tiles, Camera, Damage, Lookup, Outcome, Quality, Raster, Retained, Step};
use crate::world::{Lift, OverlayPart, Patch, World};
use crate::tally::now_ms;
use crate::Skipped;

const RENDER_TILE_PX: u32 = 1024;
const TILE_DAMAGE_RECTS: usize = 256;

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
    tile_damage: Damage,
    planned: Planned,
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct Planned {
    pub plans: u32,
    pub walked: u32,
    pub ms: f64,
}

impl Compositor {
    pub fn new(width: u32, height: u32) -> Self {
        Compositor { world: World::new(), retained: Retained::new(width, height), pending: false, tile_damage: Damage::none(), planned: Planned::default() }
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
        let started = now_ms();
        let plan = library.plan(&self.world.screen(to_region.as_coeffs(), w, h), limits);
        self.count_plan(started);
        let rastered = plan.rasters.len();
        self.pending |= plan.pending || !plan.finished.is_empty();
        for group in plan.finished.iter().chain(&plan.waiting) {
            self.world.touch(group, library.size_of(group));
        }
        Ok((painter.paint(plan, rect, raster.quality)?, rastered))
    }

    pub fn held_look(&self, camera: Camera) -> Option<(Lookup, f64)> {
        self.retained.held_look(camera)
    }

    pub fn held_painted(&self) -> Rect {
        self.retained.painted()
    }

    pub fn holding(&self) -> bool {
        self.world.holding()
    }

    pub fn extent(&self) -> Option<Rect> {
        self.world.extent()
    }

    pub fn lifts(&self, library: &Library) -> Vec<Lift> {
        self.world.lifts(|g| library.size_of(g))
    }

    pub fn forget(&mut self) {
        self.retained.forget();
    }

    pub fn retained_overscan(&self) -> u32 {
        self.retained.overscan()
    }

    pub fn adopt(&mut self, camera: Camera, now_ms: f64) {
        self.retained.adopt(camera, now_ms);
    }

    pub fn pending_raster(&mut self) -> bool {
        std::mem::take(&mut self.pending)
    }

    pub fn stirred(&mut self) -> bool {
        !matches!(self.world.take_damage(), Damage::Rects(r) if r.is_empty())
    }

    pub fn take_damage(&mut self) -> Damage {
        let mut damage = std::mem::replace(&mut self.tile_damage, Damage::none());
        damage.join(self.world.take_scene_damage());
        if !matches!(self.world.take_damage(), Damage::Rects(r) if r.is_empty()) {
            self.retained.forget();
        }
        damage
    }

    pub fn take_tile_damage(&mut self) -> Damage {
        let mut damage = std::mem::replace(&mut self.tile_damage, Damage::none());
        damage.join(self.world.take_scene_damage());
        damage
    }

    pub fn plan_at(&mut self, library: &mut Library, camera: Camera, (w, h): (u32, u32), limits: Limits) -> Plan {
        let started = now_ms();
        let plan = library.plan_with(&self.world.scene(camera.matrix(), w, h), limits, Sweep::Keep);
        self.count_plan(started);
        self.pending |= plan.pending || !plan.finished.is_empty();
        for group in plan.finished.iter().chain(&plan.waiting) {
            self.world.touch(group, library.size_of(group));
        }
        plan
    }

    pub fn overlay_at(&mut self, library: &mut Library, camera: Camera, (w, h): (u32, u32), limits: Limits) -> Plan {
        let started = now_ms();
        let plan = library.plan(&self.world.overlay(camera.matrix(), w, h), limits);
        self.count_plan(started);
        plan
    }

    fn count_plan(&mut self, started: f64) {
        self.planned.plans += 1;
        self.planned.walked += self.world.take_visited() as u32;
        self.planned.ms += now_ms() - started;
    }

    pub fn take_planned(&mut self) -> Planned {
        std::mem::take(&mut self.planned)
    }

    pub fn gpu_took(&mut self, ms: f64) {
        self.retained.gpu_took(ms);
    }

    pub fn frame<P: Painter>(&mut self, painter: &mut P, library: &mut Library, camera: Camera, now_ms: f64, clock: &mut dyn FnMut() -> f64) -> Result<Frame, P::Error> {
        self.pending = false;
        let damage: Damage = self.world.take_damage();
        self.tile_damage.join(self.world.take_scene_damage());
        if matches!(&self.tile_damage, Damage::Rects(rects) if rects.len() > TILE_DAMAGE_RECTS) {
            self.tile_damage = Damage::All;
        }
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
}
