use std::cell::Cell;

use serde::Deserialize;
use vello::kurbo::{Affine as Matrix, Point, Rect};

use crate::display_list::{Affine, DisplayList, Item, Look, PathItem, UseItem};
use crate::lod::{BLUR_REACH, VIEW_SLACK_PX};
use crate::retained::Damage;
use crate::uses::{Plus, Uses};

const OVERLAY_SLACK_PX: f64 = 2.0;

#[derive(Debug, Deserialize)]
pub struct Patch {
    pub put: Vec<UseItem>,
    pub drop: Vec<String>,
    #[serde(default)]
    pub order: Option<Vec<String>>,
}

impl Patch {
    pub fn for_tiles(self) -> Patch {
        Patch { put: self.put.into_iter().map(|u| UseItem { cache: u.hold, ..u }).collect(), ..self }
    }
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
    Selected,
    Live,
}

const OVERLAY_PARTS: [OverlayPart; 3] = [OverlayPart::Fixed, OverlayPart::Selected, OverlayPart::Live];

impl OverlayPart {
    pub fn group(self) -> &'static str {
        match self {
            OverlayPart::Fixed => "overlay:fixed",
            OverlayPart::Selected => "overlay:selected",
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

pub struct Lift {
    pub clip: String,
    pub rest: Rect,
    pub by: (f64, f64),
}

pub struct World {
    uses: Uses,
    overlays: [Overlay; 3],
    damage: Damage,
    scene_damage: Damage,
    rest: std::collections::HashMap<String, (String, Affine)>,
    visited: Cell<usize>,
}

impl Default for World {
    fn default() -> Self {
        World { uses: Uses::default(), overlays: Default::default(), damage: Damage::none(), scene_damage: Damage::none(), rest: Default::default(), visited: Cell::new(0) }
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

fn sighted(camera: Affine, width: u32, height: u32) -> Option<Rect> {
    let [a, b, c, d, _, _] = camera;
    if b != 0.0 || c != 0.0 || a == 0.0 || d == 0.0 {
        return None;
    }
    let view = Rect::new(0.0, 0.0, width as f64, height as f64);
    let slack = VIEW_SLACK_PX / a.abs().min(d.abs());
    Some(Matrix::new(camera).inverse().transform_rect_bbox(view).inflate(slack, slack))
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
        self.mark_use(rect, true);
    }

    fn mark_use(&mut self, rect: Option<Rect>, in_scene: bool) {
        let Some(r) = rect else { return };
        self.damage.add(r);
        if in_scene {
            self.scene_damage.add(r);
        }
    }

    fn shifted_from_rest(&self, u: &UseItem) -> Option<(f64, f64)> {
        let (_, at) = self.rest.get(&u.clip)?;
        let same_shape = at[..4] == u.matrix[..4];
        (u.hold && same_shape && at != &u.matrix).then(|| (u.matrix[4] - at[4], u.matrix[5] - at[5]))
    }

    pub fn lifts(&self, sizes: impl Fn(&str) -> Option<(f64, f64)>) -> Vec<Lift> {
        self.uses.flagged().into_iter().filter_map(|u| {
            let by = self.shifted_from_rest(u)?;
            let (_, at) = &self.rest[&u.clip];
            let rest = reach(&UseItem { matrix: *at, ..u.clone() }, sizes(&u.group))?;
            Some(Lift { clip: u.clip.clone(), rest, by })
        }).collect()
    }

    pub fn extent(&self) -> Option<Rect> {
        self.uses.extent()
    }

    pub fn holding(&self) -> bool {
        self.uses.flagged().iter().any(|u| u.hold)
    }

    fn lifted(&self, u: &UseItem) -> bool {
        u.hold && self.rest.get(&u.clip).is_none_or(|(_, matrix)| *matrix != u.matrix)
    }

    fn mark_scene(&mut self, rect: Option<Rect>) {
        if let Some(r) = rect {
            self.scene_damage.add(r);
        }
    }

    pub fn patch(&mut self, patch: Patch, sizes: impl Fn(&str) -> Option<(f64, f64)>) {
        for gone in &patch.drop {
            let Some(old) = self.uses.get(gone) else { continue };
            let was_scene = !self.lifted(old);
            let old = self.uses.remove(gone).expect("listed");
            self.rest.remove(gone);
            self.mark_use(reach(&old, sizes(&old.group)), was_scene);
        }
        for u in patch.put {
            let fresh = reach(&u, sizes(&u.group));
            let was_scene = self.uses.get(&u.clip).map(|o| !self.lifted(o));
            let moved = self.uses.get(&u.clip).is_some_and(|o| o.group != u.group || o.matrix != u.matrix);
            if !u.hold {
                self.rest.insert(u.clip.clone(), (u.group.clone(), u.matrix));
            }
            let now_scene = !self.lifted(&u);
            let old = self.uses.put(u, fresh);
            let Some((old, was_scene)) = old.zip(was_scene) else {
                self.mark_use(fresh, now_scene);
                continue;
            };
            let stale = reach(&old, sizes(&old.group));
            if moved {
                self.damage.join(Damage::Rects(stale.into_iter().chain(fresh).collect()));
            }
            if was_scene && (moved || !now_scene) {
                self.mark_scene(stale);
            }
            if now_scene && (moved || !was_scene) {
                self.mark_scene(fresh);
            }
        }
        if let Some(order) = patch.order {
            let was = self.uses.restack(&order);
            let stayed = steady(&was);
            let moved: Vec<Option<Rect>> = self.uses.all().into_iter().enumerate().filter(|(i, _)| !stayed.contains(i)).map(|(_, u)| reach(u, sizes(&u.group))).collect();
            moved.into_iter().for_each(|r| self.mark_if_sized(r));
        }
    }

    pub fn touch(&mut self, group: &str, size: Option<(f64, f64)>) {
        self.uses.reach_group(group, |u| reach(u, size));
        let reaches: Vec<Option<Rect>> = self.uses.of_group(group).into_iter().map(|u| reach(u, size)).collect();
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

    pub fn take_scene_damage(&mut self) -> Damage {
        std::mem::replace(&mut self.scene_damage, Damage::none())
    }

    pub fn take_visited(&self) -> usize {
        self.visited.replace(0)
    }

    fn visit<'a>(&self, uses: Vec<&'a UseItem>) -> Vec<&'a UseItem> {
        self.visited.set(self.visited.get() + uses.len());
        uses
    }

    pub fn scene(&self, camera: Affine, width: u32, height: u32) -> DisplayList {
        let uses = self.visit(self.uses.meeting(sighted(camera, width, height), Plus::Nothing)).into_iter().filter(|u| !self.lifted(u)).map(|u| Item::Use(UseItem { matrix: times(camera, u.matrix), cache: false, hold: false, ..u.clone() }));
        DisplayList { width, height, background: None, items: uses.collect(), faces: Vec::new(), fragments: Default::default() }
    }

    pub fn overlay(&self, camera: Affine, width: u32, height: u32) -> DisplayList {
        let held = self.visit(self.uses.flagged()).into_iter().filter(|u| self.lifted(u) && self.shifted_from_rest(u).is_none()).map(|u| Item::Use(UseItem { matrix: times(camera, u.matrix), ..u.clone() }));
        let items = held.chain(OVERLAY_PARTS.iter().flat_map(|p| {
            let part = &self.overlays[p.index()];
            match &part.at {
                Some(at) => vec![Item::Use(UseItem { matrix: times(camera, at.matrix), ..at.clone() })],
                None => part.items.iter().map(|i| through(i, camera)).collect(),
            }
        }));
        DisplayList { width, height, background: None, items: items.collect(), faces: Vec::new(), fragments: Default::default() }
    }

    pub fn screen(&self, camera: Affine, width: u32, height: u32) -> DisplayList {
        let uses = self.visit(self.uses.meeting(sighted(camera, width, height), Plus::Flagged)).into_iter().map(|u| Item::Use(UseItem { matrix: times(camera, u.matrix), ..u.clone() }));
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
