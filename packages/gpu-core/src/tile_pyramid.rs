use std::collections::HashMap;

use vello::kurbo::{Point, Rect};

use crate::retained::{Camera, Damage, Lookup};
use crate::texture_budget::bytes_of;

pub const TILE_PX: u32 = 512;
pub const GUTTER_PX: u32 = 2;
const ZOOM_EPSILON: f64 = 1e-9;

pub fn side() -> u32 {
    TILE_PX + 2 * GUTTER_PX
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Key {
    zoom_bits: u64,
    pub tx: i64,
    pub ty: i64,
}

impl Key {
    pub fn new(zoom: f64, tx: i64, ty: i64) -> Self {
        Key { zoom_bits: zoom.to_bits(), tx, ty }
    }

    pub fn zoom(self) -> f64 {
        f64::from_bits(self.zoom_bits)
    }

    fn span(self) -> f64 {
        TILE_PX as f64 / self.zoom()
    }

    pub fn world(self) -> Rect {
        let s = self.span();
        Rect::new(self.tx as f64 * s, self.ty as f64 * s, (self.tx + 1) as f64 * s, (self.ty + 1) as f64 * s)
    }

    fn reach(self) -> Rect {
        self.world().inflate(GUTTER_PX as f64 / self.zoom(), GUTTER_PX as f64 / self.zoom())
    }

    pub fn camera(self) -> Camera {
        let (t, g) = (TILE_PX as f64, GUTTER_PX as f64);
        Camera { zoom: self.zoom(), x: g - self.tx as f64 * t, y: g - self.ty as f64 * t }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Target {
    Gesture,
    Settled,
}

impl Target {
    pub fn zoom(self, zoom: f64) -> f64 {
        match self {
            Target::Settled => zoom,
            Target::Gesture => 2f64.powi((zoom.log2() - ZOOM_EPSILON).ceil() as i32),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Cover {
    pub key: Key,
    pub within: Rect,
    pub look: Lookup,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Render {
    pub key: Key,
    pub forced: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Plan {
    pub covers: Vec<Cover>,
    pub render: Vec<Render>,
    pub sharp: bool,
}

pub struct Pyramid {
    kept: HashMap<Key, u64>,
    clock: u64,
    cap: u64,
}

fn screen_of((w, h): (u32, u32)) -> Rect {
    Rect::new(0.0, 0.0, w as f64, h as f64)
}

fn visible_world(camera: Camera, viewport: (u32, u32)) -> Rect {
    let s = screen_of(viewport);
    let at = |x: f64, y: f64| Point::new((x - camera.x) / camera.zoom, (y - camera.y) / camera.zoom);
    Rect::from_points(at(s.x0, s.y0), at(s.x1, s.y1))
}

pub fn visible(camera: Camera, viewport: (u32, u32), zoom: f64) -> Vec<Key> {
    let world = visible_world(camera, viewport);
    let span = TILE_PX as f64 / zoom;
    let (x0, x1) = ((world.x0 / span).floor() as i64, (world.x1 / span).ceil() as i64);
    let (y0, y1) = ((world.y0 / span).floor() as i64, (world.y1 / span).ceil() as i64);
    let centre = world.center();
    let mut keys: Vec<Key> = (y0..y1).flat_map(|ty| (x0..x1).map(move |tx| Key::new(zoom, tx, ty))).collect();
    keys.sort_by(|a, b| a.world().center().distance(centre).total_cmp(&b.world().center().distance(centre)));
    keys
}

pub fn cover(key: Key, camera: Camera, viewport: (u32, u32)) -> Option<Cover> {
    let ratio = camera.zoom / key.zoom();
    let (t, g) = (TILE_PX as f64, GUTTER_PX as f64);
    let x0 = key.tx as f64 * t * ratio + camera.x;
    let y0 = key.ty as f64 * t * ratio + camera.y;
    let on_screen = Rect::new(x0, y0, x0 + t * ratio, y0 + t * ratio).expand();
    let within = on_screen.intersect(screen_of(viewport));
    if within.area() <= 0.0 {
        return None;
    }
    let scale = 1.0 / ratio;
    let look = Lookup { scale, x: g - key.tx as f64 * t - camera.x * scale, y: g - key.ty as f64 * t - camera.y * scale };
    Some(Cover { key, within, look })
}

fn log_distance(a: f64, b: f64) -> f64 {
    (a.log2() - b.log2()).abs()
}

impl Pyramid {
    pub fn new(cap: u64) -> Self {
        Pyramid { kept: HashMap::new(), clock: 0, cap }
    }

    pub fn len(&self) -> usize {
        self.kept.len()
    }

    pub fn is_empty(&self) -> bool {
        self.kept.is_empty()
    }

    pub fn bytes(&self) -> u64 {
        self.kept.len() as u64 * bytes_of((side(), side()))
    }

    pub fn set_cap(&mut self, cap: u64) {
        self.cap = cap;
    }

    pub fn kept(&mut self, key: Key) {
        self.kept.insert(key, self.clock);
    }

    fn stand_ins(&self, key: Key) -> Vec<Key> {
        let area = key.world();
        let near: Vec<Key> = self.kept.keys().filter(|k| k.zoom() != key.zoom() && k.world().intersect(area).area() > 0.0).copied().collect();
        let Some(best) = near.iter().map(|k| k.zoom()).min_by(|a, b| log_distance(*a, key.zoom()).total_cmp(&log_distance(*b, key.zoom()))) else {
            return Vec::new();
        };
        near.into_iter().filter(|k| k.zoom() == best).collect()
    }

    pub fn plan(&mut self, camera: Camera, viewport: (u32, u32), target: Target) -> Plan {
        self.clock += 1;
        let zoom = target.zoom(camera.zoom);
        let mut under = Vec::new();
        let mut over = Vec::new();
        let mut render = Vec::new();
        for key in visible(camera, viewport, zoom) {
            if self.kept.contains_key(&key) {
                over.push(key);
                continue;
            }
            let stand_ins = self.stand_ins(key);
            render.push(Render { key, forced: stand_ins.is_empty() });
            under.extend(stand_ins);
        }
        under.sort_by(|a, b| log_distance(b.zoom(), zoom).total_cmp(&log_distance(a.zoom(), zoom)).then(a.tx.cmp(&b.tx)).then(a.ty.cmp(&b.ty)));
        under.dedup();
        let sharp = render.is_empty() && target == Target::Settled;
        for key in under.iter().chain(&over) {
            self.kept.insert(*key, self.clock);
        }
        let covers = under.into_iter().chain(over).filter_map(|k| cover(k, camera, viewport)).collect();
        Plan { covers, render, sharp }
    }

    pub fn invalidate(&mut self, damage: &Damage) -> Vec<Key> {
        let gone: Vec<Key> = match damage {
            Damage::All => self.kept.keys().copied().collect(),
            Damage::Rects(rects) => self.kept.keys().filter(|k| rects.iter().any(|r| touches(k.reach(), *r))).copied().collect(),
        };
        for key in &gone {
            self.kept.remove(key);
        }
        gone
    }

    pub fn evict(&mut self) -> Vec<Key> {
        let mut by_age: Vec<(Key, u64)> = self.kept.iter().filter(|(_, used)| **used < self.clock).map(|(k, u)| (*k, *u)).collect();
        by_age.sort_by_key(|(_, used)| *used);
        let mut gone = Vec::new();
        for (key, _) in by_age {
            if self.bytes() <= self.cap {
                break;
            }
            self.kept.remove(&key);
            gone.push(key);
        }
        gone
    }
}

fn touches(a: Rect, b: Rect) -> bool {
    a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1
}
