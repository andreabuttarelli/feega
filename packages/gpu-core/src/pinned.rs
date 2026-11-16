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
        let scene = Rc::new(self.lerped(per_px));
        *last = Some((per_px, scene.clone()));
        scene
    }

    fn lerped(&self, per_px: f64) -> Scene {
        let mut scene = self.once.clone();
        let k = (per_px - ONCE) as f32 / (TWICE - ONCE) as f32;
        let twice = &self.twice.encoding().path_data;
        for (word, far) in scene.encoding_mut().path_data.iter_mut().zip(twice) {
            let (a, b) = (f32::from_bits(*word), f32::from_bits(*far));
            *word = (a + (b - a) * k).to_bits();
        }
        scene
    }
}
