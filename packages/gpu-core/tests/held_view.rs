use gpu_core::held_view::HeldView;
use gpu_core::retained::Camera;
use vello::kurbo::{Affine, Point};

const SCREEN: (u32, u32) = (1000, 600);

fn at(x: f64, y: f64, zoom: f64) -> Camera {
    Camera { x, y, zoom }
}

#[test]
fn the_held_scene_is_planned_with_a_margin_around_the_screen() {
    let held = HeldView::around(at(10.0, 20.0, 1.0), SCREEN);
    let (camera, size) = held.planned();

    assert_eq!(size, (1500, 900));
    assert_eq!((camera.x, camera.y, camera.zoom), (260.0, 170.0, 1.0));
}

#[test]
fn a_world_point_lands_where_the_new_camera_puts_it() {
    let held = HeldView::around(at(10.0, 20.0, 1.0), SCREEN);
    let (planned, _) = held.planned();
    let now = at(-40.0, 5.0, 1.3);
    let world = Point::new(123.0, 45.0);
    let in_scene = Affine::new(planned.matrix()) * world;

    let on_screen = held.transform(now) * in_scene;
    let expected = Affine::new(now.matrix()) * world;

    assert!((on_screen - expected).hypot() < 1e-9);
}

#[test]
fn the_held_scene_serves_a_small_pan_and_zoom() {
    let held = HeldView::around(at(0.0, 0.0, 1.0), SCREEN);

    assert!(held.holds(at(-100.0, 50.0, 1.0), SCREEN));
    assert!(held.holds(at(-150.0, -90.0, 1.3), SCREEN));
}

#[test]
fn the_held_scene_is_rebuilt_past_its_margin_or_its_zoom_room() {
    let held = HeldView::around(at(0.0, 0.0, 1.0), SCREEN);

    assert!(!held.holds(at(-400.0, 0.0, 1.0), SCREEN));
    assert!(!held.holds(at(0.0, 0.0, 1.6), SCREEN));
    assert!(!held.holds(at(150.0, 90.0, 0.6), SCREEN));
}

const CARD: &str = r#"{ "width": 200, "height": 160, "background": [1, 1, 1, 1], "items": [
  { "kind": "path", "clip": "card", "contours": [[0, 0, 40, 0, 40, 30, 0, 30]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, X, 20],
    "blend": "normal", "blur": 3 } ] }"#;

#[test]
fn a_held_scene_drawn_moved_matches_the_scene_drawn_where_it_moved_to() {
    let list = |x: f64| gpu_core::display_list::parse(&CARD.replace('X', &x.to_string())).unwrap();
    let pictures = gpu_core::pictures::Pictures::default();
    let mut held = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let mut fresh = gpu_core::render::Renderer::new().expect("a GPU adapter");

    held.hold_scene(&list(30.0), &pictures).unwrap();
    let moved = held.render_held(Affine::translate((25.0, 0.0)), (200, 160)).unwrap();
    let expected = fresh.render(&list(55.0), &pictures).unwrap().pixels;
    let worst = moved.iter().zip(&expected).map(|(a, b)| a.abs_diff(*b)).max().unwrap();

    assert!(worst <= 2, "worst channel difference {worst}");
}
