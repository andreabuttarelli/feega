use serde::Deserialize;
use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, Item, Look, PathItem, UseItem};
use crate::retained::Damage;

#[derive(Debug, Deserialize)]
pub struct Patch {
    pub put: Vec<UseItem>,
    pub drop: Vec<String>,
    #[serde(default)]
    pub order: Option<Vec<String>>,
}

pub fn parse_patch(json: &str) -> Result<Patch, serde_json::Error> {
    serde_json::from_str(json)
}

pub fn parse_overlay(json: &str) -> Result<Vec<Item>, serde_json::Error> {
    serde_json::from_str(json)
}

pub type Sizes<'a> = &'a dyn Fn(&str) -> Option<(f64, f64)>;

pub struct World {
    uses: Vec<UseItem>,
    overlay: Vec<Item>,
    damage: Damage,
}

impl Default for World {
    fn default() -> Self {
        World { uses: Vec::new(), overlay: Vec::new(), damage: Damage::none() }
    }
}

fn times(m: Affine, by: Affine) -> Affine {
    (Matrix::new(m) * Matrix::new(by)).as_coeffs()
}

fn hull(m: Affine, points: impl Iterator<Item = (f64, f64)>) -> Option<Rect> {
    let t = Matrix::new(m);
    points.map(|(x, y)| t * Point::new(x, y)).fold(None, |acc: Option<Rect>, p| Some(acc.map_or(Rect::from_points(p, p), |r| r.union_pt(p))))
}

fn reach(u: &UseItem, size: Option<(f64, f64)>) -> Option<Rect> {
    let (w, h) = size?;
    hull(u.matrix, [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)].into_iter())
}

fn extent(item: &Item) -> Option<Rect> {
    match item {
        Item::Path(p) => hull(p.look.matrix, p.contours.iter().flat_map(|c| c.chunks_exact(2).map(|xy| (xy[0], xy[1])))),
        _ => None,
    }
}

fn through(item: &Item, camera: Affine) -> Item {
    match item {
        Item::Path(p) => Item::Path(PathItem { look: Look { matrix: times(camera, p.look.matrix), ..p.look.clone() }, ..p.clone() }),
        other => other.clone(),
    }
}

impl World {
    pub fn new() -> Self {
        Self::default()
    }

    fn mark(&mut self, rect: Option<Rect>) {
        match rect {
            Some(r) => self.damage.add(r),
            None => self.damage = Damage::All,
        }
    }

    fn mark_if_sized(&mut self, rect: Option<Rect>) {
        if let Some(r) = rect {
            self.damage.add(r);
        }
    }

    pub fn patch(&mut self, patch: Patch, sizes: impl Fn(&str) -> Option<(f64, f64)>) {
        for gone in &patch.drop {
            let Some(at) = self.uses.iter().position(|u| &u.clip == gone) else { continue };
            let old = self.uses.remove(at);
            self.mark_if_sized(reach(&old, sizes(&old.group)));
        }
        for u in patch.put {
            let fresh = reach(&u, sizes(&u.group));
            match self.uses.iter().position(|o| o.clip == u.clip) {
                Some(at) => {
                    let old = std::mem::replace(&mut self.uses[at], u);
                    self.mark_if_sized(reach(&old, sizes(&old.group)));
                }
                None => self.uses.push(u),
            }
            self.mark_if_sized(fresh);
        }
        if let Some(order) = patch.order {
            let rank = |clip: &str| order.iter().position(|c| c == clip).unwrap_or(usize::MAX);
            self.uses.sort_by_key(|u| rank(&u.clip));
            self.damage = Damage::All;
        }
    }

    pub fn touch(&mut self, group: &str, size: Option<(f64, f64)>) {
        let reaches: Vec<Option<Rect>> = self.uses.iter().filter(|u| u.group == group).map(|u| reach(u, size)).collect();
        reaches.into_iter().for_each(|r| self.mark_if_sized(r));
    }

    pub fn touch_all(&mut self) {
        self.damage = Damage::All;
    }

    pub fn set_overlay(&mut self, items: Vec<Item>) {
        let old = std::mem::replace(&mut self.overlay, items);
        let bounds: Vec<Option<Rect>> = old.iter().chain(&self.overlay).map(extent).collect();
        bounds.into_iter().for_each(|b| self.mark(b));
    }

    pub fn take_damage(&mut self) -> Damage {
        std::mem::replace(&mut self.damage, Damage::none())
    }

    pub fn screen(&self, camera: Affine, width: u32, height: u32) -> DisplayList {
        let uses = self.uses.iter().map(|u| Item::Use(UseItem { matrix: times(camera, u.matrix), ..u.clone() }));
        let overlay = self.overlay.iter().map(|i| through(i, camera));
        DisplayList { width, height, background: None, items: uses.chain(overlay).collect(), faces: Vec::new() }
    }
}
