use gpu_core::held_parts::{Freshness, Parts, Seen};
use gpu_core::held_view::HeldView;
use gpu_core::retained::Camera;

const SCREEN: (u32, u32) = (1000, 600);

fn at(x: f64, y: f64, zoom: f64) -> Camera {
    Camera { x, y, zoom }
}

fn seen(on_screen: &[&str], near: &[&str]) -> Seen {
    Seen { on_screen: on_screen.iter().map(|s| s.to_string()).collect(), near: near.iter().map(|s| s.to_string()).collect() }
}

#[test]
fn a_view_is_fresh_near_where_it_was_built_and_stale_before_it_is_gone() {
    let view = HeldView::around(at(0.0, 0.0, 1.0), SCREEN);

    assert_eq!(Freshness::of(&view, at(-20.0, 10.0, 1.05), SCREEN), Freshness::Fresh);
    assert_eq!(Freshness::of(&view, at(0.0, 0.0, 1.35), SCREEN), Freshness::Stale);
    assert_eq!(Freshness::of(&view, at(-200.0, 0.0, 1.0), SCREEN), Freshness::Stale);
    assert_eq!(Freshness::of(&view, at(0.0, 0.0, 1.6), SCREEN), Freshness::Gone);
}

#[test]
fn a_page_on_screen_without_a_usable_scene_must_be_built_this_frame() {
    let mut parts: Parts<()> = Parts::default();
    parts.put("a", HeldView::around(at(0.0, 0.0, 1.0), SCREEN), (), 0);

    let work = parts.work(&seen(&["a", "b"], &[]), at(0.0, 0.0, 1.7), SCREEN, 0);

    assert_eq!(work.now, vec!["a".to_string(), "b".to_string()]);
    assert!(work.later.is_empty());
}

#[test]
fn a_stale_page_keeps_drawing_and_is_rebuilt_later_on_screen_first() {
    let mut parts: Parts<()> = Parts::default();
    let built = HeldView::around(at(0.0, 0.0, 1.0), SCREEN);
    parts.put("a", built, (), 0);
    parts.put("b", built, (), 0);

    let work = parts.work(&seen(&["b"], &["a", "c"]), at(0.0, 0.0, 1.35), SCREEN, 0);

    assert!(work.now.is_empty());
    assert_eq!(work.later, vec!["b".to_string(), "a".to_string(), "c".to_string()]);
}

#[test]
fn a_fresh_page_needs_no_work_and_a_far_page_is_let_go() {
    let mut parts: Parts<u8> = Parts::default();
    let built = HeldView::around(at(0.0, 0.0, 1.0), SCREEN);
    parts.put("a", built, 1, 0);
    parts.put("far", built, 2, 0);

    let work = parts.work(&seen(&["a"], &[]), at(0.0, 0.0, 1.0), SCREEN, 0);

    assert!(work.now.is_empty() && work.later.is_empty());
    assert_eq!(work.gone, vec![2]);
    assert_eq!(parts.drawn(&seen(&["a"], &[])).len(), 1);
}

#[test]
fn a_margin_scene_splits_into_pages_on_screen_near_and_loose_items() {
    use gpu_core::held_parts::{pages_of, LOOSE};
    let list = gpu_core::display_list::parse(
        r#"{ "width": 1500, "height": 900, "background": null, "items": [
      { "kind": "use", "clip": "u1", "group": "a", "matrix": [1, 0, 0, 1, 300, 200], "cache": true },
      { "kind": "use", "clip": "u2", "group": "b", "matrix": [1, 0, 0, 1, 20, 20], "cache": true },
      { "kind": "path", "clip": "dot", "contours": [[0, 0, 4, 0, 4, 4]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 700, 400], "blend": "normal" } ] }"#,
    )
    .unwrap();
    let screen = vello::kurbo::Rect::new(250.0, 150.0, 1250.0, 750.0);

    let (seen, pages) = pages_of(&list, |_| Some((100.0, 100.0)), screen);

    assert_eq!(seen.on_screen, vec!["a".to_string(), LOOSE.to_string()]);
    assert_eq!(seen.near, vec!["b".to_string()]);
    assert_eq!(pages.len(), 3);
    assert_eq!(pages[LOOSE].len(), 1);
}

#[test]
fn a_content_change_makes_every_page_unusable() {
    let mut parts: Parts<u8> = Parts::default();
    parts.put("a", HeldView::around(at(0.0, 0.0, 1.0), SCREEN), 1, 0);

    let work = parts.work(&seen(&["a"], &[]), at(0.0, 0.0, 1.0), SCREEN, 1);

    assert_eq!(work.now, vec!["a".to_string()]);
    assert_eq!(work.gone, vec![1]);
}
