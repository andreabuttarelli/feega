use gpu_core::display_list::{parse, DisplayList};
use gpu_core::groups::{Library, Limits};

const BARS: &str = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [
  { "kind": "path", "clip": "bar", "contours": [[10, 10, 20, 10, 20, 20, 10, 20]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#;

const BLURRED: &str = r#"{ "width": 100, "height": 50, "background": null, "items": [
  { "kind": "path", "clip": "bar", "contours": [[10, 10, 20, 10, 20, 20, 10, 20]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 3, "blend": "normal" } ] }"#;

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };

fn screen(group: &str, scale: f64, x: f64, cache: bool) -> DisplayList {
    parse(&format!(
        r#"{{ "width": 800, "height": 600, "background": null, "items": [
      {{ "kind": "use", "clip": "{group}", "group": "{group}", "matrix": [{scale}, 0, 0, {scale}, {x}, 0.4], "cache": {cache} }}] }}"#
    ))
    .unwrap()
}

fn composing(groups: &[(&str, &str)]) -> Library {
    let mut library = Library::new();
    library.compose_encodings();
    for (key, list) in groups {
        library.put_group(key, &parse(list).unwrap());
    }
    library
}

fn kinds(list: &DisplayList) -> Vec<&str> {
    list.items.iter().map(|i| i.kind()).collect()
}

#[test]
fn a_vector_group_reaches_the_screen_as_one_use_even_when_asked_to_cache() {
    let mut lib = composing(&[("a", BARS)]);

    let plan = lib.plan(&screen("a", 2.0, 10.0, true), LIMITS);

    assert_eq!(kinds(&plan.screen), vec!["use"]);
    assert_eq!(plan.screen.fragments.len(), 1);
    assert!(plan.rasters.is_empty());
}

#[test]
fn the_encoding_survives_a_zoom_and_dies_with_an_edit() {
    let mut lib = composing(&[("a", BARS)]);
    let first = lib.plan(&screen("a", 1.0, 0.0, false), LIMITS).screen.fragments;

    let zoomed = lib.plan(&screen("a", 3.0, 0.0, false), LIMITS).screen.fragments;
    assert!(std::ptr::eq(first.get("a").unwrap(), zoomed.get("a").unwrap()));

    lib.put_group("a", &parse(BARS).unwrap());
    let edited = lib.plan(&screen("a", 3.0, 0.0, false), LIMITS).screen.fragments;
    assert!(!std::ptr::eq(first.get("a").unwrap(), edited.get("a").unwrap()));
}

#[test]
fn a_group_that_needs_a_layer_is_expanded_not_composed() {
    let mut lib = composing(&[("a", BLURRED)]);

    let plan = lib.plan(&screen("a", 1.0, 0.0, false), LIMITS);

    assert_eq!(kinds(&plan.screen), vec!["path"]);
    assert!(plan.screen.fragments.is_empty());
}

#[test]
fn a_library_that_does_not_compose_expands_every_group() {
    let mut lib = Library::new();
    lib.put_group("a", &parse(BARS).unwrap());

    let plan = lib.plan(&screen("a", 1.0, 0.0, false), LIMITS);

    assert_eq!(kinds(&plan.screen), vec!["path", "path"]);
}

#[cfg(feature = "gpu")]
#[test]
fn composing_the_encoding_paints_the_same_pixels_as_expanding_the_group() {
    use gpu_core::pictures::Pictures;
    use gpu_core::render::Renderer;

    let paint = |compose: bool| {
        let mut renderer = Renderer::new().expect("a GPU adapter");
        if compose {
            renderer.compose_encodings();
        }
        renderer.put_group("a", parse(BARS).unwrap());
        renderer.render(&screen("a", 3.0, 20.0, false), &Pictures::new()).unwrap().pixels
    };

    assert!(paint(true) == paint(false));
}
