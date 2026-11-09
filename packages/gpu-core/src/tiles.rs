use rustc_hash::FxHashSet;
use vello::kurbo::{Point, Rect};

use crate::retained::Camera;

pub const TILE_PX: u32 = 256;
const STEPS_PER_DOUBLING: f64 = 4.0;
const STEP_SLACK: f64 = 1e-9;
const COARSER_STEPS: i32 = 40;
const FINER_STEPS: i32 = 4;
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

pub struct TileFrame {
    pub draw: Vec<TileKey>,
    pub missing: Vec<TileKey>,
}

#[derive(Default)]
pub struct Tiles {
    held: FxHashSet<TileKey>,
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
        let mut missing: Vec<TileKey> = keys_over(world, step).into_iter().filter(|k| !self.held.contains(k)).collect();
        missing.sort_by(|a, b| distance(a).total_cmp(&distance(b)));
        let fallback = if missing.is_empty() { vec![] } else { (step - COARSER_STEPS..step).chain((step + 1..=step + FINER_STEPS).rev()).collect() };
        let draw = fallback.into_iter().chain([step]).flat_map(|s| self.held_over(world, s)).collect();
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
        let mut keys: Vec<TileKey> = keys_over(world.inflate(dx, dy), step_of(camera.zoom) - RESERVE_STEPS_DOWN).into_iter().filter(|k| !self.held.contains(k)).collect();
        keys.sort_by(|a, b| a.world().center().distance(centre).total_cmp(&b.world().center().distance(centre)));
        keys
    }

    pub fn covered(&self, key: TileKey) -> bool {
        let world = key.world();
        (key.step - COARSER_STEPS..key.step).any(|step| keys_over(world, step).iter().all(|k| self.held.contains(k)))
    }

    pub fn hold(&mut self, key: TileKey) {
        self.held.insert(key);
    }

    pub fn holds(&self, key: TileKey) -> bool {
        self.held.contains(&key)
    }

    pub fn invalidate(&mut self, world: Rect) -> Vec<TileKey> {
        let gone: Vec<TileKey> = self.held.iter().filter(|k| k.world().overlaps(world)).copied().collect();
        gone.iter().for_each(|k| {
            self.held.remove(k);
        });
        gone
    }

    pub fn clear(&mut self) -> Vec<TileKey> {
        self.held.drain().collect()
    }

    pub fn evict_beyond(&mut self, camera: Camera, screen: (u32, u32), keep: usize) -> Vec<TileKey> {
        if self.held.len() <= keep {
            return vec![];
        }
        let step = step_of(camera.zoom);
        let centre = seen_world(camera, screen).center();
        let mut all: Vec<TileKey> = self.held.iter().copied().collect();
        all.sort_by(|a, b| {
            let cost = |k: &TileKey| (if k.step <= step - RESERVE_STEPS_DOWN { 0 } else { (k.step - step).abs() }) as f64 * 1e9 + k.world().center().distance(centre);
            cost(a).total_cmp(&cost(b))
        });
        let gone = all.split_off(keep);
        gone.iter().for_each(|k| {
            self.held.remove(k);
        });
        gone
    }
}
