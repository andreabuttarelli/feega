use std::collections::HashMap;

use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, FillRule, Item, Lens, LensItem, Look, Paint, PathItem, UseItem};
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
        Item::Image(i) => Item::Image(crate::display_list::ImageItem { look: look(&i.look), ..i.clone() }),
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

#[derive(Default)]
pub struct Library {
    groups: Groups,
    #[cfg(not(target_arch = "wasm32"))]
    fonts: Fonts,
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
    }

    pub fn drop_group(&mut self, key: &str) {
        self.groups.remove(key);
    }

    pub fn resolve(&self, list: &DisplayList) -> (DisplayList, Vec<Skipped>) {
        let (placed, groups) = expand(list, &self.groups);
        let (drawn, unset) = self.drawable(&placed);
        (drawn, named(groups, "group").chain(unset).collect())
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
