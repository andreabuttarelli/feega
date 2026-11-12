use gpu_core::display_list::Item;
use gpu_core::retained::Damage;
use gpu_core::world::{parse_overlay, parse_patch, OverlayPart, World};
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
    w.screen([1.0, 0.0, 0.0, 1.0, 0.0, 0.0], 1000, 100).items.iter().map(|i| i.clip().to_string()).collect()
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
fn caching_a_use_changes_no_pixel_so_it_damages_nothing() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.take_damage();

    w.patch(parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g:a", "matrix": [1, 0, 0, 1, 0, 0], "cache": true }], "drop": [] }"#).unwrap(), sized);

    assert_eq!(rects(w.take_damage()), vec![]);
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
fn a_restack_damages_only_the_uses_that_moved_in_the_stack() {
    let mut w = World::new();
    for (clip, x) in [("a", 0.0), ("b", 200.0), ("c", 400.0)] {
        w.patch(parse_patch(&put(clip, x)).unwrap(), sized);
    }
    w.take_damage();

    w.patch(parse_patch(r#"{ "put": [], "drop": [], "order": ["a", "c", "b"] }"#).unwrap(), sized);

    assert_eq!(rects(w.take_damage()).len(), 1);
    assert_eq!(clips(&w), vec!["a", "c", "b"]);
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
    w.set_overlay(OverlayPart::Fixed, parse_overlay(&ring(0.0)).unwrap());
    w.take_damage();

    w.set_overlay(OverlayPart::Fixed, parse_overlay(&ring(50.0)).unwrap());

    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 10.0, 10.0), Rect::new(50.0, 0.0, 60.0, 10.0)]);
}

#[test]
fn an_overlay_item_that_did_not_change_damages_nothing() {
    let mut w = World::new();
    let ring = r#"{ "kind": "path", "clip": "edge", "contours": [[0, 0, 10, 0, 10, 10]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }"#;
    let hover = r#"{ "kind": "path", "clip": "hover", "contours": [[50, 0, 60, 0, 60, 10]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }"#;
    w.set_overlay(OverlayPart::Fixed, parse_overlay(&format!("[{ring}]")).unwrap());
    w.take_damage();

    w.set_overlay(OverlayPart::Fixed, parse_overlay(&format!("[{ring}, {hover}]")).unwrap());

    assert_eq!(rects(w.take_damage()), vec![Rect::new(50.0, 0.0, 60.0, 10.0)]);
}

#[test]
fn the_screen_list_puts_every_use_and_the_overlay_through_the_camera() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 10.0)).unwrap(), sized);
    w.set_overlay(OverlayPart::Fixed, parse_overlay(r#"[{ "kind": "path", "clip": "sel", "contours": [[0, 0, 1, 0, 1, 1]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }]"#).unwrap());

    let screen = w.screen([2.0, 0.0, 0.0, 2.0, 5.0, 7.0], 640, 480);

    let Item::Use(u) = &screen.items[0] else { panic!("a use") };
    assert_eq!(u.matrix, [2.0, 0.0, 0.0, 2.0, 25.0, 7.0]);
    let Item::Path(ring) = &screen.items[1] else { panic!("the overlay") };
    assert_eq!(ring.look.matrix, [2.0, 0.0, 0.0, 2.0, 5.0, 7.0]);
    assert_eq!((screen.width, screen.height), (640, 480));
}

#[test]
fn a_live_overlay_change_damages_only_the_live_items() {
    let mut w = World::new();
    let ring = r#"[{ "kind": "path", "clip": "edge", "contours": [[0, 0, 10, 0, 10, 10]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }]"#;
    let hover = |x: f64| format!(r#"[{{ "kind": "path", "clip": "hover", "contours": [[{x}, 0, {}, 0, {}, 10]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0, 0, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }}]"#, x + 10.0, x + 10.0);
    w.set_overlay(OverlayPart::Fixed, parse_overlay(ring).unwrap());
    w.set_overlay(OverlayPart::Live, parse_overlay(&hover(50.0)).unwrap());
    w.take_damage();

    w.set_overlay(OverlayPart::Live, parse_overlay(&hover(80.0)).unwrap());

    assert_eq!(rects(w.take_damage()), vec![Rect::new(50.0, 0.0, 60.0, 10.0), Rect::new(80.0, 0.0, 90.0, 10.0)]);
    assert_eq!(w.overlay_group(OverlayPart::Fixed).map(|(l, _)| l.items.len()), Some(1));
}

#[test]
fn a_tiled_canvas_takes_resting_uses_uncached_and_keeps_held_ones_as_textures() {
    let patch = gpu_core::world::parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g", "matrix": [1, 0, 0, 1, 0, 0], "cache": true, "hold": true }, { "kind": "use", "clip": "b", "group": "g", "matrix": [1, 0, 0, 1, 0, 0], "cache": true }], "drop": [] }"#).unwrap();

    let tiled = patch.for_tiles();

    assert!(tiled.put[0].cache && tiled.put[0].hold);
    assert!(!tiled.put[1].cache && !tiled.put[1].hold);
}

fn held(clip: &str, x: f64) -> String {
    format!(r#"{{ "put": [{{ "kind": "use", "clip": "{clip}", "group": "g:{clip}", "matrix": [1, 0, 0, 1, {x}, 0], "cache": true, "hold": true }}], "drop": [] }}"#)
}

const IDENTITY: [f64; 6] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

#[test]
fn holding_a_use_that_has_not_moved_leaves_it_in_the_tiles() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.take_scene_damage();

    w.patch(parse_patch(&held("a", 0.0)).unwrap(), sized);

    assert_eq!(rects(w.take_scene_damage()), vec![]);
    assert_eq!(w.scene(IDENTITY, 1000, 100).items.len(), 1);
    assert!(w.overlay(IDENTITY, 1000, 100).items.is_empty());
}

#[test]
fn a_held_use_leaves_the_tiles_once_when_it_first_moves() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&held("a", 0.0)).unwrap(), sized);
    w.take_scene_damage();

    w.patch(parse_patch(&held("a", 300.0)).unwrap(), sized);

    assert_eq!(rects(w.take_scene_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0)]);
    assert!(w.scene(IDENTITY, 1000, 100).items.is_empty());
    assert_eq!(w.lifts(sized).len(), 1);

    w.patch(parse_patch(&held("a", 600.0)).unwrap(), sized);
    assert_eq!(rects(w.take_scene_damage()), vec![]);
}

#[test]
fn a_held_use_dragged_across_the_canvas_never_damages_the_tiles() {
    let mut w = World::new();
    w.patch(parse_patch(&held("a", 0.0)).unwrap(), sized);
    w.take_scene_damage();
    w.take_damage();

    w.patch(parse_patch(&held("a", 300.0)).unwrap(), sized);

    assert_eq!(rects(w.take_scene_damage()), vec![]);
    assert_eq!(rects(w.take_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0), Rect::new(300.0, 0.0, 400.0, 50.0)]);
}

#[test]
fn letting_go_of_a_held_use_puts_it_back_into_the_tiles() {
    let mut w = World::new();
    w.patch(parse_patch(&held("a", 300.0)).unwrap(), sized);
    w.take_scene_damage();

    w.patch(parse_patch(&put("a", 300.0)).unwrap(), sized);

    assert_eq!(rects(w.take_scene_damage()), vec![Rect::new(300.0, 0.0, 400.0, 50.0)]);
    assert_eq!(w.scene(IDENTITY, 1000, 100).items.len(), 1);
}

fn overlay_clips(w: &World) -> Vec<String> {
    w.overlay(IDENTITY, 1000, 100).items.iter().map(|i| i.clip().to_string()).collect()
}

fn scene_clips(w: &World) -> Vec<String> {
    w.scene(IDENTITY, 1000, 100).items.iter().map(|i| i.clip().to_string()).collect()
}

#[test]
fn a_dragged_use_is_drawn_alone_over_the_tiles_never_cut_out_of_them() {
    let mut w = World::new();
    w.patch(parse_patch(&put("under", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&held("a", 300.0)).unwrap(), sized);
    w.patch(parse_patch(&held("fresh", 600.0)).unwrap(), sized);

    assert_eq!(overlay_clips(&w), vec!["a", "fresh"]);
    assert_eq!(scene_clips(&w), vec!["under"]);
}

#[test]
fn a_dragged_use_under_another_stays_in_the_tiles_at_its_place_in_the_stack() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&put("top", 300.0)).unwrap(), sized);
    w.take_scene_damage();

    w.patch(parse_patch(&held("a", 250.0)).unwrap(), sized);

    assert_eq!(overlay_clips(&w), Vec::<String>::new());
    assert_eq!(scene_clips(&w), vec!["a", "top"]);
    assert_eq!(rects(w.take_scene_damage()), vec![Rect::new(0.0, 0.0, 100.0, 50.0), Rect::new(250.0, 0.0, 350.0, 50.0)]);
}

#[test]
fn a_dragged_use_leaves_the_tiles_again_once_nothing_lies_over_it() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);
    w.patch(parse_patch(&put("top", 300.0)).unwrap(), sized);
    w.patch(parse_patch(&held("a", 250.0)).unwrap(), sized);
    w.take_scene_damage();

    w.patch(parse_patch(&held("a", 600.0)).unwrap(), sized);

    assert_eq!(overlay_clips(&w), vec!["a"]);
    assert_eq!(rects(w.take_scene_damage()), vec![Rect::new(250.0, 0.0, 350.0, 50.0)]);
}

#[test]
fn a_held_frame_swapping_its_picture_tier_while_dragged_is_drawn_alone() {
    let mut w = World::new();
    w.patch(parse_patch(&put("a", 0.0)).unwrap(), sized);

    w.patch(parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g:a:sharp", "matrix": [1, 0, 0, 1, 300, 0], "cache": true, "hold": true }], "drop": [] }"#).unwrap(), sized);

    assert_eq!(overlay_clips(&w), vec!["a"]);
}
