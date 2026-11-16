use std::sync::Arc;

use gpu_core::compositor::Compositor;
use gpu_core::display_list::{parse, DisplayList};
use gpu_core::groups::{Library, Limits};
use gpu_core::world::{parse_overlay, OverlayPart};

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };
const BARS: usize = 200;
const GROUP: &str = "overlay:fixed";

fn bar(i: usize, red: f32) -> String {
    let x = i * 10;
    format!(r#"{{ "kind": "path", "clip": "bar{i}", "contours": [[{x}, 10, {r}, 10, {r}, 20, {x}, 20]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [{red}, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }}"#, r = x + 5)
}

fn bars(edited: Option<usize>) -> String {
    let items: Vec<String> = (0..BARS).map(|i| bar(i, if Some(i) == edited { 0.5 } else { 1.0 })).collect();
    format!("[{}]", items.join(","))
}

fn screen() -> DisplayList {
    parse(&format!(r#"{{ "width": 800, "height": 600, "background": null, "items": [{{ "kind": "use", "clip": "{GROUP}", "group": "{GROUP}", "matrix": [1, 0, 0, 1, 0, 0], "cache": false }}] }}"#)).unwrap()
}

fn composing() -> Library {
    let mut library = Library::new();
    library.compose_encodings();
    library
}

#[test]
fn an_overlay_change_keeps_the_runs_before_it() {
    let (mut c, mut lib) = (Compositor::new(800, 600), composing());
    c.set_overlay(OverlayPart::Fixed, parse_overlay(&bars(None)).unwrap(), &mut lib);
    let before = lib.plan(&screen(), LIMITS).screen.fragments;

    c.set_overlay(OverlayPart::Fixed, parse_overlay(&bars(Some(BARS - 1))).unwrap(), &mut lib);
    let after = lib.plan(&screen(), LIMITS).screen.fragments;

    let (old, new) = (before.get(GROUP).unwrap(), after.get(GROUP).unwrap());
    assert!(old.runs.len() > 1);
    assert!(Arc::ptr_eq(&old.runs[0], &new.runs[0]));
}

#[test]
fn a_patched_overlay_draws_like_one_sent_whole() {
    let (mut c, mut lib) = (Compositor::new(800, 600), composing());
    c.set_overlay(OverlayPart::Fixed, parse_overlay(&bars(None)).unwrap(), &mut lib);
    c.set_overlay(OverlayPart::Fixed, parse_overlay(&bars(Some(7))).unwrap(), &mut lib);
    let (mut c2, mut whole) = (Compositor::new(800, 600), composing());
    c2.set_overlay(OverlayPart::Fixed, parse_overlay(&bars(Some(7))).unwrap(), &mut whole);

    let (a, b) = (lib.plan(&screen(), LIMITS).screen.fragments, whole.plan(&screen(), LIMITS).screen.fragments);
    let (a, b) = (a.get(GROUP).unwrap(), b.get(GROUP).unwrap());
    assert_eq!(a.runs.len(), b.runs.len());
    for (x, y) in a.runs.iter().zip(&b.runs) {
        assert_eq!((x.bounds, x.extent, x.len), (y.bounds, y.extent, y.len));
    }
}
