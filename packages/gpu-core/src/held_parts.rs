use rustc_hash::FxHashMap;
use vello::kurbo::{Affine, Rect};

use crate::display_list::{DisplayList, Item};

use crate::held_view::HeldView;
use crate::retained::Camera;

pub const LOOSE: &str = "";
const FRESH_ZOOM: std::ops::RangeInclusive<f64> = 0.8..=1.25;
const FRESH_INSET_SHARE: f64 = 0.5;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Freshness {
    Fresh,
    Stale,
    Gone,
}

impl Freshness {
    pub fn of(view: &HeldView, now: Camera, screen: (u32, u32)) -> Freshness {
        if !view.covers(now, screen, 0.0) {
            return Freshness::Gone;
        }
        if FRESH_ZOOM.contains(&view.ratio(now)) && view.covers(now, screen, FRESH_INSET_SHARE) {
            return Freshness::Fresh;
        }
        Freshness::Stale
    }
}

pub struct Seen {
    pub on_screen: Vec<String>,
    pub near: Vec<String>,
}

pub struct Work<P> {
    pub now: Vec<String>,
    pub later: Vec<String>,
    pub gone: Vec<P>,
}

struct Part<P> {
    view: HeldView,
    scene: P,
    epoch: u64,
}

pub struct Parts<P> {
    parts: FxHashMap<String, Part<P>>,
}

impl<P> Default for Parts<P> {
    fn default() -> Self {
        Parts { parts: FxHashMap::default() }
    }
}

impl<P> Parts<P> {
    pub fn put(&mut self, key: &str, view: HeldView, scene: P, epoch: u64) -> Option<P> {
        self.parts.insert(key.to_string(), Part { view, scene, epoch }).map(|p| p.scene)
    }

    pub fn take_all(&mut self) -> Vec<P> {
        self.parts.drain().map(|(_, p)| p.scene).collect()
    }

    fn freshness(&self, key: &str, now: Camera, screen: (u32, u32)) -> Freshness {
        self.parts.get(key).map_or(Freshness::Gone, |p| Freshness::of(&p.view, now, screen))
    }

    pub fn work(&mut self, seen: &Seen, now: Camera, screen: (u32, u32), epoch: u64) -> Work<P> {
        let kept = |k: &String| seen.on_screen.contains(k) || seen.near.contains(k);
        let dropped: Vec<String> = self.parts.iter().filter(|(k, p)| p.epoch != epoch || !kept(k)).map(|(k, _)| k.clone()).collect();
        let gone = dropped.iter().filter_map(|k| self.parts.remove(k)).map(|p| p.scene).collect();
        let mut work = Work { now: Vec::new(), later: Vec::new(), gone };
        for key in &seen.on_screen {
            match self.freshness(key, now, screen) {
                Freshness::Gone => work.now.push(key.clone()),
                Freshness::Stale => work.later.push(key.clone()),
                Freshness::Fresh => {}
            }
        }
        for key in &seen.near {
            if self.freshness(key, now, screen) != Freshness::Fresh {
                work.later.push(key.clone());
            }
        }
        work
    }

    pub fn drawn(&self, seen: &Seen) -> Vec<(&HeldView, &P)> {
        seen.on_screen.iter().filter_map(|k| self.parts.get(k)).map(|p| (&p.view, &p.scene)).collect()
    }
}

fn page_of(item: &Item) -> &str {
    match item {
        Item::Use(u) => &u.group,
        _ => LOOSE,
    }
}

fn shows(item: &Item, size_of: &impl Fn(&str) -> Option<(f64, f64)>, screen: Rect) -> bool {
    let Item::Use(u) = item else { return true };
    size_of(&u.group).is_some_and(|(w, h)| Affine::new(u.matrix).transform_rect_bbox(Rect::new(0.0, 0.0, w, h)).overlaps(screen))
}

pub fn pages_of(list: &DisplayList, size_of: impl Fn(&str) -> Option<(f64, f64)>, screen: Rect) -> (Seen, FxHashMap<String, Vec<Item>>) {
    let mut pages: FxHashMap<String, Vec<Item>> = FxHashMap::default();
    let mut seen = Seen { on_screen: Vec::new(), near: Vec::new() };
    for item in &list.items {
        let page = page_of(item);
        if !pages.contains_key(page) {
            seen.near.push(page.to_string());
        }
        pages.entry(page.to_string()).or_default().push(item.clone());
        if shows(item, &size_of, screen) && !seen.on_screen.iter().any(|p| p == page) {
            seen.near.retain(|p| p != page);
            seen.on_screen.push(page.to_string());
        }
    }
    (seen, pages)
}
