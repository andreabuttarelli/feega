use std::hash::{Hash, Hasher};

use rustc_hash::FxHasher;
use vello::kurbo::{Point, Rect};

use crate::display_list::{Affine, Cover, Item, Look, Paint};
use crate::groups::placed;
use crate::held_view::ZOOM_IN_ROOM;

const UNBOUNDED: Rect = Rect::new(-1.0e7, -1.0e7, 1.0e7, 1.0e7);
const SIMILAR: f64 = 1e-6;
const KEY_STEPS: f64 = 1000.0;
const SAMPLED_EVERY: usize = 16;

fn sampled(contours: &[Vec<f64>], h: &mut FxHasher) {
    for c in contours {
        c.len().hash(h);
        c.iter().step_by(SAMPLED_EVERY).chain(c.last()).for_each(|v| v.to_bits().hash(h));
    }
}

pub struct Zoomless {
    pub key: String,
    pub scale: f64,
    pub shift: Point,
    held: f64,
    screen: f64,
}

impl Zoomless {
    pub fn item(&self, item: &Item) -> Item {
        let k = self.held / self.screen;
        let [tx, ty] = [self.shift.x, self.shift.y];
        placed(&unscissored(item), [k, 0.0, 0.0, k, -tx * k, -ty * k], UNBOUNDED, k)
    }
}

fn similarity(m: Affine) -> Option<f64> {
    let [a, b, c, d, _, _] = m;
    let s = a.hypot(b);
    let similar = (a - d).abs() <= SIMILAR * s && (b + c).abs() <= SIMILAR * s;
    (similar && s > 0.0).then_some(s)
}

fn reads_behind(item: &Item) -> bool {
    match item {
        Item::Lens(_) => true,
        Item::Group(g) => g.look.backdrop.is_some() || g.items.iter().any(reads_behind),
        _ => item.look().is_some_and(|l| l.backdrop.is_some()),
    }
}

fn unscissored_look(look: &Look) -> Look {
    Look { scissor: None, ..look.clone() }
}

fn unscissored(item: &Item) -> Item {
    match item {
        Item::Path(p) => Item::Path(crate::display_list::PathItem { look: unscissored_look(&p.look), ..p.clone() }),
        Item::Image(i) => Item::Image(crate::display_list::ImageItem { look: unscissored_look(&i.look), ..i.clone() }),
        Item::Layer(l) => Item::Layer(crate::display_list::LayerItem { look: unscissored_look(&l.look), ..l.clone() }),
        Item::Group(g) => Item::Group(Box::new(crate::display_list::GroupItem { clip: g.clip.clone(), items: g.items.iter().map(unscissored).collect(), look: unscissored_look(&g.look) })),
        other => other.clone(),
    }
}

struct Unit {
    s: f64,
    t: [f64; 2],
}

impl Unit {
    fn length(&self, v: f64, h: &mut FxHasher) {
        ((v / self.s * KEY_STEPS).round() as i64).hash(h);
    }

    fn plain(&self, v: f64, h: &mut FxHasher) {
        ((v * KEY_STEPS).round() as i64).hash(h);
    }

    fn matrix(&self, m: Affine, h: &mut FxHasher) {
        let [a, b, c, d, e, f] = m;
        for v in [a, b, c, d, e - self.t[0], f - self.t[1]] {
            self.length(v, h);
        }
    }

    fn paint(&self, paint: &Paint, h: &mut FxHasher) {
        format!("{paint:?}").hash(h);
    }

    fn cover(&self, cover: &Cover, h: &mut FxHasher) {
        match cover {
            Cover::Path { contours, matrix } => {
                0u8.hash(h);
                sampled(contours, h);
                self.matrix(*matrix, h);
            }
            Cover::Ramp { ramp, contours, matrix } => {
                1u8.hash(h);
                format!("{ramp:?}").hash(h);
                sampled(contours, h);
                self.matrix(*matrix, h);
            }
            Cover::Picture { src, luma, matrix } => {
                2u8.hash(h);
                src.hash(h);
                luma.hash(h);
                self.matrix(*matrix, h);
            }
        }
    }

    fn look(&self, look: &Look, h: &mut FxHasher) {
        look.opacity.to_bits().hash(h);
        self.matrix(look.matrix, h);
        self.length(look.blur, h);
        look.blend.hash(h);
        for mask in look.masks.iter().flatten() {
            format!("{:?}", mask.mode).hash(h);
            mask.invert.hash(h);
            mask.level.to_bits().hash(h);
            self.length(mask.feather, h);
            self.cover(&mask.cover, h);
        }
        if let Some(matte) = &look.matte {
            matte.luma.hash(h);
            matte.invert.hash(h);
            matte.items.iter().for_each(|i| self.item(i, h));
        }
        format!("{:?}", look.filters).hash(h);
        for v in look.space.into_iter().flatten() {
            self.length(v, h);
        }
        for [x, y] in look.origin {
            self.length(x - self.t[0], h);
            self.length(y - self.t[1], h);
        }
    }

    fn item(&self, item: &Item, h: &mut FxHasher) {
        item.kind().hash(h);
        item.clip().hash(h);
        if let Some(look) = item.look() {
            self.look(look, h);
        }
        match item {
            Item::Path(p) => {
                sampled(&p.contours, h);
                format!("{:?}", p.rule).hash(h);
                self.paint(&p.paint, h);
                p.within.is_some().hash(h);
            }
            Item::Image(i) => {
                i.src.hash(h);
                i.fit.hash(h);
                for v in [i.size.width, i.size.height, i.focus[0], i.focus[1], i.zoom, i.tile_turn] {
                    self.plain(v, h);
                }
                format!("{:?} {:?}", i.crop, i.inner).hash(h);
            }
            Item::Layer(l) => {
                l.source.hash(h);
                self.plain(l.size.width, h);
                self.plain(l.size.height, h);
            }
            Item::Group(g) => {
                g.items.len().hash(h);
                g.items.iter().for_each(|i| self.item(i, h));
            }
            _ => {}
        }
    }
}

pub fn bucket(scale: f64) -> f64 {
    2f64.powf((scale * ZOOM_IN_ROOM).log2().ceil())
}

#[derive(Default)]
pub struct Fingerprints {
    known: rustc_hash::FxHashMap<String, u64>,
    hashed: usize,
}

impl Fingerprints {
    pub fn forget(&mut self) {
        self.known.clear();
    }

    pub fn hashed(&self) -> usize {
        self.hashed
    }

    fn of(&mut self, item: &Item, unit: Unit) -> u64 {
        let name = format!("{} {} {}", item.kind(), item.clip(), shape_of(item));
        if let Some(known) = self.known.get(&name) {
            return *known;
        }
        let mut hasher = FxHasher::default();
        unit.item(item, &mut hasher);
        let print = hasher.finish();
        self.hashed += 1;
        self.known.insert(name, print);
        print
    }
}

fn shape_of(item: &Item) -> usize {
    match item {
        Item::Path(p) => p.contours.iter().map(Vec::len).sum(),
        Item::Group(g) => g.items.len(),
        _ => 0,
    }
}

pub fn zoomless(item: &Item) -> Option<Zoomless> {
    zoomless_in(item, &mut Fingerprints::default())
}

pub fn zoomless_in(item: &Item, memo: &mut Fingerprints) -> Option<Zoomless> {
    if reads_behind(item) {
        return None;
    }
    let look = item.look()?;
    let s = similarity(look.matrix)?;
    let [.., tx, ty] = look.matrix;
    let held = bucket(s);
    let print = memo.of(item, Unit { s, t: [tx, ty] });
    Some(Zoomless { key: format!("{held} {print:016x}"), scale: s / held, shift: Point::new(tx, ty), held, screen: s })
}
