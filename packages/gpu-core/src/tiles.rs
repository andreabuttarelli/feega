use rustc_hash::FxHashSet;
use vello::kurbo::{Point, Rect};

use crate::retained::Camera;

pub const TILE_PX: u32 = 256;
pub const TILE_GUTTER_PX: u32 = 2;
pub const TILE_BYTES: u64 = ((TILE_PX + 2 * TILE_GUTTER_PX) as u64).pow(2) * 4;
pub const CANVAS_TILES: usize = 320;

fn canvas_step(extent: Rect, finest: i32, allowed: usize) -> i32 {
    let fits = |step: i32| count_over(extent, step) <= allowed as f64;
    (finest - COARSER_STEPS..=finest).rev().find(|s| fits(*s)).unwrap_or(finest - COARSER_STEPS)
}

pub const TILE_BUDGET_BYTES: u64 = 384 << 20;
const SCREENS_KEPT: u64 = 16;

pub fn tiles_kept((w, h): (u32, u32), budget: u64) -> usize {
    let per_screen = (w as u64).div_ceil(TILE_PX as u64) * (h as u64).div_ceil(TILE_PX as u64);
    (per_screen * SCREENS_KEPT).min(budget / TILE_BYTES) as usize
}

pub fn tiles_kept_beside(screen: (u32, u32), budget: u64, held_elsewhere: u64) -> usize {
    tiles_kept(screen, budget.saturating_sub(held_elsewhere))
}
const STEPS_PER_DOUBLING: f64 = 4.0;
const STEPS_PER_LEVEL: i32 = 2;
const LEVELS_PER_DOUBLING: f64 = 2.0;
const VIEW_MARGIN: f64 = 0.25;
const STEP_SLACK: f64 = 1e-9;
const COARSER_STEPS: i32 = 40;
const FINER_STEPS: i32 = 4;
pub const NEAR_STEPS: i32 = 4;
const AHEAD_FRAMES: f64 = 6.0;
const AHEAD_ZOOM_REACH: f64 = 2.0;
const FRAME_TILES_MAX: f64 = 4096.0;
const HALF_OCTAVE: f64 = std::f64::consts::SQRT_2;
pub struct Level {
    pub below_top: i32,
    pub share_percent: u64,
}

pub const PYRAMID: [Level; 7] = [
    Level { below_top: 16, share_percent: 5 },
    Level { below_top: 12, share_percent: 5 },
    Level { below_top: 8, share_percent: 10 },
    Level { below_top: 6, share_percent: 10 },
    Level { below_top: 4, share_percent: 10 },
    Level { below_top: 2, share_percent: 15 },
    Level { below_top: 0, share_percent: 25 },
];

#[derive(Clone, Copy)]
struct Planned {
    step: i32,
    x0: i64,
    y0: i64,
    x1: i64,
    y1: i64,
}

impl Planned {
    fn over(step: i32, world: Rect) -> Planned {
        let side = TILE_PX as f64 / step_zoom(step);
        Planned { step, x0: (world.x0 / side).floor() as i64, y0: (world.y0 / side).floor() as i64, x1: (world.x1 / side).ceil() as i64, y1: (world.y1 / side).ceil() as i64 }
    }

    fn widened(self, other: Planned) -> Planned {
        Planned { step: self.step, x0: self.x0.min(other.x0), y0: self.y0.min(other.y0), x1: self.x1.max(other.x1), y1: self.y1.max(other.y1) }
    }

    fn holds(&self, key: TileKey) -> bool {
        key.step == self.step && (self.x0..self.x1).contains(&key.tx) && (self.y0..self.y1).contains(&key.ty)
    }

    fn keys(&self) -> impl Iterator<Item = TileKey> + '_ {
        (self.y0..self.y1).flat_map(move |ty| (self.x0..self.x1).map(move |tx| TileKey { step: self.step, tx, ty }))
    }
}

fn around(world: Rect, step: i32, allowed: usize) -> Rect {
    let scale = (allowed as f64 / count_over(world, step).max(1.0)).sqrt();
    let (dx, dy) = (world.width() * (scale - 1.0) / 2.0, world.height() * (scale - 1.0) / 2.0);
    let area = world.inflate(dx, dy);
    if count_over(area, step) <= allowed as f64 {
        return area;
    }
    let side = TILE_PX as f64 / step_zoom(step);
    area.inflate(-side, -side)
}

pub fn step_of(zoom: f64) -> i32 {
    (zoom.log2() * STEPS_PER_DOUBLING - STEP_SLACK).ceil() as i32
}

pub fn step_zoom(step: i32) -> f64 {
    2f64.powf(step as f64 / STEPS_PER_DOUBLING)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TileKey {
    pub step: i32,
    pub tx: i64,
    pub ty: i64,
}

impl TileKey {
    pub fn side(self) -> f64 {
        TILE_PX as f64 / step_zoom(self.step)
    }

    pub fn world(self) -> Rect {
        let side = self.side();
        Rect::new(self.tx as f64 * side, self.ty as f64 * side, (self.tx + 1) as f64 * side, (self.ty + 1) as f64 * side)
    }

    pub fn screen(self, camera: Camera) -> Rect {
        let w = self.world();
        Rect::new(w.x0 * camera.zoom + camera.x, w.y0 * camera.zoom + camera.y, w.x1 * camera.zoom + camera.x, w.y1 * camera.zoom + camera.y)
    }
}

pub const BATCH_TILES: i64 = 4;
pub const BAKE_BATCH_TILES: i64 = 3;

pub struct Batch {
    pub step: i32,
    pub keys: Vec<TileKey>,
}

impl Batch {
    pub fn corner(&self) -> TileKey {
        let tx = self.keys.iter().map(|k| k.tx).min().expect("a batch holds a tile");
        let ty = self.keys.iter().map(|k| k.ty).min().expect("a batch holds a tile");
        TileKey { step: self.step, tx, ty }
    }

    pub fn span(&self) -> (u32, u32) {
        let corner = self.corner();
        let cols = self.keys.iter().map(|k| k.tx - corner.tx + 1).max().unwrap_or(1);
        let rows = self.keys.iter().map(|k| k.ty - corner.ty + 1).max().unwrap_or(1);
        (cols as u32, rows as u32)
    }

    pub fn world(&self) -> Rect {
        let corner = self.corner().world();
        let side = corner.width();
        let (cols, rows) = self.span();
        Rect::new(corner.x0, corner.y0, corner.x0 + cols as f64 * side, corner.y0 + rows as f64 * side)
    }
}

pub fn batches(missing: &[TileKey]) -> Vec<Batch> {
    batches_of(missing, BATCH_TILES)
}

pub fn bake_batches(missing: &[TileKey]) -> Vec<Batch> {
    batches_of(missing, BAKE_BATCH_TILES)
}

pub fn batches_of(missing: &[TileKey], side: i64) -> Vec<Batch> {
    let mut out: Vec<Batch> = Vec::new();
    let mut at: rustc_hash::FxHashMap<(i32, i64, i64), usize> = Default::default();
    for key in missing {
        let block = (key.step, key.tx.div_euclid(side), key.ty.div_euclid(side));
        let index = *at.entry(block).or_insert_with(|| {
            out.push(Batch { step: key.step, keys: Vec::new() });
            out.len() - 1
        });
        out[index].keys.push(*key);
    }
    out
}

#[derive(Default)]
pub struct RasterCredit {
    ms: f64,
    budget_ms: f64,
    tile_ms: Option<f64>,
}

const DEBT_FRAMES: f64 = 3.0;
const TILE_MS_WEIGHT: f64 = 0.25;

impl RasterCredit {
    pub fn earn(&mut self, budget_ms: f64) {
        self.budget_ms = budget_ms;
        self.ms = (self.ms + budget_ms).min(budget_ms);
    }

    pub fn spend(&mut self, ms: f64) {
        self.ms = (self.ms - ms).max(-self.budget_ms * DEBT_FRAMES);
    }

    pub fn allows(&self) -> bool {
        self.ms > 0.0
    }

    pub fn learn(&mut self, ms: f64, tiles: usize) {
        let measured = ms / tiles.max(1) as f64;
        self.tile_ms = Some(self.tile_ms.map_or(measured, |was| was + (measured - was) * TILE_MS_WEIGHT));
    }

    pub fn affords(&self, tiles: usize) -> bool {
        self.allows() && (self.tile_ms.is_none_or(|per| per * tiles as f64 <= self.ms) || (tiles == 1 && self.ms >= self.budget_ms))
    }

    pub fn side(&self) -> i64 {
        let Some(per) = self.tile_ms.filter(|per| *per > 0.0) else { return BATCH_TILES };
        ((self.budget_ms / per).sqrt().floor() as i64).clamp(1, BATCH_TILES)
    }
}

pub struct Queue {
    pub blank: Vec<TileKey>,
    pub blurry: Vec<TileKey>,
    pub stale: Vec<TileKey>,
}

impl Queue {
    pub fn order(self) -> Vec<TileKey> {
        self.blank.into_iter().chain(self.blurry).chain(self.stale).collect()
    }
}

pub struct TileFrame {
    pub draw: Vec<TileKey>,
    pub missing: Vec<TileKey>,
    pub bare: Vec<TileKey>,
    pub beneath: Vec<TileKey>,
}

pub fn sharp_at(zoom: f64, step: i32) -> bool {
    zoom / step_zoom(step) <= SHARP_STRETCH + STEP_SLACK
}

pub const FADE_MS: f64 = 120.0;
const FALLBACK_MIN_STRETCH: f64 = 0.5;

pub fn fallback_serves(at: Camera, now: Camera, screen: (u32, u32), bare: &[TileKey]) -> bool {
    let stretch = now.zoom / at.zoom;
    if !(FALLBACK_MIN_STRETCH..=SHARP_STRETCH + STEP_SLACK).contains(&stretch) {
        return false;
    }
    let (seen, view) = (seen_world(at, screen), seen_world(now, screen));
    bare.iter().map(|k| k.world().intersect(view)).all(|r| r.area() <= 0.0 || seen.union(r) == seen)
}

pub fn fallback_bands(held: Option<Rect>, uncovered: &[Rect]) -> Vec<Rect> {
    let Some(held) = held else {
        return uncovered.iter().copied().reduce(|a, b| a.union(b)).into_iter().collect();
    };
    let side = |r: &Rect| match r.center() {
        c if c.y < held.y0 => 0,
        c if c.y > held.y1 => 1,
        c if c.x < held.x0 => 2,
        _ => 3,
    };
    (0..4).filter_map(|band| uncovered.iter().filter(|r| side(r) == band).copied().reduce(|a, b| a.union(b))).collect()
}

pub fn ahead_camera(was: Camera, now: Camera) -> Option<Camera> {
    if now.zoom <= was.zoom * (1.0 + STEP_SLACK) {
        return None;
    }
    let zoom = now.zoom * SHARP_STRETCH;
    let toward = |at_was: f64, at_now: f64| {
        let world = (at_now - at_was) / (was.zoom - now.zoom);
        at_now + world * now.zoom - world * zoom
    };
    Some(Camera { x: toward(was.x, now.x), y: toward(was.y, now.y), zoom })
}

const COVERED_SHARE: f64 = 0.999;

pub fn fades_over(tile: Rect, under: &[Rect]) -> bool {
    let covered: f64 = under.iter().map(|r| r.intersect(tile).area()).sum();
    tile.area() > 0.0 && covered >= tile.area() * COVERED_SHARE
}

pub fn fade_in(age_ms: f64) -> f32 {
    (age_ms / FADE_MS).clamp(0.0, 1.0) as f32
}

pub fn magnified(draw: &[TileKey], zoom: f64) -> usize {
    draw.iter().filter(|k| !sharp_at(zoom, k.step)).count()
}

#[derive(Default)]
pub struct Tiles {
    canvas: Option<Rect>,
    canvas_tiles: Option<usize>,
    pixel_ratio: Option<f64>,
    plan: Vec<Planned>,
    floor: Option<i32>,
    held: FxHashSet<TileKey>,
    stale: FxHashSet<TileKey>,
    last_drawn: rustc_hash::FxHashMap<TileKey, u64>,
    tick: u64,
}

fn seen_world(camera: Camera, (w, h): (u32, u32)) -> Rect {
    Rect::new(-camera.x / camera.zoom, -camera.y / camera.zoom, (w as f64 - camera.x) / camera.zoom, (h as f64 - camera.y) / camera.zoom)
}

fn count_over(world: Rect, step: i32) -> f64 {
    let side = TILE_PX as f64 / step_zoom(step);
    ((world.x1 / side).ceil() - (world.x0 / side).floor()) * ((world.y1 / side).ceil() - (world.y0 / side).floor())
}

fn keys_over(world: Rect, step: i32) -> impl Iterator<Item = TileKey> {
    let side = TILE_PX as f64 / step_zoom(step);
    let (x0, y0) = ((world.x0 / side).floor() as i64, (world.y0 / side).floor() as i64);
    let (x1, y1) = ((world.x1 / side).ceil() as i64, (world.y1 / side).ceil() as i64);
    (y0..y1).flat_map(move |ty| (x0..x1).map(move |tx| TileKey { step, tx, ty }))
}

pub fn lifted_keys(camera: Camera, screen: (u32, u32), rest: Rect, (dx, dy): (f64, f64), step: i32) -> Vec<TileKey> {
    let seen = seen_world(camera, screen);
    let shown = Rect::new(seen.x0 - dx, seen.y0 - dy, seen.x1 - dx, seen.y1 - dy);
    if !shown.overlaps(rest) {
        return Vec::new();
    }
    keys_over(shown.intersect(rest), step).collect()
}

impl Tiles {
    pub fn set_pixel_ratio(&mut self, ratio: f64) {
        self.pixel_ratio = Some(ratio);
    }

    fn top(&self) -> i32 {
        step_of(self.pixel_ratio.unwrap_or(1.0))
    }

    pub fn step_for(&self, camera: Camera) -> i32 {
        let (step, top) = (step_of(camera.zoom), self.top());
        if step >= top {
            return step;
        }
        let levels = ((self.pixel_ratio.unwrap_or(1.0) / camera.zoom).log2() * LEVELS_PER_DOUBLING + STEP_SLACK).floor() as i32;
        let level = top - levels * STEPS_PER_LEVEL;
        self.floor.map_or(level, |floor| level.max(floor))
    }

    pub fn frame(&self, camera: Camera, screen: (u32, u32)) -> TileFrame {
        let step = self.step_for(camera);
        let world = match self.on_canvas(seen_world(camera, screen)) {
            Some(world) if count_over(world, step) <= FRAME_TILES_MAX => world,
            _ => return TileFrame { draw: Vec::new(), missing: Vec::new(), bare: Vec::new(), beneath: Vec::new() },
        };
        let centre = Point::new(screen.0 as f64 / 2.0, screen.1 as f64 / 2.0);
        let distance = |k: &TileKey| k.screen(camera).center().distance(centre);
        let mut missing: Vec<TileKey> = keys_over(world, step).filter(|k| !self.held.contains(k) || self.stale.contains(k)).filter(|k| self.paints(*k)).collect();
        missing.sort_by(|a, b| distance(a).total_cmp(&distance(b)));
        let coarser: Vec<i32> = (step - COARSER_STEPS..step).filter(|s| sharp_at(camera.zoom, *s)).collect();
        let fallback: Vec<i32> = if missing.is_empty() { vec![] } else { coarser.iter().copied().chain((step + 1..=step + FINER_STEPS).rev()).collect() };
        let whole = |s: i32| keys_over(world, s).filter(|k| self.paints(*k)).all(|k| self.held.contains(&k));
        let shown = if missing.is_empty() { Some(step) } else { ((step + 1..=step + FINER_STEPS).chain(coarser.iter().rev().copied())).find(|s| whole(*s)) };
        let draw: Vec<TileKey> = match shown {
            Some(top) => self.held_over(world, top),
            None => fallback.into_iter().chain([step]).flat_map(|s| self.held_over(world, s)).collect(),
        };
        let sharp: Vec<i32> = coarser.into_iter().chain(step + 1..=step + FINER_STEPS).collect();
        let bare = missing.iter().filter(|k| !self.held.contains(k) && !self.under_any(**k, &sharp)).copied().collect();
        let beneath: Vec<TileKey> = (step - COARSER_STEPS..step).filter(|s| !sharp.contains(s)).flat_map(|s| self.held_over(world, s)).collect();
        let held_stale = (step - COARSER_STEPS..=step + FINER_STEPS).filter(|s| *s != step).flat_map(|s| self.held_over(world, s)).filter(|k| self.stale.contains(k));
        missing.extend(held_stale);
        TileFrame { draw, missing, bare, beneath }
    }

    fn on_canvas(&self, world: Rect) -> Option<Rect> {
        match self.canvas {
            Some(canvas) if !world.overlaps(canvas) => None,
            Some(canvas) => Some(world.intersect(canvas)),
            None => Some(world),
        }
    }

    fn paints(&self, key: TileKey) -> bool {
        self.canvas.is_none_or(|canvas| key.world().intersect(canvas).area() > 0.0)
    }

    fn held_over(&self, world: Rect, step: i32) -> Vec<TileKey> {
        let side = TILE_PX as f64 / step_zoom(step);
        if (world.width() / side) * (world.height() / side) > (self.held.len() as f64) {
            return self.held.iter().filter(|k| k.step == step && k.world().overlaps(world)).copied().collect();
        }
        keys_over(world, step).filter(|k| self.held.contains(k)).collect()
    }

    pub fn ahead(&self, was: Camera, now: Camera, screen: (u32, u32)) -> Vec<TileKey> {
        let (from, to) = (seen_world(was, screen).center(), seen_world(now, screen).center());
        let zoom = (now.zoom * (now.zoom / was.zoom).powf(AHEAD_FRAMES)).clamp(now.zoom / AHEAD_ZOOM_REACH, now.zoom * AHEAD_ZOOM_REACH);
        let centre = to + (to - from) * AHEAD_FRAMES;
        let (w, h) = (screen.0 as f64, screen.1 as f64);
        let predicted = Camera { x: w / 2.0 - centre.x * zoom, y: h / 2.0 - centre.y * zoom, zoom };
        let current: FxHashSet<TileKey> = self.frame(now, screen).missing.into_iter().collect();
        self.frame(predicted, screen).missing.into_iter().filter(|k| !current.contains(k)).collect()
    }

    pub fn covered(&self, key: TileKey) -> bool {
        self.covered_within(key, COARSER_STEPS)
    }

    pub fn covered_within(&self, key: TileKey, steps: i32) -> bool {
        let world = key.world();
        let coarser = key.step - steps..key.step;
        let finer = key.step + 1..=key.step + steps.min(FINER_STEPS);
        coarser.chain(finer).any(|step| keys_over(world, step).all(|k| self.held.contains(&k)))
    }

    fn under_any(&self, key: TileKey, steps: &[i32]) -> bool {
        steps.iter().any(|step| keys_over(key.world(), *step).all(|k| self.held.contains(&k)))
    }

    fn shown_sharper(&self, key: TileKey) -> bool {
        (key.step + 1..=key.step + FINER_STEPS).any(|step| keys_over(key.world(), step).all(|k| self.held.contains(&k)))
    }

    fn planned(&self, camera: Camera, screen: (u32, u32), kept: usize) -> Vec<Planned> {
        let world = seen_world(camera, screen);
        let whole = self.canvas.filter(|_| self.canvas_allowed() > 0);
        let shown = self.step_for(camera);
        let margin = world.inflate(world.width() * VIEW_MARGIN, world.height() * VIEW_MARGIN);
        let mut plan = self.levels(world, margin, shown, kept, whole);
        let near = |zoom: f64| self.step_for(Camera { zoom, ..camera });
        let adjacent = [(near(camera.zoom / HALF_OCTAVE), margin), (near(camera.zoom * HALF_OCTAVE), world)];
        let coarsest = plan.iter().map(|level| level.step).min().unwrap_or(shown);
        for (step, area) in adjacent.into_iter().filter(|(step, _)| *step >= coarsest) {
            let wanted = Planned::over(step, whole.map_or(area, |canvas| area.intersect(canvas)));
            match plan.iter_mut().find(|level| level.step == step) {
                Some(level) => *level = level.widened(wanted),
                None => plan.push(wanted),
            }
        }
        plan.sort_by_key(|level| level.step);
        plan
    }

    fn levels(&self, world: Rect, margin: Rect, shown: i32, kept: usize, whole: Option<Rect>) -> Vec<Planned> {
        PYRAMID.iter().enumerate().map(|(i, level)| {
            let step = self.top() - level.below_top;
            let share = (kept as u64 * level.share_percent / 100) as usize;
            let allowed = if step == shown { share.max(count_over(margin, step) as usize) } else { share };
            let coarsest = i == 0;
            match whole {
                Some(canvas) if coarsest => Planned::over(canvas_step(canvas, step, allowed.max(self.canvas_allowed())), canvas),
                Some(canvas) if count_over(canvas, step) <= allowed as f64 => Planned::over(step, canvas),
                Some(canvas) => Planned::over(step, Self::area(world, margin, step, shown, allowed).intersect(canvas)),
                None => Planned::over(step, Self::area(world, margin, step, shown, allowed)),
            }
        }).collect()
    }

    fn area(world: Rect, margin: Rect, step: i32, shown: i32, allowed: usize) -> Rect {
        let near = around(world, step, allowed);
        if step == shown {
            return near.union(margin);
        }
        near
    }

    pub fn pyramid(&mut self, camera: Camera, screen: (u32, u32), kept: usize) -> Vec<TileKey> {
        self.plan = self.planned(camera, screen, kept);
        self.floor = self.canvas.filter(|_| self.canvas_allowed() > 0).and(self.plan.first().map(|level| level.step));
        let centre = seen_world(camera, screen).center();
        self.plan.iter().flat_map(|level| {
            let mut keys: Vec<TileKey> = level.keys().filter(|k| !self.held.contains(k) || self.stale.contains(k)).collect();
            keys.sort_by(|a, b| a.world().center().distance(centre).total_cmp(&b.world().center().distance(centre)));
            keys
        }).collect()
    }

    pub fn set_canvas(&mut self, extent: Rect) {
        self.canvas = Some(extent);
    }

    pub fn set_canvas_tiles(&mut self, allowed: usize) {
        self.canvas_tiles = Some(allowed);
    }

    fn overview(&self) -> Option<i32> {
        let canvas = self.canvas.filter(|_| self.canvas_allowed() > 0)?;
        Some(canvas_step(canvas, self.top() - PYRAMID[0].below_top, self.canvas_allowed()))
    }

    fn canvas_allowed(&self) -> usize {
        self.canvas_tiles.unwrap_or(CANVAS_TILES)
    }

    pub fn hold(&mut self, key: TileKey) {
        self.held.insert(key);
        self.stale.remove(&key);
    }

    pub fn hold_lacking(&mut self, key: TileKey) -> bool {
        if self.covered(key) {
            return false;
        }
        self.held.insert(key);
        self.stale.insert(key);
        true
    }

    pub fn holds(&self, key: TileKey) -> bool {
        self.held.contains(&key)
    }

    pub fn invalidate(&mut self, world: Rect) {
        let changed: Vec<TileKey> = self.held.iter().filter(|k| k.world().overlaps(world)).copied().collect();
        self.stale.extend(changed);
    }

    pub fn clear(&mut self) {
        self.stale.extend(self.held.iter().copied());
    }

    pub fn queue(&self, missing: Vec<TileKey>) -> Queue {
        let mut queue = Queue { blank: vec![], blurry: vec![], stale: vec![] };
        for key in missing {
            let list = match () {
                _ if self.stale.contains(&key) => &mut queue.stale,
                _ if !self.covered(key) => &mut queue.blank,
                _ if self.shown_sharper(key) => continue,
                _ => &mut queue.blurry,
            };
            list.push(key);
        }
        queue
    }

    pub fn len(&self) -> usize {
        self.held.len()
    }

    pub fn drawn(&mut self, keys: &[TileKey]) {
        self.tick += 1;
        for key in keys {
            self.last_drawn.insert(*key, self.tick);
        }
    }

    fn pinned(&self, step: i32, near: Rect, key: TileKey) -> bool {
        if self.plan.iter().any(|level| level.holds(key)) || self.overview().is_some_and(|overview| key.step <= overview) {
            return true;
        }
        key.step == step && key.world().overlaps(near.inflate(key.side(), key.side()))
    }

    pub fn evict_beyond(&mut self, camera: Camera, screen: (u32, u32), keep: usize) -> Vec<TileKey> {
        if self.held.len() <= keep {
            return vec![];
        }
        let step = self.step_for(camera);
        let world = seen_world(camera, screen);
        let centre = world.center();
        let distance = |k: &TileKey| (k.step - step).abs() as f64 * 1e9 + k.world().center().distance(centre);
        let mut loose: Vec<TileKey> = self.held.iter().copied().filter(|k| !self.pinned(step, world, *k)).collect();
        loose.sort_by(|a, b| {
            let used = |k: &TileKey| self.last_drawn.get(k).copied().unwrap_or(0);
            used(a).cmp(&used(b)).then(distance(b).total_cmp(&distance(a)))
        });
        let excess = (self.held.len() - keep).min(loose.len());
        let gone: Vec<TileKey> = loose.into_iter().take(excess).collect();
        gone.iter().for_each(|k| {
            self.held.remove(k);
            self.stale.remove(k);
            self.last_drawn.remove(k);
        });
        gone
    }
}

pub const REST_BLOCK_PX: u32 = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Drawn {
    Whole,
    Lacking,
}

pub struct Rest {
    camera: Camera,
    screen: (u32, u32),
    todo: Vec<Rect>,
    lacking: bool,
}

impl Rest {
    pub fn new(camera: Camera, screen: (u32, u32)) -> Rest {
        let side = REST_BLOCK_PX as f64;
        let (w, h) = (screen.0 as f64, screen.1 as f64);
        let centre = Point::new(w / 2.0, h / 2.0);
        let cols = (w / side).ceil() as u32;
        let rows = (h / side).ceil() as u32;
        let mut todo: Vec<Rect> = (0..rows).flat_map(|r| (0..cols).map(move |c| Rect::new(c as f64 * side, r as f64 * side, ((c + 1) as f64 * side).min(w), ((r + 1) as f64 * side).min(h)))).collect();
        todo.sort_by(|a, b| a.center().distance(centre).total_cmp(&b.center().distance(centre)));
        Rest { camera, screen, todo, lacking: false }
    }

    pub fn shows(&self, camera: Camera, screen: (u32, u32)) -> bool {
        self.camera == camera && self.screen == screen
    }

    pub fn todo(&self) -> &[Rect] {
        &self.todo
    }

    pub fn next(&mut self) -> Option<Rect> {
        (!self.todo.is_empty()).then(|| self.todo.remove(0))
    }

    pub fn drew(&mut self, drawn: Drawn) {
        self.lacking |= drawn == Drawn::Lacking;
    }

    pub fn adoptable(&self) -> bool {
        self.todo.is_empty() && !self.lacking
    }
}

pub const WARM_AFTER_MS: f64 = 500.0;
const WARM_AFTER_UPLOAD_MS: f64 = 1500.0;
const SHARP_STRETCH: f64 = 1.25;

pub fn underlay_shows(stretch: f64) -> bool {
    stretch <= SHARP_STRETCH
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Building {
    Frames,
    Nothing,
}

pub struct Warmup {
    stirred_at: f64,
    moved_at: f64,
}

impl Default for Warmup {
    fn default() -> Self {
        Warmup { stirred_at: f64::NEG_INFINITY, moved_at: f64::NEG_INFINITY }
    }
}

impl Warmup {
    pub fn stirred(&mut self, now_ms: f64) {
        self.stirred_at = self.stirred_at.max(now_ms);
    }

    pub fn moved(&mut self, now_ms: f64) {
        self.stirred(now_ms);
        self.moved_at = self.moved_at.max(now_ms);
    }

    pub fn coarse_due(&self, now_ms: f64) -> bool {
        now_ms - self.moved_at >= WARM_AFTER_MS
    }

    pub fn uploaded(&mut self, now_ms: f64) {
        self.stirred(now_ms + WARM_AFTER_UPLOAD_MS - WARM_AFTER_MS);
    }

    pub fn due(&self, now_ms: f64) -> bool {
        now_ms - self.stirred_at >= WARM_AFTER_MS
    }

    pub fn wait_ms(&self, now_ms: f64) -> f64 {
        (WARM_AFTER_MS - (now_ms - self.stirred_at)).max(0.0)
    }

    pub fn due_when(&self, now_ms: f64, building: Building) -> bool {
        building == Building::Nothing && self.due(now_ms)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Path {
    Exact,
    Tiles,
    Direct,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum GestureDraw {
    #[default]
    Tiles,
    Direct,
}

#[derive(Clone, Copy)]
pub struct Moment {
    pub gesture: bool,
    pub lifting: bool,
    pub settling: bool,
    pub draw: GestureDraw,
}

pub fn path_for(m: Moment) -> Path {
    if m.draw == GestureDraw::Direct && !m.lifting && (m.gesture || m.settling) {
        return Path::Direct;
    }
    if m.gesture || m.lifting || m.settling {
        return Path::Tiles;
    }
    Path::Exact
}

pub const MAX_SPLITS: u32 = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Piece {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

impl Piece {
    pub fn overlap(self, other: Piece) -> Option<Piece> {
        let (x0, y0) = (self.x.max(other.x), self.y.max(other.y));
        let (x1, y1) = ((self.x + self.w).min(other.x + other.w), (self.y + self.h).min(other.y + other.h));
        (x1 > x0 && y1 > y0).then(|| Piece { x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
    }

    fn halves(self) -> Option<[Piece; 2]> {
        if self.w >= self.h && self.w > 1 {
            let left = self.w / 2;
            return Some([Piece { w: left, ..self }, Piece { x: self.x + left, w: self.w - left, ..self }]);
        }
        if self.h > 1 {
            let top = self.h / 2;
            return Some([Piece { h: top, ..self }, Piece { y: self.y + top, h: self.h - top, ..self }]);
        }
        None
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rendered {
    pub fullness: f64,
}

impl Rendered {
    fn overflowed(self) -> bool {
        self.fullness > 1.0
    }
}

const SHARED_BY_HALVES: f64 = 1.75;

pub fn split_render(size: (u32, u32), mut render: impl FnMut(Piece) -> Rendered) -> Vec<Piece> {
    let whole = Piece { x: 0, y: 0, w: size.0, h: size.1 };
    let mut done = Vec::new();
    let mut todo = vec![(whole, render(whole), 0)];
    while let Some((piece, rendered, depth)) = todo.pop() {
        let Some([a, b]) = piece.halves().filter(|_| rendered.overflowed() && depth < MAX_SPLITS) else {
            done.push(piece);
            continue;
        };
        let (ra, rb) = (render(a), render(b));
        if ra.fullness + rb.fullness >= SHARED_BY_HALVES * rendered.fullness {
            done.extend([a, b]);
            continue;
        }
        todo.extend([(b, rb, depth + 1), (a, ra, depth + 1)]);
    }
    done
}
