use gpu_core::overlay_hold::OverlayHold;
use gpu_core::retained::Camera;
use vello::kurbo::{Affine, Point};

const SCREEN: (u32, u32) = (4000, 2000);

fn at(x: f64, y: f64, zoom: f64) -> Camera {
    Camera { x, y, zoom }
}

#[test]
fn a_held_overlay_serves_a_pan_inside_its_margin() {
    let hold = OverlayHold::around(at(0.0, 0.0, 1.0), SCREEN, 8192);

    assert!(hold.serves(at(-200.0, 100.0, 1.0), SCREEN));
}

#[test]
fn any_zoom_redraws_the_overlay_because_its_chrome_keeps_a_screen_size() {
    let hold = OverlayHold::around(at(0.0, 0.0, 1.0), SCREEN, 8192);

    assert!(!hold.serves(at(-100.0, -50.0, 1.01), SCREEN));
}

#[test]
fn a_held_overlay_is_redrawn_past_its_margin_or_past_the_sharp_stretch() {
    let hold = OverlayHold::around(at(0.0, 0.0, 1.0), SCREEN, 8192);

    assert!(!hold.serves(at(-2000.0, 0.0, 1.0), SCREEN));
    assert!(!hold.serves(at(0.0, 0.0, 1.3), SCREEN));
    assert!(!hold.serves(at(0.0, 0.0, 0.7), SCREEN));
}

#[test]
fn the_held_overlay_lands_where_the_camera_puts_the_world() {
    let hold = OverlayHold::around(at(10.0, 20.0, 1.0), SCREEN, 8192);
    let now = at(-30.0, 45.0, 1.1);
    let world = Point::new(300.0, 200.0);
    let in_held = Affine::new(hold.planned().0.matrix()) * world;

    let look = hold.look(now);
    let on_screen = Point::new((in_held.x - look.x) / look.scale, (in_held.y - look.y) / look.scale);

    assert!((on_screen - Affine::new(now.matrix()) * world).hypot() < 1e-6);
}

#[test]
fn the_held_overlay_never_exceeds_the_device_texture_limit() {
    let hold = OverlayHold::around(at(0.0, 0.0, 1.0), (4400, 2200), 4096);
    let (_, size) = hold.planned();

    assert!(size.0 <= 4096 && size.1 <= 4096);
}

#[test]
fn a_zooming_camera_draws_a_half_resolution_overlay_that_still_lands_on_the_world_and_rest_redraws_it_sharp() {
    use gpu_core::overlay_hold::{Moving, OverlayQuality};
    let rough = OverlayQuality::of(Moving::Camera);
    let hold = OverlayHold::around_at(at(10.0, 20.0, 1.0), SCREEN, 8192, rough);
    let (_, size) = hold.planned();
    let world = Point::new(300.0, 200.0);
    let in_held = Affine::new(hold.planned().0.matrix()) * world;

    let look = hold.look(at(10.0, 20.0, 1.0));
    let on_screen = Point::new((in_held.x - look.x) / look.scale, (in_held.y - look.y) / look.scale);

    assert!(size.0 <= SCREEN.0 * 3 / 4);
    assert!((on_screen - Affine::new(at(10.0, 20.0, 1.0).matrix()) * world).hypot() < 1e-6);
    assert!(hold.serves(at(-200.0, 100.0, 1.0), SCREEN));
    assert_eq!(OverlayQuality::of(Moving::Still), OverlayQuality::Sharp);
    assert_eq!(OverlayQuality::of(Moving::Lift), OverlayQuality::Sharp);
    assert_ne!(hold.quality(), OverlayQuality::Sharp);
}
