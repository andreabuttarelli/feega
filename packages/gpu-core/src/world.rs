use serde::Deserialize;
use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, Item, Look, PathItem, UseItem};
use crate::lod::BLUR_REACH;
use crate::retained::Damage;

const OVERLAY_SLACK_PX: f64 = 2.0;

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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OverlayPart {
    Fixed,
    Live,
}

const OVERLAY_PARTS: [OverlayPart; 2] = [OverlayPart::Fixed, OverlayPart::Live];

impl OverlayPart {
    pub fn group(self) -> &'static str {
        match self {
            OverlayPart::Fixed => "overlay:fixed",
            OverlayPart::Live => "overlay:live",
        }
    }

    fn index(self) -> usize {
        self as usize
    }
}

#[derive(Default)]
struct Overlay {
    items: Vec<Item>,
    at: Option<UseItem>,
}

pub struct World {
    uses: Vec<UseItem>,
    overlays: [Overlay; 2],
    damage: Damage,
}

impl Default for World {
    fn default() -> Self {
        World { uses: Vec::new(), overlays: Default::default(), damage: Damage::none() }
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

fn same(a: &Item, b: &Item) -> bool {
    match (a, b) {
        (Item::Path(a), Item::Path(b)) => a.contours == b.contours && a.look.matrix == b.look.matrix && a.look.opacity == b.look.opacity && a.paint == b.paint && a.rule == b.rule,
        _ => false,
    }
}

fn through(item: &Item, camera: Affine) -> Item {
    match item {
        Item::Path(p) => Item::Path(PathItem { look: Look { matrix: times(camera, p.look.matrix), ..p.look.clone() }, ..p.clone() }),
        other => other.clone(),
    }
}

fn steady(was: &[usize]) -> std::collections::HashSet<usize> {
    let mut tails: Vec<usize> = Vec::new();
    let mut back: Vec<Option<usize>> = vec![None; was.len()];
    for (i, v) in was.iter().enumerate() {
        let at = tails.partition_point(|&t| was[t] < *v);
        back[i] = at.checked_sub(1).map(|p| tails[p]);
        if at == tails.len() {
            tails.push(i);
        } else {
            tails[at] = i;
        }
    }
    std::iter::successors(tails.last().copied(), |&i| back[i]).collect()
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
                    let looks_alike = self.uses[at].group == u.group && self.uses[at].matrix == u.matrix;
                    let old = std::mem::replace(&mut self.uses[at], u);
                    if looks_alike {
                        continue;
                    }
                    self.mark_if_sized(reach(&old, sizes(&old.group)));
                }
                None => self.uses.push(u),
            }
            self.mark_if_sized(fresh);
        }
        if let Some(order) = patch.order {
            let rank = |clip: &str| order.iter().position(|c| c == clip).unwrap_or(usize::MAX);
            let before: Vec<String> = self.uses.iter().map(|u| u.clip.clone()).collect();
            self.uses.sort_by_key(|u| rank(&u.clip));
            let was: Vec<usize> = self.uses.iter().map(|u| before.iter().position(|c| *c == u.clip).unwrap_or(usize::MAX)).collect();
            let stayed = steady(&was);
            let moved: Vec<Option<Rect>> = self.uses.iter().enumerate().filter(|(i, _)| !stayed.contains(i)).map(|(_, u)| reach(u, sizes(&u.group))).collect();
            moved.into_iter().for_each(|r| self.mark_if_sized(r));
        }
    }

    pub fn touch(&mut self, group: &str, size: Option<(f64, f64)>) {
        let reaches: Vec<Option<Rect>> = self.uses.iter().filter(|u| u.group == group).map(|u| reach(u, size)).collect();
        reaches.into_iter().for_each(|r| self.mark_if_sized(r));
    }

    pub fn set_overlay(&mut self, part: OverlayPart, items: Vec<Item>) {
        let old = std::mem::replace(&mut self.overlays[part.index()].items, items);
        let new = &self.overlays[part.index()].items;
        let by_clip = |items: &[Item]| {
            let mut m: std::collections::HashMap<String, Vec<usize>> = std::collections::HashMap::new();
            items.iter().enumerate().for_each(|(i, item)| m.entry(item.clip().to_string()).or_default().push(i));
            m
        };
        let (was, now) = (by_clip(&old), by_clip(new));
        let kept = |item: &Item, other: &[Item], index: &std::collections::HashMap<String, Vec<usize>>| index.get(item.clip()).is_some_and(|at| at.iter().any(|&i| same(item, &other[i])));
        let gone = old.iter().filter(|i| !kept(i, new, &now));
        let came = new.iter().filter(|i| !kept(i, &old, &was));
        let bounds: Vec<Option<Rect>> = gone.chain(came).map(extent).collect();
        bounds.into_iter().for_each(|b| self.mark(b));
    }

    pub fn overlay_group(&self, part: OverlayPart) -> Option<(DisplayList, UseItem)> {
        let overlay = &self.overlays[part.index()].items;
        let reach = overlay.iter().map(extent).collect::<Option<Vec<Rect>>>()?.into_iter().reduce(|a, b| a.union(b))?;
        let blur = overlay.iter().filter_map(|i| i.look()).map(|l| l.blur).fold(0.0, f64::max);
        let pad = blur * BLUR_REACH + OVERLAY_SLACK_PX;
        let corner = reach.inflate(pad, pad);
        let (x, y) = (corner.x0.floor(), corner.y0.floor());
        let into = [1.0, 0.0, 0.0, 1.0, -x, -y];
        let items = overlay.iter().map(|i| through(i, into)).collect();
        let list = DisplayList { width: (corner.x1 - x).ceil() as u32, height: (corner.y1 - y).ceil() as u32, background: None, items, faces: Vec::new(), fragments: Default::default() };
        Some((list, UseItem { clip: part.group().into(), group: part.group().into(), matrix: [1.0, 0.0, 0.0, 1.0, x, y], cache: false, hold: false, reach: None }))
    }

    pub fn place_overlay(&mut self, part: OverlayPart, at: Option<UseItem>) {
        self.overlays[part.index()].at = at;
    }

    pub fn take_damage(&mut self) -> Damage {
        std::mem::replace(&mut self.damage, Damage::none())
    }

    pub fn screen(&self, camera: Affine, width: u32, height: u32) -> DisplayList {
        let uses = self.uses.iter().map(|u| Item::Use(UseItem { matrix: times(camera, u.matrix), ..u.clone() }));
        let overlay = OVERLAY_PARTS.iter().flat_map(|p| {
            let part = &self.overlays[p.index()];
            match &part.at {
                Some(at) => vec![Item::Use(UseItem { matrix: times(camera, at.matrix), ..at.clone() })],
                None => part.items.iter().map(|i| through(i, camera)).collect(),
            }
        });
        DisplayList { width, height, background: None, items: uses.chain(overlay).collect(), faces: Vec::new(), fragments: Default::default() }
    }
}
