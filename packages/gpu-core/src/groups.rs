use std::collections::HashMap;

use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, FillRule, Item, Look, Paint, PathItem, UseItem};
#[cfg(not(target_arch = "wasm32"))]
use crate::glyphs::{outline, Fonts};
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

fn used(u: &UseItem, group: &DisplayList) -> Vec<Item> {
    let frame = screen_rect(u.matrix, Rect::new(0.0, 0.0, group.width as f64, group.height as f64));
    let scale = scale_of(u.matrix);
    let back = group.background.map(|c| background(&u.clip, c, frame));
    back.into_iter().chain(group.items.iter().map(|i| placed(i, u.matrix, frame, scale))).collect()
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
    fn drawable(&self, list: &DisplayList) -> (DisplayList, Vec<String>) {
        outline(list, &self.fonts)
    }

    #[cfg(target_arch = "wasm32")]
    fn drawable(&self, list: &DisplayList) -> (DisplayList, Vec<String>) {
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
        let (drawn, fonts) = self.drawable(&placed);
        (drawn, named(groups, "group").chain(named(fonts, "font")).collect())
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
            Some(group) => items.extend(used(u, group)),
            None => missing.push(u.group.clone()),
        }
    }
    (DisplayList { items, ..list.clone_empty() }, missing)
}
