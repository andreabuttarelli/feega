use gpu_core::canvas::Canvas;
use gpu_core::display_list::{parse, Paint, Size};
use gpu_core::scene::{build_into, Layers, Shelf};
use vello::kurbo::{Affine, BezPath, Rect, Shape};
use vello::peniko::{Fill, Mix};

#[derive(Default)]
struct Recording {
    fills: Vec<(Fill, f64)>,
}

impl Canvas for Recording {
    type Picture = ();

    fn size(_: &()) -> Size {
        Size { width: 1.0, height: 1.0 }
    }

    fn fill_plain(&mut self, rule: Fill, _: Affine, _: &Paint, shape: &BezPath) {
        self.fills.push((rule, shape.area()));
    }

    fn picture(&mut self, _: Affine, _: &(), _: Affine, _: Rect) {}

    fn push_layer(&mut self, _: Mix, _: f32, _: Rect) {}

    fn push_clip(&mut self, _: Fill, _: Affine, _: &BezPath) {}

    fn pop(&mut self) {}

    fn shade(&mut self, _: Affine, _: &gpu_core::shades::Shade) {}
}

#[test]
fn a_stroke_union_is_one_fill_so_overlapping_bands_leave_no_seams() {
    let list = parse(
        r#"{ "width": 64, "height": 64, "background": null, "items": [
  { "kind": "path", "clip": "pen", "contours": [[0, 0, 40, 0, 40, 10, 0, 10], [30, 10, 40, 10, 40, 0, 30, 0]], "rule": "union",
    "paint": { "kind": "solid", "color": [1, 1, 1, 0.5] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#,
    )
    .unwrap();
    let mut canvas = Recording::default();

    build_into(&mut canvas, &list, &Shelf::new(), &Layers::new());

    assert_eq!(canvas.fills.len(), 1);
    assert_eq!(canvas.fills[0].0, Fill::NonZero);
    assert!((canvas.fills[0].1.abs() - 500.0).abs() < 1e-6, "every band winds the same way: area {}", canvas.fills[0].1);
}
