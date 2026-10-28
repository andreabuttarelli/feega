use gpu_core::display_list::{parse, DisplayList, Item};
use gpu_core::groups::{Library, Limits, Motion};

const FRAME: &str = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [
  { "kind": "path", "clip": "card", "contours": [[10, 10, 20, 10, 20, 20, 10, 20]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#;

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };
const MANY: Limits = Limits { side: 4096, rasters: 8, items: 1000 };
const FRAME_BYTES: u64 = 100 * 50 * 4;

fn screen(uses: &[(&str, f64, f64)]) -> DisplayList {
    let items: Vec<String> = uses.iter().map(|(g, s, x)| format!(r#"{{ "kind": "use", "clip": "{g}", "group": "{g}", "matrix": [{s}, 0, 0, {s}, {x}, 0.4], "cache": true }}"#)).collect();
    parse(&format!(r#"{{ "width": 800, "height": 600, "background": null, "items": [{}] }}"#, items.join(","))).unwrap()
}

fn library(groups: &[&str]) -> Library {
    let mut library = Library::new();
    for g in groups {
        library.put_group(g, &parse(FRAME).unwrap());
    }
    library
}

fn width_shown(list: &DisplayList, at: usize) -> f64 {
    let Item::Image(image) = &list.items[at] else { panic!("not a texture") };
    image.size.width
}

#[test]
fn a_zoom_out_during_a_gesture_keeps_the_sharper_texture() {
    let mut lib = library(&["a"]);
    lib.plan(&screen(&[("a", 2.0, 0.0)]), LIMITS);
    lib.set_motion(Motion::Gesture);

    let out = lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    assert!(out.rasters.is_empty());
    assert_eq!(width_shown(&out.screen, 0), 200.0);
}

#[test]
fn a_zoom_out_at_rest_re_rasters_at_the_new_scale() {
    let mut lib = library(&["a"]);
    lib.plan(&screen(&[("a", 2.0, 0.0)]), LIMITS);
    lib.set_motion(Motion::Gesture);
    lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);
    lib.set_motion(Motion::Still);

    let rest = lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    assert_eq!(rest.rasters.len(), 1);
}

#[test]
fn a_zoom_in_during_a_gesture_re_rasters_only_the_group_nearest_the_centre() {
    let mut lib = library(&["edge", "centre", "off"]);
    lib.plan(&screen(&[("edge", 1.0, 0.0), ("centre", 1.0, 350.0), ("off", 1.0, 900.0)]), MANY);
    lib.set_motion(Motion::Gesture);

    let zoomed = lib.plan(&screen(&[("edge", 1.5, 0.0), ("centre", 1.5, 330.0), ("off", 1.5, 900.0)]), MANY);

    assert_eq!(zoomed.rasters.len(), 1);
    assert!(zoomed.rasters[0].list.width > 150);
    assert!(width_shown(&zoomed.screen, 1) > 150.0);
    assert_eq!(width_shown(&zoomed.screen, 0), 100.0);
}

#[test]
fn over_budget_the_texture_farthest_off_screen_goes_first() {
    let mut lib = library(&["on", "near", "far"]);
    lib.plan(&screen(&[("on", 1.0, 0.0), ("near", 1.0, 900.0), ("far", 1.0, 20000.0)]), MANY);
    lib.set_budget(2 * FRAME_BYTES);

    let next = lib.plan(&screen(&[("on", 1.0, 0.0), ("near", 1.0, 900.0), ("far", 1.0, 20000.0)]), MANY);

    assert_eq!(next.evicted, vec!["cache:far".to_string()]);
    assert_eq!(lib.cache_bytes(), 2 * FRAME_BYTES);
}
