use vello::kurbo::Rect;

use crate::display_list::Affine;

const OVERSCAN_SHARE: u32 = 8;
const OVERSCAN_MAX: u32 = 128;
const ZOOM_IDLE_MS: f64 = 100.0;
const SLOW_FULL_MS: f64 = 12.0;
const LIVE_FULL_MS: f64 = 10.0;
const FULL_SHARE: f64 = 0.6;
const MAX_RECTS: usize = 8;
const TOO_MANY_RECTS: usize = 32;
const AA_PX: f64 = 1.0;
const EPSILON: f64 = 1e-6;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Camera {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

impl Camera {
    fn snapped(self) -> Self {
        Camera { x: self.x.round(), y: self.y.round(), ..self }
    }

    pub fn matrix(&self) -> Affine {
        [self.zoom, 0.0, 0.0, self.zoom, self.x, self.y]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Outcome {
    Reused,
    Partial,
    Full,
}

impl Outcome {
    pub fn name(self) -> &'static str {
        match self {
            Outcome::Reused => "reused",
            Outcome::Partial => "partial",
            Outcome::Full => "full",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Quality {
    Rough,
    Sharp,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Damage {
    Rects(Vec<Rect>),
    All,
}

impl Damage {
    pub fn none() -> Self {
        Damage::Rects(Vec::new())
    }

    pub fn add(&mut self, rect: Rect) {
        if let Damage::Rects(rects) = self {
            rects.push(rect);
        }
    }

    pub fn join(&mut self, other: Damage) {
        match other {
            Damage::All => *self = Damage::All,
            Damage::Rects(more) => more.into_iter().for_each(|r| self.add(r)),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Raster {
    pub camera: Camera,
    pub quality: Quality,
    pub shift: Option<(i32, i32)>,
    pub rects: Vec<Rect>,
    pub outcome: Outcome,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Step {
    Idle,
    Present,
    Raster(Raster),
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Lookup {
    pub scale: f64,
    pub x: f64,
    pub y: f64,
}

impl Lookup {
    pub fn bottom_up(self, source_height: f64, target_height: f64) -> Lookup {
        Lookup { y: source_height - target_height * self.scale - self.y, ..self }
    }
}

#[derive(Debug, Clone, Copy)]
struct Held {
    camera: Camera,
    quality: Quality,
}

pub struct Retained {
    width: u32,
    height: u32,
    overscan: u32,
    held: Option<Held>,
    shown: Option<Camera>,
    zoom_seen: f64,
    zoom_moved_at: f64,
    full_ms: f64,
}

pub fn subtract(from: Rect, cut: Rect) -> Vec<Rect> {
    let cut = from.intersect(cut);
    if cut.area() <= 0.0 {
        return vec![from];
    }
    let strips = [
        Rect::new(from.x0, from.y0, from.x1, cut.y0),
        Rect::new(from.x0, cut.y1, from.x1, from.y1),
        Rect::new(from.x0, cut.y0, cut.x0, cut.y1),
        Rect::new(cut.x1, cut.y0, from.x1, cut.y1),
    ];
    strips.into_iter().filter(|r| r.area() > 0.0).collect()
}

fn overlapping(rects: &[Rect]) -> Option<(usize, usize)> {
    (0..rects.len()).flat_map(|i| (i + 1..rects.len()).map(move |j| (i, j))).find(|&(i, j)| rects[i].intersect(rects[j]).area() > 0.0)
}

fn cheapest(rects: &[Rect]) -> (usize, usize) {
    let waste = |i: usize, j: usize| rects[i].union(rects[j]).area() - rects[i].area() - rects[j].area();
    (0..rects.len()).flat_map(|i| (i + 1..rects.len()).map(move |j| (i, j))).min_by(|a, b| waste(a.0, a.1).total_cmp(&waste(b.0, b.1))).expect("two rects at least")
}

pub fn merged(mut rects: Vec<Rect>, max: usize) -> Vec<Rect> {
    rects.retain(|r| r.area() > 0.0);
    if rects.len() > TOO_MANY_RECTS {
        return rects.into_iter().reduce(|a, b| a.union(b)).into_iter().collect();
    }
    while rects.len() > 1 {
        let pair = match overlapping(&rects) {
            Some(pair) => pair,
            None if rects.len() > max => cheapest(&rects),
            None => break,
        };
        let joined = rects[pair.0].union(rects[pair.1]);
        rects.remove(pair.1);
        rects[pair.0] = joined;
    }
    rects
}

pub fn tiles(rect: Rect, width: u32, height: u32) -> Vec<Rect> {
    let (w, h) = (width as f64, height as f64);
    let mut out = Vec::new();
    let mut y = rect.y0;
    while y < rect.y1 {
        let mut x = rect.x0;
        while x < rect.x1 {
            out.push(Rect::new(x, y, (x + w).min(rect.x1), (y + h).min(rect.y1)));
            x += w;
        }
        y += h;
    }
    out
}

impl Retained {
    pub fn new(width: u32, height: u32) -> Self {
        let overscan = (width.min(height) / OVERSCAN_SHARE).min(OVERSCAN_MAX);
        Retained { width, height, overscan, held: None, shown: None, zoom_seen: 0.0, zoom_moved_at: f64::NEG_INFINITY, full_ms: 0.0 }
    }

    pub fn overscan(&self) -> u32 {
        self.overscan
    }

    pub fn size(&self) -> (u32, u32) {
        (self.width + 2 * self.overscan, self.height + 2 * self.overscan)
    }

    fn whole(&self) -> Rect {
        let (w, h) = self.size();
        Rect::new(0.0, 0.0, w as f64, h as f64)
    }

    pub fn took(&mut self, ms: f64) {
        self.full_ms = ms;
    }

    pub fn pending(&self) -> bool {
        self.held.is_some_and(|h| h.quality == Quality::Rough || h.camera.zoom != self.zoom_seen)
    }

    pub fn forget(&mut self) {
        self.held = None;
        self.shown = None;
    }

    pub fn lookup(&self, camera: Camera) -> Lookup {
        let c = camera.snapped();
        let h = self.held.map_or(c, |h| h.camera);
        let scale = h.zoom / c.zoom;
        let o = self.overscan as f64;
        Lookup { scale, x: h.x + o - c.x * scale, y: h.y + o - c.y * scale }
    }

    fn covers(&self, camera: Camera) -> bool {
        let look = self.lookup(camera);
        let (w, h) = self.size();
        let right = self.width as f64 * look.scale + look.x;
        let bottom = self.height as f64 * look.scale + look.y;
        look.x >= -EPSILON && look.y >= -EPSILON && right <= w as f64 + EPSILON && bottom <= h as f64 + EPSILON
    }

    fn pixels(&self, camera: Camera, world: Rect) -> Rect {
        let o = self.overscan as f64;
        let at = |x: f64, y: f64| (x * camera.zoom + camera.x + o, y * camera.zoom + camera.y + o);
        let (x0, y0) = at(world.x0, world.y0);
        let (x1, y1) = at(world.x1, world.y1);
        Rect::new(x0 - AA_PX, y0 - AA_PX, x1 + AA_PX, y1 + AA_PX).expand().intersect(self.whole())
    }

    fn raster(&mut self, camera: Camera, quality: Quality, shift: Option<(i32, i32)>, rects: Vec<Rect>) -> Step {
        let rects = merged(rects, MAX_RECTS);
        let whole = self.whole();
        let full = rects.iter().map(|r| r.area()).sum::<f64>() > self.width as f64 * self.height as f64 * FULL_SHARE || quality == Quality::Rough;
        self.held = Some(Held { camera, quality });
        self.shown = Some(camera);
        let step = if full {
            Raster { camera, quality, shift: None, rects: vec![whole], outcome: Outcome::Full }
        } else {
            Raster { camera, quality, shift, rects, outcome: Outcome::Partial }
        };
        Step::Raster(step)
    }

    fn full(&mut self, camera: Camera, quality: Quality) -> Step {
        let whole = self.whole();
        self.raster(camera, quality, None, vec![whole])
    }

    fn refined(&self) -> Quality {
        if self.full_ms > SLOW_FULL_MS {
            Quality::Rough
        } else {
            Quality::Sharp
        }
    }

    fn present(&mut self, camera: Camera) -> Step {
        if self.shown == Some(camera) {
            return Step::Idle;
        }
        self.shown = Some(camera);
        Step::Present
    }

    pub fn step(&mut self, camera: Camera, damage: Damage, now_ms: f64) -> Step {
        let c = camera.snapped();
        if c.zoom != self.zoom_seen {
            self.zoom_seen = c.zoom;
            self.zoom_moved_at = now_ms;
        }
        let gesture = now_ms - self.zoom_moved_at < ZOOM_IDLE_MS;
        let Some(held) = self.held else {
            return self.full(c, Quality::Sharp);
        };
        let Damage::Rects(damaged) = damage else {
            return self.full(c, Quality::Sharp);
        };
        if held.camera.zoom != c.zoom {
            if gesture && self.full_ms <= LIVE_FULL_MS {
                return self.full(c, Quality::Sharp);
            }
            if gesture && self.covers(c) {
                return self.present(c);
            }
            let quality = if gesture { Quality::Rough } else { self.refined() };
            return self.full(c, quality);
        }
        if held.quality == Quality::Rough {
            if gesture && self.full_ms > LIVE_FULL_MS {
                return self.present(c);
            }
            return self.full(c, Quality::Sharp);
        }
        let (dx, dy) = ((c.x - held.camera.x) as i32, (c.y - held.camera.y) as i32);
        if self.covers(c) {
            let rects: Vec<Rect> = damaged.iter().map(|r| self.pixels(held.camera, *r)).filter(|r| r.area() > 0.0).collect();
            if rects.is_empty() {
                return self.present(c);
            }
            return self.raster(held.camera, Quality::Sharp, None, rects);
        }
        let o = self.overscan as i32;
        let lead = |d: i32| if d.abs() > o { d + d.signum() * o } else { 0 };
        let (lx, ly) = (lead(dx), lead(dy));
        let ahead = Camera { x: held.camera.x + lx as f64, y: held.camera.y + ly as f64, ..c };
        let whole = self.whole();
        let kept = whole + vello::kurbo::Vec2::new(lx as f64, ly as f64);
        if whole.intersect(kept).area() <= 0.0 {
            return self.full(c, Quality::Sharp);
        }
        let strips = subtract(whole, kept);
        let edits = damaged.iter().map(|r| self.pixels(ahead, *r)).filter(|r| r.area() > 0.0);
        self.raster(ahead, Quality::Sharp, Some((lx, ly)), strips.into_iter().chain(edits).collect())
    }
}
