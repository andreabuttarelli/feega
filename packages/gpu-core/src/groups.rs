use std::collections::{HashMap, HashSet};

use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, FillRule, GroupItem, ImageItem, Item, LayerItem, Lens, LensItem, Look, Paint, PathItem, Size, UseItem};
#[cfg(not(target_arch = "wasm32"))]
use crate::glyphs::{outline, Fonts};
#[cfg(not(target_arch = "wasm32"))]
use crate::text::typeset;
use crate::Skipped;

#[derive(Default)]
pub struct Groups {
    lists: HashMap<String, DisplayList>,
}

impl Groups {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn put(&mut self, key: &str, list: DisplayList) {
        self.lists.insert(key.into(), list);
    }

    pub fn remove(&mut self, key: &str) {
        self.lists.remove(key);
    }

    pub fn append(&mut self, key: &str, items: Vec<Item>) {
        if let Some(list) = self.lists.get_mut(key) {
            list.items.extend(items);
        }
    }

    pub fn get(&self, key: &str) -> Option<&DisplayList> {
        self.lists.get(key)
    }
}

fn times(m: Affine, by: Affine) -> Affine {
    (Matrix::new(m) * Matrix::new(by)).as_coeffs()
}

fn screen_rect(m: Affine, local: Rect) -> Rect {
    let t = Matrix::new(m);
    let corners = [(local.x0, local.y0), (local.x1, local.y0), (local.x1, local.y1), (local.x0, local.y1)].map(|(x, y)| t * Point::new(x, y));
    corners.iter().skip(1).fold(Rect::from_points(corners[0], corners[0]), |r, p| r.union_pt(*p))
}

fn scissor_of(r: Rect) -> [f64; 4] {
    [r.x0, r.y0, r.x1, r.y1]
}

fn scale_of(m: Affine) -> f64 {
    m[0].hypot(m[1]).min(m[2].hypot(m[3]))
}

fn moved_lens(lens: &Lens, m: Affine, frame: Rect, scale: f64) -> Lens {
    let t = Matrix::new(m);
    let point = |x: f32, y: f32| {
        let p = t * Point::new(x as f64, y as f64);
        [p.x as f32, p.y as f32]
    };
    let k = scale as f32;
    let mut drops = lens.drops;
    for d in drops.chunks_exact_mut(3) {
        let [x, y] = point(d[0], d[1]);
        d[0] = x;
        d[1] = y;
        d[2] *= k;
    }
    let [x, y, w, h] = lens.area.map(f64::from);
    let area = screen_rect(m, Rect::new(x, y, x + w, y + h)).intersect(frame);
    Lens {
        center: point(lens.center[0], lens.center[1]),
        drops,
        blend: lens.blend * k,
        wobble: lens.wobble * k,
        frost: lens.frost * k,
        area: [area.x0 as f32, area.y0 as f32, area.width().max(0.0) as f32, area.height().max(0.0) as f32],
        ..lens.clone()
    }
}

fn placed(item: &Item, m: Affine, frame: Rect, scale: f64) -> Item {
    let look = |look: &Look| {
        let own = look.scissor.map(|[x0, y0, x1, y1]| screen_rect(m, Rect::new(x0, y0, x1, y1)));
        let clip = own.map_or(frame, |o| o.intersect(frame));
        let masks = look.masks.clone().map(|layers| {
            layers
                .into_iter()
                .map(|mut l| {
                    l.feather *= scale;
                    l.cover = l.cover.moved(m);
                    l
                })
                .collect()
        });
        let matte = look.matte.clone().map(|mut matte| {
            matte.items = matte.items.iter().map(|i| placed(i, m, frame, scale)).collect();
            matte
        });
        let space = look.space.map(|[a, b, c, d]| {
            let s = times(m, [a, b, c, d, 0.0, 0.0]);
            [s[0], s[1], s[2], s[3]]
        });
        Look { matrix: times(m, look.matrix), blur: look.blur * scale, scissor: Some(scissor_of(clip)), masks, matte, space, ..look.clone() }
    };
    match item {
        Item::Path(p) => Item::Path(PathItem { look: look(&p.look), ..p.clone() }),
        Item::Image(i) => Item::Image(ImageItem { look: look(&i.look), ..i.clone() }),
        Item::Layer(l) => Item::Layer(LayerItem { look: look(&l.look), ..l.clone() }),
        Item::Group(g) => Item::Group(Box::new(GroupItem { clip: g.clip.clone(), items: g.items.iter().map(|i| placed(i, m, frame, scale)).collect(), look: look(&g.look) })),
        Item::Lens(l) => Item::Lens(Box::new(LensItem { lens: moved_lens(&l.lens, m, frame, scale), ..(**l).clone() })),
        other => other.clone(),
    }
}

fn background(clip: &str, colour: crate::display_list::Rgba, frame: Rect) -> Item {
    let contour = vec![frame.x0, frame.y0, frame.x1, frame.y0, frame.x1, frame.y1, frame.x0, frame.y1];
    Item::Path(PathItem {
        clip: format!("frame:{clip}"),
        contours: vec![contour],
        rule: FillRule::NonZero,
        paint: Paint::Solid { color: colour },
        within: None,
        look: Look { opacity: 1.0, matrix: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], blur: 0.0, blend: "normal".into(), scissor: Some(scissor_of(frame)), masks: None, matte: None, filters: None, space: None, backdrop: None },
    })
}

fn used(u: &UseItem, group: &DisplayList, start: usize) -> Vec<Item> {
    let frame = screen_rect(u.matrix, Rect::new(0.0, 0.0, group.width as f64, group.height as f64));
    let scale = scale_of(u.matrix);
    let back = group.background.map(|c| background(&u.clip, c, frame));
    let first = start + back.iter().count();
    let items = group.items.iter().map(|i| match placed(i, u.matrix, frame, scale) {
        Item::Lens(mut l) => {
            l.under += first;
            Item::Lens(l)
        }
        other => other,
    });
    back.into_iter().chain(items).collect()
}

pub fn report(skipped: &[Skipped]) -> String {
    skipped.iter().map(|s| format!("{} {}", s.clip, s.what)).collect::<Vec<_>>().join("\n")
}

const CACHE_PREFIX: &str = "cache:";
const RGBA_BYTES: u64 = 4;
const SHARPEST: f64 = 1.02;
const SOFTEST: f64 = 0.8;
const IDENTITY: Affine = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub side: u32,
    pub rasters: usize,
    pub items: usize,
}

pub struct Raster {
    pub clip: String,
    pub list: DisplayList,
}

pub struct Plan {
    pub screen: DisplayList,
    pub rasters: Vec<Raster>,
    pub evicted: Vec<String>,
    pub pending: bool,
    pub skipped: Vec<Skipped>,
    pub finished: Vec<String>,
    pub waiting: Vec<String>,
}

#[derive(Clone, Copy)]
struct Building {
    scale: f64,
    next: usize,
}

struct Chunk {
    raster: Raster,
    done: bool,
}

#[derive(Clone, Copy)]
struct Held {
    scale: f64,
    bytes: u64,
}

fn cache_clip(group: &str) -> String {
    format!("{CACHE_PREFIX}{group}")
}

fn building_clip(group: &str) -> String {
    format!("{CACHE_PREFIX}{group}#building")
}

fn texels(group: &DisplayList, scale: f64) -> (u32, u32) {
    ((group.width as f64 * scale).ceil() as u32, (group.height as f64 * scale).ceil() as u32)
}

fn held_within(u: &UseItem, group: &DisplayList, want: f64, side: u32) -> f64 {
    let longest = group.width.max(group.height) as f64;
    if !(u.cache && u.hold) || longest * want <= side as f64 {
        return want;
    }
    side as f64 / longest
}

fn fresh(want: f64, held: f64) -> bool {
    (SOFTEST..=SHARPEST).contains(&(want / held))
}

fn snapped(m: Affine) -> Affine {
    let straight = m[1] == 0.0 && m[2] == 0.0;
    if straight {
        [m[0], 0.0, 0.0, m[3], m[4].round(), m[5].round()]
    } else {
        m
    }
}

fn cached_image(u: &UseItem, group: &DisplayList, scale: f64) -> Item {
    texture_image(u, group, scale, cache_clip(&u.group))
}

fn texture_image(u: &UseItem, group: &DisplayList, scale: f64, clip: String) -> Item {
    let (w, h) = texels(group, scale);
    let frame = screen_rect(u.matrix, Rect::new(0.0, 0.0, group.width as f64, group.height as f64));
    let matrix = snapped(times(u.matrix, [1.0 / scale, 0.0, 0.0, 1.0 / scale, 0.0, 0.0]));
    let look = Look { opacity: 1.0, matrix, blur: 0.0, blend: "normal".into(), scissor: Some(scissor_of(frame)), masks: None, matte: None, filters: None, space: None, backdrop: None };
    let size = Size { width: w as f64, height: h as f64 };
    Item::Image(ImageItem { clip: clip.clone(), src: clip, video: false, media_time: 0.0, size, fit: "fill".into(), focus: [0.0, 0.0], zoom: 1.0, clipped: true, inner: IDENTITY, look })
}

fn partial(group: &str, (w, h): (u32, u32)) -> Item {
    let look = Look { opacity: 1.0, matrix: IDENTITY, blur: 0.0, blend: "normal".into(), scissor: None, masks: None, matte: None, filters: None, space: None, backdrop: None };
    let size = Size { width: w as f64, height: h as f64 };
    Item::Image(ImageItem { clip: building_clip(group), src: building_clip(group), video: false, media_time: 0.0, size, fit: "fill".into(), focus: [0.0, 0.0], zoom: 1.0, clipped: true, inner: IDENTITY, look })
}

fn chunk_of(u: &UseItem, group: &DisplayList, at: Building, items: usize) -> Chunk {
    let size = texels(group, at.scale);
    let placed = UseItem { matrix: [at.scale, 0.0, 0.0, at.scale, 0.0, 0.0], ..u.clone() };
    let all = used(&placed, group, 0);
    let whole = all.iter().any(|i| matches!(i, Item::Lens(_)));
    let end = if whole { all.len() } else { (at.next + items).min(all.len()) };
    let done = end == all.len();
    let base = (at.next > 0).then(|| partial(&u.group, size));
    let list = DisplayList { width: size.0, height: size.1, background: None, items: base.into_iter().chain(all[at.next..end].iter().cloned()).collect(), faces: group.faces.clone() };
    let clip = if done { cache_clip(&u.group) } else { building_clip(&u.group) };
    Chunk { raster: Raster { clip, list }, done }
}

#[derive(Default)]
pub struct Library {
    groups: Groups,
    held: HashMap<String, Held>,
    building: HashMap<String, Building>,
    stale: Vec<String>,
    retiring: Vec<String>,
    #[cfg(not(target_arch = "wasm32"))]
    fonts: Fonts,
}

fn draws(item: &Item, picture: &str) -> bool {
    let own = match item {
        Item::Image(i) => i.clip == picture,
        Item::Layer(l) => l.source == picture,
        Item::Group(g) => g.items.iter().any(|i| draws(i, picture)),
        _ => false,
    };
    let look = item.look();
    let covered = look.and_then(|l| l.masks.as_ref()).into_iter().flatten().any(|m| matches!(&m.cover, crate::display_list::Cover::Picture { src, .. } if src == picture));
    let matted = look.and_then(|l| l.matte.as_ref()).is_some_and(|m| m.items.iter().any(|i| draws(i, picture)));
    own || covered || matted
}

fn named(keys: Vec<String>, what: &str) -> impl Iterator<Item = Skipped> + '_ {
    keys.into_iter().map(move |clip| Skipped { clip, what: what.into() })
}

impl Library {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn put_font(&mut self, key: &str, source: gpu_text::Source) {
        self.fonts.put(key, source);
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn has_font(&self, key: &str) -> bool {
        self.fonts.sources().contains_key(key)
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn drawable(&self, list: &DisplayList) -> (DisplayList, Vec<Skipped>) {
        let (set, unset) = typeset(list, self.fonts.sources());
        let (drawn, fonts) = outline(&set, &self.fonts);
        (drawn, unset.into_iter().chain(named(fonts, "font")).collect())
    }

    #[cfg(target_arch = "wasm32")]
    fn drawable(&self, list: &DisplayList) -> (DisplayList, Vec<Skipped>) {
        (list.clone(), vec![])
    }

    pub fn put_group(&mut self, key: &str, list: &DisplayList) {
        let (drawn, _) = self.drawable(list);
        self.groups.put(key, drawn);
        self.forget(key);
    }

    pub fn append_group(&mut self, key: &str, list: &DisplayList) {
        let (drawn, _) = self.drawable(list);
        self.groups.append(key, drawn.items);
        self.forget(key);
    }

    pub fn drop_group(&mut self, key: &str) {
        self.groups.remove(key);
        self.forget(key);
    }

    fn forget(&mut self, key: &str) {
        if self.held.remove(key).is_some() {
            self.stale.push(cache_clip(key));
        }
        if self.building.remove(key).is_some() {
            self.stale.push(building_clip(key));
        }
    }

    pub fn groups_drawing(&self, picture: &str) -> Vec<String> {
        self.groups.lists.iter().filter(|(_, list)| list.items.iter().any(|i| draws(i, picture))).map(|(k, _)| k.clone()).collect()
    }

    pub fn size_of(&self, group: &str) -> Option<(f64, f64)> {
        self.groups.get(group).map(|g| (g.width as f64, g.height as f64))
    }

    pub fn cache_bytes(&self) -> u64 {
        self.held.values().map(|h| h.bytes).sum()
    }

    pub fn plan(&mut self, list: &DisplayList, limits: Limits) -> Plan {
        let mut missing = Vec::new();
        let mut rasters = Vec::new();
        let mut seen = HashSet::new();
        let mut pending = false;
        let mut finished = Vec::new();
        let mut waiting = Vec::new();
        let mut items = Vec::with_capacity(list.items.len());
        for item in &list.items {
            let Item::Use(u) = item else {
                items.push(item.clone());
                continue;
            };
            let Some(group) = self.groups.get(&u.group) else {
                missing.push(u.group.clone());
                continue;
            };
            let on_screen = screen_rect(u.matrix, Rect::new(0.0, 0.0, group.width as f64, group.height as f64)).overlaps(Rect::new(0.0, 0.0, list.width as f64, list.height as f64));
            let want = held_within(u, group, scale_of(u.matrix), limits.side);
            let (w, h) = texels(group, want);
            if let (true, Some(kept)) = (u.cache && u.hold, self.held.get(&u.group).copied()) {
                seen.insert(u.group.clone());
                if on_screen {
                    items.push(cached_image(u, group, kept.scale));
                }
                continue;
            }
            if !u.cache || want <= 0.0 || w.max(h) > limits.side {
                if on_screen {
                    let start = items.len();
                    items.extend(used(u, group, start));
                }
                continue;
            }
            seen.insert(u.group.clone());
            let held = self.held.get(&u.group).copied();
            let shown = match held {
                Some(h) if fresh(want, h.scale) => Some(h.scale),
                _ if rasters.len() < limits.rasters => {
                    let at = self.building.get(&u.group).copied().filter(|b| fresh(want, b.scale)).unwrap_or(Building { scale: want, next: 0 });
                    let chunk = chunk_of(u, group, at, limits.items);
                    let next = at.next + limits.items;
                    rasters.push(chunk.raster);
                    if chunk.done {
                        self.building.remove(&u.group);
                        if at.next > 0 {
                            self.retiring.push(building_clip(&u.group));
                        }
                        let (w, h) = texels(group, at.scale);
                        self.held.insert(u.group.clone(), Held { scale: at.scale, bytes: w as u64 * h as u64 * RGBA_BYTES });
                        finished.push(u.group.clone());
                        Some(at.scale)
                    } else {
                        self.building.insert(u.group.clone(), Building { scale: at.scale, next });
                        pending = true;
                        waiting.push(u.group.clone());
                        held.map(|h| h.scale)
                    }
                }
                _ => {
                    pending = true;
                    waiting.push(u.group.clone());
                    held.map(|h| h.scale)
                }
            };
            match (on_screen, shown) {
                (false, _) => {}
                (true, Some(scale)) => items.push(cached_image(u, group, scale)),
                (true, None) => {
                    let start = items.len();
                    items.extend(used(u, group, start));
                }
            }
        }
        let gone: Vec<String> = self.held.keys().filter(|k| !seen.contains(*k)).cloned().collect();
        let abandoned: Vec<String> = self.building.keys().filter(|k| !seen.contains(*k)).cloned().collect();
        for key in &gone {
            self.held.remove(key);
        }
        for key in &abandoned {
            self.building.remove(key);
        }
        let mut evicted = std::mem::replace(&mut self.stale, std::mem::take(&mut self.retiring));
        evicted.extend(gone.iter().map(|k| cache_clip(k)));
        evicted.extend(abandoned.iter().map(|k| building_clip(k)));
        let rasters = rasters.into_iter().map(|r| Raster { list: self.drawable(&r.list).0, ..r }).collect();
        let (screen, unset) = self.drawable(&DisplayList { items, ..list.clone_empty() });
        Plan { screen, rasters, evicted, pending, skipped: named(missing, "group").chain(unset).collect(), finished, waiting }
    }
}

pub fn expand(list: &DisplayList, groups: &Groups) -> (DisplayList, Vec<String>) {
    let mut missing = Vec::new();
    let mut items = Vec::with_capacity(list.items.len());
    for item in &list.items {
        let Item::Use(u) = item else {
            items.push(item.clone());
            continue;
        };
        match groups.get(&u.group) {
            Some(group) => {
                let start = items.len();
                items.extend(used(u, group, start));
            }
            None => missing.push(u.group.clone()),
        }
    }
    (DisplayList { items, ..list.clone_empty() }, missing)
}
