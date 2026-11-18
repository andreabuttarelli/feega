use gpu_core::pinned::PinnedScene;
use gpu_core::world::{parse_overlay, pinned};
use vello::kurbo::Rect;
use vello::Scene;

const RING: &str = r#"[
  { "kind": "path", "clip": "f:ring", "contours": [[100, 50, 500, 50, 500, 350, 100, 350], [97, 47, 97, 353, 503, 353, 503, 47]], "nudge": [[-1, -1, 1, -1, 1, 1, -1, 1], [-3, -3, -3, 3, 3, 3, 3, -3]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] },
  { "kind": "path", "clip": "f:label", "contours": [[100, 30, 140, 30, 140, 42, 100, 42]], "nudge": [[0, -20, 40, -20, 40, -8, 0, -8]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0.4, 0.4, 0.4, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }
]"#;

const SLACK: f32 = 1e-3;

fn fresh(per_px: f64) -> Scene {
    let items: Vec<_> = parse_overlay(RING).unwrap().iter().map(|i| pinned(i, per_px)).collect();
    let mut scene = Scene::new();
    gpu_core::scene::build_items(&mut scene, &items, Rect::new(-1e9, -1e9, 1e9, 1e9), &Default::default(), &gpu_core::scene::Layers::new());
    scene
}

fn floats(scene: &Scene) -> Vec<f32> {
    scene.encoding().path_data.iter().map(|w| f32::from_bits(*w)).collect()
}

#[test]
fn a_gesture_reuses_the_pinned_encoding_and_lands_every_point_where_a_fresh_one_would() {
    let cached = PinnedScene::new(&parse_overlay(RING).unwrap());
    let built = cached.encodes();

    for zoom in [0.05, 0.3, 1.0, 2.5, 8.0] {
        let per_px = 1.0 / zoom;
        let drawn = floats(&cached.at(per_px));
        let expected = floats(&fresh(per_px));

        assert_eq!(drawn.len(), expected.len());
        assert!(drawn.iter().zip(&expected).all(|(a, b)| (a - b).abs() <= SLACK * b.abs().max(1.0)), "zoom {zoom}");
    }
    assert_eq!(cached.encodes(), built);
}
