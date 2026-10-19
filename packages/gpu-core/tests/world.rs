use gpu_core::display_list::Item;
use gpu_core::retained::Damage;
use gpu_core::world::{parse_overlay, parse_patch, World};
use vello::kurbo::Rect;

const SIZE: Option<(f64, f64)> = Some((100.0, 50.0));

fn sized(_: &str) -> Option<(f64, f64)> {
    SIZE
}

fn put(clip: &str, x: f64) -> String {
    format!(r#"{{ "put": [{{ "kind": "use", "clip": "{clip}", "group": "g:{clip}", "matrix": [1, 0, 0, 1, {x}, 0] }}], "drop": [] }}"#)
}

fn rects(d: Damage) -> Vec<Rect> {
    match d {
        Damage::Rects(r) => r,
        Damage::All => panic!("bounded damage"),
    }
}

fn clips(w: &World) -> Vec<String> {
    w.screen([1.0, 0.0, 0.0, 1.0, 0.0, 0.0], 10, 10).items.iter().map(|i| i.clip().to_string()).collect()
}

#[test]
fn a_new_use_damages_its_bounds() {
    let mut w = World::new();

    w.patch(parse_patch(&put("a", 10.0)).unwrap(), sized);

    assert_eq!(rects(w.take_damage()), vec![Rect::new(10.0, 0.0, 110.0, 50.0)]);
    assert_eq!(rects(w.take_damage()), vec![]);
}

#[test]
fn a_moved_use_damages_where_it_was_and_where_it_is() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.take_damage();

    w.patch(parse_patch(&put("a", 300.0)).unwrap(), sized);

    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0), Rect::new(300.0, 0.0, 400.0, 50.0)]);
    assert_eq!(clips(&w), vec!["a"]);
}

#[test]
fn a_dropped_use_damages_its_old_bounds_and_leaves_the_scene() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.take_damage();

    w.patch(parse_patch(r#"{ "put": [], "drop": ["a"] }"#).unwrap(), sized);

    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0)]);
    assert!(clips(&w).is_empty());
}

#[test]
fn an_order_puts_the_uses_in_that_stacking() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&put("b", 0.0)).unwrap(), sized);

    w.patch(parse_patch(r#"{ "put": [], "drop": [], "order": ["b", "a"] }"#).unwrap(), sized);

    assert_eq!(clips(&w), vec!["b", "a"]);
}

#[test]
fn a_changed_group_damages_every_use_of_it() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.take_damage();

    w.touch("g:a", SIZE);

    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0)]);
}

#[test]
fn the_overlay_damages_its_old_and_new_bounds() {
    let mut w = World::new();
    let ring = |x: f64| format!(r#"[{{ "kind": "path", "clip": "sel", "contours": [[{x}, 0, {}, 0, {}, 10, {x}, 10]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0, 0, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }}]"#, x + 10.0, x + 10.0);
    w.set_overlay(parse_overlay(&ring(0.0)).unwrap());
    w.take_damage();

    w.set_overlay(parse_overlay(&ring(50.0)).unwrap());

    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 10.0, 10.0), Rect::new(50.0, 0.0, 60.0, 10.0)]);
}

#[test]
fn the_screen_list_puts_every_use_and_the_overlay_through_the_camera() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 10.0)).unwrap(), sized);

    let screen = w.screen([2.0, 0.0, 0.0, 2.0, 5.0, 7.0], 640, 480);

    let Item::Use(u) = &screen.items[0] else { panic!("a use") };
    assert_eq!(u.matrix, [2.0, 0.0, 0.0, 2.0, 25.0, 7.0]);
    assert_eq!((screen.width, screen.height), (640, 480));
}
