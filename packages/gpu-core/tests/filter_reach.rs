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

#[test]
fn an_svg_filter_with_its_own_region_reaches_the_whole_frame() {
    let wide = filters(r#"[{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "id": "w", "width": "300%" }, "children": [] }] }]"#);

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
