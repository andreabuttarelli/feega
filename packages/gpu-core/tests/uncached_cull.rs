use gpu_core::display_list::parse;
use gpu_core::groups::{Library, Limits};

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };

fn masked_square(at: f64) -> String {
    let (x0, x1) = (at, at + 20.0);
    format!(
        r#"{{ "kind": "path", "clip": "sq{at}", "contours": [[{x0}, 10, {x1}, 10, {x1}, 30, {x0}, 30]], "rule": "nonzero",
  "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "blur": 0,
  "masks": [{{ "mode": "add", "invert": false, "level": 1, "feather": 2,
  "cover": {{ "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [200, 0, 0, 200, {at}, 0] }} }}] }}"#
    )
}

fn library_with(positions: &[f64]) -> Library {
    let items: Vec<String> = positions.iter().map(|at| masked_square(*at)).collect();
    let group = parse(&format!(r#"{{ "width": 6000, "height": 100, "background": null, "items": [{}] }}"#, items.join(","))).unwrap();
    let mut library = Library::new();
    library.compose_encodings();
    library.put_group("a", &group);
    library
}

fn screen_at(x: f64) -> gpu_core::display_list::DisplayList {
    parse(&format!(r#"{{ "width": 100, "height": 100, "background": null, "items": [{{ "kind": "use", "clip": "a", "group": "a", "matrix": [1, 0, 0, 1, {x}, 0], "cache": false }}] }}"#)).unwrap()
}

#[test]
fn an_uncached_group_hands_on_only_the_items_that_reach_the_screen() {
    let mut library = library_with(&[10.0, 40.0, 3000.0, 5000.0]);

    let plan = library.plan(&screen_at(0.0), LIMITS);

    assert_eq!(plan.screen.items.len(), 2);
}

#[test]
fn panning_the_group_brings_the_far_items_in() {
    let mut library = library_with(&[10.0, 40.0, 3000.0, 5000.0]);

    let plan = library.plan(&screen_at(-2990.0), LIMITS);

    assert_eq!(plan.screen.items.len(), 1);
}
