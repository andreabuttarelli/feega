use gpu_core::canvas::Canvas;
use gpu_core::display_list::{parse, DisplayList, Paint, Size};
use gpu_core::scene::{build_into, needs_layer, Layers, Shelf};
use vello::kurbo::{Affine, BezPath, Rect};
use vello::peniko::{Fill, Mix};

#[derive(Default)]
struct Counting {
    clips: usize,
    pops: usize,
    fills: usize,
}

impl Canvas for Counting {
    type Picture = ();

    fn size(_: &()) -> Size {
        Size { width: 1.0, height: 1.0 }
    }

    fn fill_plain(&mut self, _: Fill, _: Affine, _: &Paint, _: &BezPath) {
        self.fills += 1;
    }

    fn picture(&mut self, _: Affine, _: &(), _: Affine, _: Rect) {}

    fn push_layer(&mut self, _: Mix, _: f32, _: Rect) {}

    fn push_clip(&mut self, _: Fill, _: Affine, _: &BezPath) {
        self.clips += 1;
    }

    fn pop(&mut self) {
        self.pops += 1;
    }
}

fn mask(mode: &str, extra: &str) -> String {
    format!(
        r#"{{ "mode": "{mode}", "invert": false, "level": 1, "feather": 0{extra},
  "cover": {{ "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [16, 0, 0, 64, 16, 0] }} }}"#
    )
}

fn list_with(masks: &[String], extra: &str) -> DisplayList {
    parse(&format!(
        r#"{{ "width": 64, "height": 64, "background": null, "items": [
  {{ "kind": "path", "clip": "sq", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
    "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
    "masks": [{}]{extra} }} ] }}"#,
        masks.join(",")
    ))
    .unwrap()
}

fn layered(list: &DisplayList) -> bool {
    needs_layer(list.items[0].look().unwrap())
}

#[test]
fn hard_path_masks_that_intersect_are_clips_not_layers() {
    assert!(!layered(&list_with(&[mask("intersect", "")], "")));
    assert!(!layered(&list_with(&[mask("add", ""), mask("intersect", "")], "")));
    assert!(!layered(&list_with(&[mask("intersect", ""), mask("intersect", "")], "")));
}

#[test]
fn anything_softer_or_stranger_is_still_a_layer() {
    assert!(layered(&list_with(&[mask("subtract", "")], "")));
    assert!(layered(&list_with(&[mask("intersect", ""), mask("add", "")], "")));
    assert!(layered(&list_with(&[mask("intersect", r#", "invert": true"#)], "")));
    assert!(layered(&list_with(&[mask("intersect", "").replace(r#""feather": 0"#, r#""feather": 2"#)], "")));
    assert!(layered(&list_with(&[mask("intersect", "").replace(r#""level": 1"#, r#""level": 0.5"#)], "")));
    assert!(layered(&list_with(&[mask("intersect", "")], r#", "blur": 2"#)));
    assert!(layered(&list_with(&[mask("intersect", "")], r#", "backdrop": 4"#)));
}

#[test]
fn a_clip_mask_draws_inside_balanced_clips_and_skips_nothing() {
    let list = list_with(&[mask("intersect", ""), mask("intersect", "")], "");
    let mut canvas = Counting::default();

    let skipped = build_into(&mut canvas, &list, &Shelf::new(), &Layers::new());

    assert!(skipped.is_empty());
    assert_eq!(canvas.fills, 1);
    assert_eq!(canvas.clips, 2);
    assert_eq!(canvas.pops, 2);
}

#[cfg(feature = "gpu")]
mod pixels {
    use super::*;
    use gpu_core::pictures::Pictures;

    const SIDE: usize = 64;
    const EDGE_TOLERANCE: i32 = 40;
    const EDGE_PIXELS_ALLOWED: usize = 12;

    fn render(list: &DisplayList) -> Vec<u8> {
        gpu_core::render::Renderer::new().expect("a GPU adapter").render(list, &Pictures::new()).unwrap().pixels
    }

    fn triangle(masks: &[String]) -> DisplayList {
        let json = format!(
            r#"{{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [
  {{ "kind": "path", "clip": "sq", "contours": [[2, 2, 62, 2, 2, 62]], "rule": "nonzero",
    "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
    "masks": [{}] }} ] }}"#,
            masks.join(",")
        );
        parse(&json).unwrap()
    }

    fn slanted(feather: &str) -> String {
        format!(
            r#"{{ "mode": "intersect", "invert": false, "level": 1, "feather": {feather},
  "cover": {{ "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [30, 12, -12, 30, 12, 8] }} }}"#
        )
    }

    #[test]
    fn a_clip_paints_what_the_masking_layer_painted() {
        let as_clip = render(&triangle(&[slanted("0")]));
        let as_layer = render(&triangle(&[slanted("0.0001")]));

        let off: Vec<_> = as_clip.chunks(4).zip(as_layer.chunks(4)).filter(|(a, b)| (a[0] as i32 - b[0] as i32).abs() > EDGE_TOLERANCE).collect();
        assert_eq!(as_clip.len(), SIDE * SIDE * 4);
        assert!(off.len() <= EDGE_PIXELS_ALLOWED, "{} pixels differ", off.len());
    }
}
