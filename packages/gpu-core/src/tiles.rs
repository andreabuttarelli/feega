use rustc_hash::FxHashSet;
use vello::kurbo::{Point, Rect};

use crate::retained::Camera;

pub const TILE_PX: u32 = 256;
pub const TILE_GUTTER_PX: u32 = 2;
pub const TILE_BYTES: u64 = ((TILE_PX + 2 * TILE_GUTTER_PX) as u64).pow(2) * 4;
pub const TILE_BUDGET_BYTES: u64 = 384 << 20;
const SCREENS_KEPT: u64 = 12;

pub fn tiles_kept((w, h): (u32, u32), budget: u64) -> usize {
    let per_screen = (w as u64).div_ceil(TILE_PX as u64) * (h as u64).div_ceil(TILE_PX as u64);
    (per_screen * SCREENS_KEPT).min(budget / TILE_BYTES) as usize
}
const STEPS_PER_DOUBLING: f64 = 4.0;
const STEP_SLACK: f64 = 1e-9;
const COARSER_STEPS: i32 = 40;
const FINER_STEPS: i32 = 4;
pub const NEAR_STEPS: i32 = 4;
struct Baked {
    steps: i32,
    reach: f64,
}

impl Baked {
    fn area(&self, world: Rect) -> Rect {
        world.inflate(world.width() * (self.reach - 1.0) / 2.0, world.height() * (self.reach - 1.0) / 2.0)
    }
}

const BAKED: [Baked; 5] = [Baked { steps: 0, reach: 1.5 }, Baked { steps: 4, reach: 1.0 }, Baked { steps: -4, reach: 2.5 }, Baked { steps: -12, reach: 9.0 }, Baked { steps: -16, reach: 17.0 }];
const RESERVE_STEPS_DOWN: i32 = 8;
const RESERVE_REACH: f64 = 3.0;

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

pub const BATCH_TILES: i64 = 2;
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

fn batches_of(missing: &[TileKey], side: i64) -> Vec<Batch> {
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

pub struct Queue {
    pub blank: Vec<TileKey>,
    pub blurry: Vec<TileKey>,
    pub stale: Vec<TileKey>,
}

pub struct TileFrame {
    pub draw: Vec<TileKey>,
    pub missing: Vec<TileKey>,
}

#[derive(Default)]
pub struct Tiles {
    held: FxHashSet<TileKey>,
    stale: FxHashSet<TileKey>,
    last_drawn: rustc_hash::FxHashMap<TileKey, u64>,
    tick: u64,
}

fn seen_world(camera: Camera, (w, h): (u32, u32)) -> Rect {
    Rect::new(-camera.x / camera.zoom, -camera.y / camera.zoom, (w as f64 - camera.x) / camera.zoom, (h as f64 - camera.y) / camera.zoom)
}

fn keys_over(world: Rect, step: i32) -> Vec<TileKey> {
    let side = TILE_PX as f64 / step_zoom(step);
    let (x0, y0) = ((world.x0 / side).floor() as i64, (world.y0 / side).floor() as i64);
    let (x1, y1) = ((world.x1 / side).ceil() as i64, (world.y1 / side).ceil() as i64);
    (y0..y1).flat_map(|ty| (x0..x1).map(move |tx| TileKey { step, tx, ty })).collect()
}

impl Tiles {
    pub fn frame(&self, camera: Camera, screen: (u32, u32)) -> TileFrame {
        let step = step_of(camera.zoom);
        let world = seen_world(camera, screen);
        let centre = Point::new(screen.0 as f64 / 2.0, screen.1 as f64 / 2.0);
        let distance = |k: &TileKey| k.screen(camera).center().distance(centre);
        let mut missing: Vec<TileKey> = keys_over(world, step).into_iter().filter(|k| !self.held.contains(k) || self.stale.contains(k)).collect();
        missing.sort_by(|a, b| distance(a).total_cmp(&distance(b)));
        let fallback: Vec<i32> = if missing.is_empty() { vec![] } else { (step - COARSER_STEPS..step).chain((step + 1..=step + FINER_STEPS).rev()).collect() };
        let whole = |s: i32| keys_over(world, s).iter().all(|k| self.held.contains(k));
        let shown = if missing.is_empty() { Some(step) } else { ((step + 1..=step + FINER_STEPS).chain((step - COARSER_STEPS..step).rev())).find(|s| whole(*s)) };
        let draw = match shown {
            Some(top) => fallback.into_iter().filter(|s| *s < top).chain([top]).flat_map(|s| self.held_over(world, s)).collect(),
            None => fallback.into_iter().chain([step]).flat_map(|s| self.held_over(world, s)).collect(),
        };
        TileFrame { draw, missing }
    }

    fn held_over(&self, world: Rect, step: i32) -> Vec<TileKey> {
        let side = TILE_PX as f64 / step_zoom(step);
        if (world.width() / side) * (world.height() / side) > (self.held.len() as f64) {
            return self.held.iter().filter(|k| k.step == step && k.world().overlaps(world)).copied().collect();
        }
        keys_over(world, step).into_iter().filter(|k| self.held.contains(k)).collect()
    }

    pub fn reserve(&self, camera: Camera, screen: (u32, u32)) -> Vec<TileKey> {
        let world = seen_world(camera, screen);
        let (dx, dy) = (world.width() * (RESERVE_REACH - 1.0) / 2.0, world.height() * (RESERVE_REACH - 1.0) / 2.0);
        let centre = world.center();
        let mut keys: Vec<TileKey> = keys_over(world.inflate(dx, dy), step_of(camera.zoom) - RESERVE_STEPS_DOWN).into_iter().filter(|k| !self.held.contains(k) || self.stale.contains(k)).collect();
        keys.sort_by(|a, b| a.world().center().distance(centre).total_cmp(&b.world().center().distance(centre)));
        keys
    }

    pub fn covered(&self, key: TileKey) -> bool {
        self.covered_within(key, COARSER_STEPS)
    }

    pub fn covered_within(&self, key: TileKey, steps: i32) -> bool {
        let world = key.world();
        let coarser = key.step - steps..key.step;
        let finer = key.step + 1..=key.step + steps.min(FINER_STEPS);
        coarser.chain(finer).any(|step| keys_over(world, step).iter().all(|k| self.held.contains(k)))
    }

    pub fn ahead(&self, camera: Camera, screen: (u32, u32)) -> Vec<TileKey> {
        let world = seen_world(camera, screen);
        let step = step_of(camera.zoom);
        let centre = world.center();
        BAKED.iter().flat_map(|level| {
            let mut keys: Vec<TileKey> = keys_over(level.area(world), step + level.steps).into_iter().filter(|k| !self.held.contains(k) || self.stale.contains(k)).collect();
            keys.sort_by(|a, b| a.world().center().distance(centre).total_cmp(&b.world().center().distance(centre)));
            keys
        }).collect()
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
                _ if !self.covered_within(key, NEAR_STEPS) => &mut queue.blurry,
                _ => continue,
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

    fn pinned(camera: Camera, screen: (u32, u32), key: TileKey) -> bool {
        let step = step_of(camera.zoom);
        let world = seen_world(camera, screen);
        let near = |reach: f64| world.inflate(reach, reach);
        if key.step == step && key.world().overlaps(near(key.side())) {
            return true;
        }
        if key.step == step - RESERVE_STEPS_DOWN {
            return key.world().overlaps(near(world.width().max(world.height()) * (RESERVE_REACH - 1.0) / 2.0));
        }
        BAKED.iter().any(|level| key.step == step + level.steps && key.world().overlaps(level.area(world)))
    }

    pub fn evict_beyond(&mut self, camera: Camera, screen: (u32, u32), keep: usize) -> Vec<TileKey> {
        if self.held.len() <= keep {
            return vec![];
        }
        let step = step_of(camera.zoom);
        let centre = seen_world(camera, screen).center();
        let distance = |k: &TileKey| (k.step - step).abs() as f64 * 1e9 + k.world().center().distance(centre);
        let mut loose: Vec<TileKey> = self.held.iter().copied().filter(|k| !Self::pinned(camera, screen, *k)).collect();
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
}

impl Default for Warmup {
    fn default() -> Self {
        Warmup { stirred_at: f64::NEG_INFINITY }
    }
}

impl Warmup {
    pub fn stirred(&mut self, now_ms: f64) {
        self.stirred_at = now_ms;
    }

    pub fn due(&self, now_ms: f64) -> bool {
        now_ms - self.stirred_at >= WARM_AFTER_MS
    }

    pub fn due_when(&self, now_ms: f64, building: Building) -> bool {
        building == Building::Nothing && self.due(now_ms)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Path {
    Exact,
    Tiles,
}

#[derive(Clone, Copy)]
pub struct Moment {
    pub gesture: bool,
    pub lifting: bool,
    pub settling: bool,
}

pub fn path_for(m: Moment) -> Path {
    if m.gesture || m.lifting || m.settling {
        return Path::Tiles;
    }
    Path::Exact
}
