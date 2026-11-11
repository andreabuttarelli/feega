use std::f64::consts::FRAC_PI_2;

use gpu_core::display_list::{parse, Item};
use gpu_core::shades::{shade_of, Side};

const ARC_STEPS: usize = 6;

fn rounded(x: f64, y: f64, w: f64, h: f64, r: f64) -> Vec<f64> {
    let corners = [(x + w - r, y + r, -FRAC_PI_2), (x + w - r, y + h - r, 0.0), (x + r, y + h - r, FRAC_PI_2), (x + r, y + r, 2.0 * FRAC_PI_2)];
    corners
        .iter()
        .flat_map(|&(cx, cy, from)| (0..=ARC_STEPS).flat_map(move |i| {
            let a = from + FRAC_PI_2 * i as f64 / ARC_STEPS as f64;
            [cx + r * a.cos(), cy + r * a.sin()]
        }))
        .collect()
}

fn numbers(points: &[f64]) -> String {
    points.iter().map(|v| format!("{v:.4}")).collect::<Vec<_>>().join(", ")
}

fn outer(contour: &[f64], fns: &str, matrix: &str) -> String {
    format!(
        r#"{{ "width": 160, "height": 120, "background": [1, 1, 1, 1], "items": [
  {{ "kind": "path", "clip": "s", "contours": [[{}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0, 0, 0, 0.4] }},
    "opacity": 1, "matrix": {matrix}, "blend": "normal", "space": [1, 0, 0, 1], "filters": [{{ "kind": "css", "fns": [{fns}] }}] }}
]}}"#,
        numbers(contour)
    )
}

fn inner(fns: &str) -> String {
    let around = [-30.0, -30.0, 180.0, -30.0, 180.0, 140.0, -30.0, 140.0];
    let hole = rounded(30.0, 26.0, 100.0, 64.0, 6.0);
    let shape = rounded(20.0, 20.0, 110.0, 70.0, 10.0);
    format!(
        r#"{{ "width": 160, "height": 120, "background": [1, 1, 1, 1], "items": [
  {{ "kind": "path", "clip": "b", "contours": [[{shape}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0.9, 0.95, 1, 1] }},
    "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }},
  {{ "kind": "path", "clip": "s", "contours": [[{}], [{}]], "rule": "evenodd", "paint": {{ "kind": "solid", "color": [0, 0, 0.3, 0.5] }},
    "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "space": [1, 0, 0, 1], "filters": [{{ "kind": "css", "fns": [{fns}] }}],
    "masks": [{{ "mode": "intersect", "invert": false, "level": 1, "feather": 0, "cover": {{ "kind": "path", "contours": [[{shape}]], "matrix": [1, 0, 0, 1, 0, 0] }} }}] }}
]}}"#,
        numbers(&around),
        numbers(&hole),
        shape = numbers(&shape)
    )
}

const BLUR: &str = r#"{ "name": "blur", "args": ["6px"] }"#;
const BLUR_AND_NOOP: &str = r#"{ "name": "blur", "args": ["6px"] }, { "name": "brightness", "args": ["1"] }"#;
const IDENTITY: &str = "[1, 0, 0, 1, 0, 0]";
const DROP: &str = r#"{ "name": "drop-shadow", "args": ["4px", "6px", "12px", "rgba(0, 0, 0, 0.35)"] }"#;
const DROP_AND_NOOP: &str = r#"{ "name": "drop-shadow", "args": ["4px", "6px", "12px", "rgba(0, 0, 0, 0.35)"] }, { "name": "brightness", "args": ["1"] }"#;
const HARD_CLIP: &str = r#"[{ "mode": "intersect", "invert": false, "level": 1, "feather": 0, "cover": { "kind": "path", "contours": [[0, 0, 150, 0, 150, 100, 0, 100]], "matrix": [1, 0, 0, 1, 0, 0] } }]"#;

fn body(fns: &str, masks: &str) -> String {
    format!(
        r#"{{ "width": 160, "height": 120, "background": [1, 1, 1, 1], "items": [
  {{ "kind": "path", "clip": "s", "contours": [[{}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0.2, 0.5, 0.9, 1] }},
    "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "space": [1, 0, 0, 1], "filters": [{{ "kind": "css", "fns": [{fns}] }}], "masks": {masks} }}
]}}"#,
        numbers(&rounded(30.0, 20.0, 90.0, 60.0, 10.0))
    )
}

fn last(json: &str) -> Item {
    parse(json).unwrap().items.pop().unwrap()
}

#[test]
fn a_blurred_rounded_rect_is_an_outer_shade() {
    let shade = shade_of(&last(&outer(&rounded(30.0, 20.0, 100.0, 70.0, 12.0), BLUR, IDENTITY))).expect("a shade");

    assert_eq!(shade.side, Side::Outer);
    assert!((shade.rect.x0 - 30.0).abs() < 1e-3 && (shade.rect.y1 - 90.0).abs() < 1e-3);
    assert!((shade.radius - 12.0).abs() < 1e-3);
    assert!((shade.sigma - 6.0).abs() < 1e-9);
}

#[test]
fn a_blurred_plain_rect_is_an_outer_shade_with_no_radius() {
    let shade = shade_of(&last(&outer(&[30.0, 20.0, 130.0, 20.0, 130.0, 90.0, 30.0, 90.0], BLUR, IDENTITY))).expect("a shade");

    assert_eq!(shade.radius, 0.0);
}

#[test]
fn the_sigma_is_measured_in_the_items_own_units() {
    let shade = shade_of(&last(&outer(&rounded(0.0, 0.0, 50.0, 30.0, 4.0), BLUR, "[2, 0, 0, 2, 10, 10]"))).expect("a shade");

    assert!((shade.sigma - 3.0).abs() < 1e-9);
}

#[test]
fn an_inset_box_shadow_is_an_inner_shade_of_its_hole() {
    let shade = shade_of(&last(&inner(BLUR))).expect("a shade");

    assert_eq!(shade.side, Side::Inner);
    assert!((shade.rect.x0 - 30.0).abs() < 1e-3 && (shade.rect.x1 - 130.0).abs() < 1e-3);
    assert!((shade.radius - 6.0).abs() < 1e-3);
}

#[test]
fn an_opaque_rounded_rect_with_a_drop_shadow_casts_a_shade_behind_it() {
    let shade = shade_of(&last(&body(DROP, "null"))).expect("a shade");

    assert_eq!(shade.side, Side::Behind);
    assert!((shade.rect.x0 - 34.0).abs() < 1e-3 && (shade.rect.y0 - 26.0).abs() < 1e-3);
    assert!((shade.sigma - 6.0).abs() < 1e-9);
    assert_eq!(shade.color, [0.0, 0.0, 0.0, 0.35]);
}

#[test]
fn a_hard_clip_keeps_a_shadow_analytic() {
    assert!(shade_of(&last(&body(DROP, HARD_CLIP))).is_some());
    assert!(shade_of(&last(&outer(&rounded(0.0, 0.0, 50.0, 30.0, 4.0), BLUR, "[1.3, 0, 0, 1.31, 10, 10]"))).is_some());
}

#[test]
fn a_rect_narrower_than_its_blur_stays_on_the_filter_path() {
    let bar = [60.0, 8.0, 68.0, 8.0, 68.0, 120.0, 60.0, 120.0];

    assert!(shade_of(&last(&outer(&bar, r#"{ "name": "blur", "args": ["2px"] }"#, IDENTITY))).is_none());
}

#[test]
fn other_shapes_and_filters_stay_on_the_filter_path() {
    let triangle = [30.0, 20.0, 130.0, 20.0, 30.0, 90.0];
    let mut uneven = rounded(30.0, 20.0, 100.0, 70.0, 12.0);
    uneven.truncate(uneven.len() - 2 * (ARC_STEPS + 1));
    uneven.extend([30.0, 90.0, 30.0, 20.0]);

    assert!(shade_of(&last(&outer(&triangle, BLUR, IDENTITY))).is_none());
    assert!(shade_of(&last(&body(DROP, "null").replace("0.9, 1]", "0.9, 0.5]"))).is_none());
    assert!(shade_of(&last(&outer(&uneven, BLUR, IDENTITY))).is_none());
    assert!(shade_of(&last(&outer(&rounded(30.0, 20.0, 100.0, 70.0, 12.0), BLUR_AND_NOOP, IDENTITY))).is_none());
    assert!(shade_of(&last(&outer(&rounded(30.0, 20.0, 100.0, 70.0, 12.0), BLUR, "[1, 0.3, 0, 1, 0, 0]"))).is_none());
}

#[cfg(feature = "gpu")]
mod gpu {
    use super::*;
    use gpu_core::pictures::Pictures;
    use gpu_core::render::Renderer;

    const MAX_CHANNEL_DIFF: u8 = 3;
    const NARROW_DIFF: u8 = 4;

    fn render(json: &str) -> Vec<u8> {
        let mut renderer = Renderer::new().expect("a GPU adapter");
        renderer.render(&parse(json).unwrap(), &Pictures::new()).unwrap().pixels
    }

    fn worst(a: &[u8], b: &[u8]) -> u8 {
        a.iter().zip(b).map(|(x, y)| x.abs_diff(*y)).max().unwrap()
    }

    #[test]
    fn an_analytic_outer_shade_matches_the_filter_path() {
        let shape = rounded(30.0, 20.0, 100.0, 70.0, 12.0);
        let diff = worst(&render(&outer(&shape, BLUR, IDENTITY)), &render(&outer(&shape, BLUR_AND_NOOP, IDENTITY)));
        println!("outer max channel diff {diff}");

        assert!(diff <= MAX_CHANNEL_DIFF, "worst channel difference {diff}");
    }

    #[test]
    fn an_analytic_bar_sits_on_pixel_centres_like_the_filter_path() {
        let bar = [60.0, 8.0, 72.0, 8.0, 72.0, 120.0, 60.0, 120.0];
        let narrow = r#"{ "name": "blur", "args": ["2px"] }"#;
        let narrow_noop = r#"{ "name": "blur", "args": ["2px"] }, { "name": "brightness", "args": ["1"] }"#;
        let diff = worst(&render(&outer(&bar, narrow, IDENTITY)), &render(&outer(&bar, narrow_noop, IDENTITY)));

        println!("bar max channel diff {diff}");
        assert!(diff <= NARROW_DIFF, "worst channel difference {diff}");
    }

    #[test]
    fn an_analytic_drop_shadow_matches_the_filter_path() {
        let diff = worst(&render(&body(DROP, HARD_CLIP)), &render(&body(DROP_AND_NOOP, HARD_CLIP)));
        println!("drop-shadow max channel diff {diff}");

        assert!(diff <= MAX_CHANNEL_DIFF, "worst channel difference {diff}");
    }

    #[test]
    fn an_analytic_inner_shade_matches_the_filter_path() {
        let diff = worst(&render(&inner(BLUR)), &render(&inner(BLUR_AND_NOOP)));
        println!("inner max channel diff {diff}");

        assert!(diff <= MAX_CHANNEL_DIFF, "worst channel difference {diff}");
    }
}
