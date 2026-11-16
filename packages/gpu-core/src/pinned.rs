use std::cell::RefCell;
use std::rc::Rc;

use vello::kurbo::Rect;
use vello::Scene;

use crate::display_list::Item;
use crate::pictures::Pictures;
use crate::scene::{build_items, Layers};
use crate::world::pinned;

const EVERYWHERE: f64 = 1e9;
const ONCE: f64 = 1.0;
const TWICE: f64 = 2.0;

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
