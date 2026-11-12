use gpu_core::display_list::Filter;
use gpu_core::filters::{reach, Reach};

const UNIT: [f64; 4] = [1.0, 0.0, 0.0, 1.0];

fn filters(json: &str) -> Vec<Filter> {
    serde_json::from_str(json).unwrap()
}

#[test]
fn an_svg_filter_reaches_its_default_region_a_tenth_past_the_box() {
    let soft = filters(r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "soft" }, "children": [{ "tag": "feGaussianBlur", "attrs": { "stdDeviation": "1.2" } }] }] }]"#);

    assert_eq!(reach(&soft, UNIT), Some(Reach { share: 0.1, px: 0.0 }));
}

const STROKE: &str = r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "s", "x": "-25%", "y": "-25%", "width": "150%", "height": "150%" }, "children": [
  { "tag": "feMorphology", "attrs": { "in": "SourceAlpha", "operator": "dilate", "radius": 4, "result": "grown" } },
  { "tag": "feFlood", "attrs": { "flood-color": "white", "result": "ink" } },
  { "tag": "feComposite", "attrs": { "in": "ink", "in2": "grown", "operator": "in", "result": "line" } },
  { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "line" } }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" } }] }] }] }]"#;

const SHADOW: &str = r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "d", "x": "-25%", "y": "-25%", "width": "150%", "height": "150%" }, "children": [
  { "tag": "feOffset", "attrs": { "in": "SourceAlpha", "dx": 3, "dy": -5, "result": "moved" } },
  { "tag": "feGaussianBlur", "attrs": { "in": "moved", "stdDeviation": 2, "result": "soft" } },
  { "tag": "feFlood", "attrs": { "flood-color": "black", "result": "ink" } },
  { "tag": "feComposite", "attrs": { "in": "ink", "in2": "soft", "operator": "in", "result": "shade" } },
  { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "shade" } }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" } }] }] }] }]"#;

#[test]
fn an_svg_filter_with_its_own_region_reaches_as_far_as_its_primitives_spread() {
    assert_eq!(reach(&filters(STROKE), UNIT), Some(Reach { share: 0.0, px: 4.0 }));
    assert_eq!(reach(&filters(SHADOW), [2.0, 0.0, 0.0, 2.0]), Some(Reach { share: 0.0, px: 22.0 }));
}

#[test]
fn an_svg_filter_with_its_own_region_that_floods_reaches_the_whole_frame() {
    let wide = filters(r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "w", "width": "300%" }, "children": [{ "tag": "feFlood", "attrs": { "flood-color": "red" } }] }] }]"#);

    assert_eq!(reach(&wide, UNIT), None);
}

#[test]
fn a_css_blur_reaches_three_sigmas_in_screen_pixels() {
    let blur = filters(r#"[{ "kind": "css", "fns": [{ "name": "blur", "args": ["2px"] }] }]"#);

    assert_eq!(reach(&blur, [2.0, 0.0, 0.0, 2.0]), Some(Reach { share: 0.0, px: 12.0 }));
}

#[test]
fn a_css_drop_shadow_reaches_its_offset_and_its_blur() {
    let shadow = filters(r#"[{ "kind": "css", "fns": [{ "name": "drop-shadow", "args": ["4px", "6px", "2px", "black"] }] }]"#);

    assert_eq!(reach(&shadow, UNIT), Some(Reach { share: 0.0, px: 9.0 }));
}

#[test]
fn colour_functions_reach_nothing_past_the_box_and_unknown_ones_the_whole_frame() {
    let tone = filters(r#"[{ "kind": "css", "fns": [{ "name": "grayscale", "args": ["1"] }] }]"#);
    let unknown = filters(r##"[{ "kind": "css", "fns": [{ "name": "url", "args": ["#x"] }] }]"##);

    assert_eq!(reach(&tone, UNIT), Some(Reach { share: 0.0, px: 0.0 }));
    assert_eq!(reach(&unknown, UNIT), None);
}

#[test]
fn an_svg_filter_drawing_in_frame_space_reaches_the_whole_frame() {
    let grain = filters(r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "g" }, "children": [{ "tag": "feTurbulence", "attrs": { "baseFrequency": "0.8" } }] }] }]"#);

    assert_eq!(reach(&grain, UNIT), None);
}
