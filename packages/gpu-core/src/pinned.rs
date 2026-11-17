use std::cell::RefCell;
use std::rc::Rc;

use vello::kurbo::{Affine as Matrix, Point, Rect};
use vello::Scene;

use crate::display_list::{Affine, Item};
use crate::pictures::Pictures;
use crate::scene::{build_items, Layers};
use crate::world::pinned;

const EVERYWHERE: f64 = 1e9;
const ONCE: f64 = 1.0;
const TWICE: f64 = 2.0;
const SEEN_PX: f64 = 0.5;
const LABELLED_PX: f64 = 24.0;
const RING: &str = "ring";

pub struct PinnedScene {
    once: Scene,
    twice: Scene,
    encodes: u32,
    last: RefCell<Option<(f64, Rc<Scene>)>>,
}

fn encoded(items: &[Item], per_px: f64) -> Scene {
    let resolved: Vec<Item> = items.iter().map(|i| pinned(i, per_px)).collect();
    let mut scene = Scene::new();
    build_items(&mut scene, &resolved, Rect::new(-EVERYWHERE, -EVERYWHERE, EVERYWHERE, EVERYWHERE), &Pictures::default(), &Layers::new());
    scene
}

impl PinnedScene {
    pub fn new(items: &[Item]) -> PinnedScene {
        PinnedScene { once: encoded(items, ONCE), twice: encoded(items, TWICE), encodes: 2, last: RefCell::new(None) }
    }

    pub fn encodes(&self) -> u32 {
        self.encodes
    }

    pub fn fits(&self) -> bool {
        let (a, b) = (self.once.encoding(), self.twice.encoding());
        a.path_tags == b.path_tags && a.path_data.len() == b.path_data.len()
    }

    pub fn at(&self, per_px: f64) -> Rc<Scene> {
        let mut last = self.last.borrow_mut();
        if let Some((_, scene)) = last.as_ref().filter(|(seen, _)| *seen == per_px) {
            return scene.clone();
        }
        let mut scene = last.take().map(|(_, s)| s).unwrap_or_else(|| Rc::new(self.once.clone()));
        match Rc::get_mut(&mut scene) {
            Some(own) => self.lerp_into(own, per_px),
            None => scene = Rc::new(self.lerped(per_px)),
        }
        *last = Some((per_px, scene.clone()));
        scene
    }

    fn lerped(&self, per_px: f64) -> Scene {
        let mut scene = self.once.clone();
        self.lerp_into(&mut scene, per_px);
        scene
    }

    fn lerp_into(&self, scene: &mut Scene, per_px: f64) {
        let k = (per_px - ONCE) as f32 / (TWICE - ONCE) as f32;
        let near = &self.once.encoding().path_data;
        let far = &self.twice.encoding().path_data;
        for ((word, a), b) in scene.encoding_mut().path_data.iter_mut().zip(near).zip(far) {
            let (a, b) = (f32::from_bits(*a), f32::from_bits(*b));
            *word = (a + (b - a) * k).to_bits();
        }
    }
}

struct Piece {
    anchors: Rect,
    reach: f64,
    scene: PinnedScene,
    small: Option<PinnedScene>,
}

impl Piece {
    fn of(items: &[Item]) -> Piece {
        let rings: Vec<Item> = items.iter().filter(|i| part(i) == RING).cloned().collect();
        let small = (!rings.is_empty()).then(|| PinnedScene::new(&rings));
        Piece { anchors: anchors_of(items), reach: reach_of(items), scene: PinnedScene::new(items), small }
    }

    fn fits(&self) -> bool {
        self.scene.fits() && self.small.as_ref().is_none_or(PinnedScene::fits)
    }

    fn shown(&self, camera: Matrix, per_px: f64, view: Rect) -> Option<&PinnedScene> {
        let on = camera.transform_rect_bbox(self.anchors.inflate(self.reach * per_px, self.reach * per_px));
        if !on.overlaps(view) || on.width().max(on.height()) < SEEN_PX {
            return None;
        }
        let frame = camera.transform_rect_bbox(self.anchors);
        self.drawn(frame.width().max(frame.height()))
    }

    fn drawn(&self, frame_px: f64) -> Option<&PinnedScene> {
        match &self.small {
            Some(rings) if frame_px < LABELLED_PX => Some(rings),
            _ => Some(&self.scene),
        }
    }
}

pub struct PinnedPieces {
    pieces: Vec<Piece>,
}

fn owner(item: &Item) -> &str {
    item.clip().split(':').next().unwrap_or_default()
}

fn part(item: &Item) -> &str {
    item.clip().rsplit(':').next().unwrap_or_default()
}

fn anchors_of(items: &[Item]) -> Rect {
    let points = items.iter().flat_map(|i| match i {
        Item::Path(p) => {
            let m = Matrix::new(p.look.matrix);
            p.contours.iter().flat_map(|c| c.chunks_exact(2)).map(|xy| m * Point::new(xy[0], xy[1])).collect()
        }
        _ => Vec::new(),
    });
    points.map(|pt| Rect::from_points(pt, pt)).reduce(|a, b| a.union(b)).unwrap_or(Rect::ZERO)
}

fn reach_of(items: &[Item]) -> f64 {
    let nudges = items.iter().flat_map(|i| match i {
        Item::Path(p) => p.nudge.iter().flatten().copied().collect(),
        _ => Vec::new(),
    });
    nudges.map(f64::abs).fold(0.0, f64::max)
}

impl PinnedPieces {
    pub fn new(items: &[Item]) -> Option<PinnedPieces> {
        let pieces: Vec<Piece> = items.chunk_by(|a, b| owner(a) == owner(b)).map(Piece::of).collect();
        pieces.iter().all(Piece::fits).then_some(PinnedPieces { pieces })
    }

    pub fn seen(&self, camera: Affine, per_px: f64, (w, h): (u32, u32)) -> Vec<Rc<Scene>> {
        let view = Rect::new(0.0, 0.0, w as f64, h as f64);
        let camera = Matrix::new(camera);
        self.pieces.iter().filter_map(|p| p.shown(camera, per_px, view)).map(|s| s.at(per_px)).collect()
    }
}
