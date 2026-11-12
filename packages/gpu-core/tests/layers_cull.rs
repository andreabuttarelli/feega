use gpu_core::canvas::Canvas;
use gpu_core::display_list::{parse, Rgba, Size};
use gpu_core::filter_passes::Op;
use gpu_core::filters::Runner;
use gpu_core::layers::{prepare, Blending, Surface};
use gpu_core::scene::{build_into, Placed, Shelf};
use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{Fill, Mix};

const FRAME_SIDE: u32 = 100;

struct Nothing;

impl Canvas for Nothing {
    type Picture = ();

    fn size(_: &()) -> Size {
        Size { width: 1.0, height: 1.0 }
    }

    fn fill_plain(&mut self, _: Fill, _: Affine, _: &gpu_core::display_list::Paint, _: &BezPath) {}

    fn picture(&mut self, _: Affine, _: &(), _: Affine, _: Rect) {}

    fn push_layer(&mut self, _: Mix, _: f32, _: Rect) {}

    fn push_clip(&mut self, _: Fill, _: Affine, _: &BezPath) {}

    fn pop(&mut self) {}

    fn shade(&mut self, _: Affine, _: &gpu_core::shades::Shade) {}
}

struct Flat;

impl Runner for Flat {
    type Tex = (u32, u32);

    fn run(&self, _: Op, inputs: [&(u32, u32); 2], _: &[f32], _: (u32, u32)) -> (u32, u32) {
        *inputs[0]
    }

    fn size(tex: &(u32, u32)) -> (u32, u32) {
        *tex
    }
}

#[derive(Default)]
struct Counting {
    painted: Vec<Rect>,
}

impl Surface for Counting {
    type Canvas = Nothing;
    type Runner = Flat;
    type Error = ();

    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, FRAME_SIDE as f64, FRAME_SIDE as f64)
    }

    fn paint(&mut self, _: gpu_core::tally::Reason, region: Rect, _: Option<Rgba>, _: &dyn Fn(&mut Nothing)) -> Result<(u32, u32), ()> {
        self.painted.push(region);
        Ok((region.width() as u32, region.height() as u32))
    }

    fn runner(&self) -> &Flat {
        &Flat
    }

    fn place(&mut self, _: (u32, u32), region: Rect) -> Placed<()> {
        Placed { image: (), origin: Point::new(region.x0, region.y0) }
    }
}

fn masked_square(at: f64) -> String {
    let (x0, x1) = (at, at + 20.0);
    format!(
        r#"{{ "kind": "path", "clip": "sq{at}", "contours": [[{x0}, 10, {x1}, 10, {x1}, 30, {x0}, 30]], "rule": "nonzero",
  "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "blur": 0,
  "masks": [{{ "mode": "add", "invert": false, "level": 1, "feather": 2,
  "cover": {{ "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [200, 0, 0, 200, {at}, 0] }} }}] }}"#
    )
}

fn list_of(positions: &[f64]) -> gpu_core::display_list::DisplayList {
    let items: Vec<String> = positions.iter().map(|at| masked_square(*at)).collect();
    parse(&format!(r#"{{ "width": {FRAME_SIDE}, "height": {FRAME_SIDE}, "background": null, "items": [{}] }}"#, items.join(","))).unwrap()
}

#[test]
fn a_masked_item_outside_the_frame_costs_no_layer() {
    let mut surface = Counting::default();
    let list = list_of(&[10.0, 5000.0, -5000.0, 40.0]);

    let layers = prepare(&mut surface, &list, &Shelf::new(), Blending::Native).unwrap();

    let frame = surface.frame();
    assert!(surface.painted.iter().all(|r| r.overlaps(frame)));
    assert_eq!(layers.bodies.len(), 2);
    assert_eq!(layers.culled.len(), 2);
}

#[test]
fn a_culled_item_is_not_reported_as_skipped() {
    let mut surface = Counting::default();
    let list = list_of(&[10.0, 5000.0]);
    let layers = prepare(&mut surface, &list, &Shelf::new(), Blending::Native).unwrap();

    let skipped = build_into(&mut Nothing, &list, &Shelf::new(), &layers);

    assert!(skipped.is_empty());
}

fn empty_group(filter: &str) -> gpu_core::display_list::DisplayList {
    parse(&format!(
        r#"{{ "width": {FRAME_SIDE}, "height": {FRAME_SIDE}, "background": null, "items": [{{ "kind": "group", "clip": "card", "items": [],
  "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "blur": 0, "filters": [{filter}] }}] }}"#
    ))
    .unwrap()
}

#[test]
fn an_empty_group_whose_filters_only_shade_its_content_costs_no_layer() {
    let mut surface = Counting::default();
    let list = empty_group(r#"{ "kind": "css", "fns": [{ "name": "drop-shadow", "args": ["0px", "15px", "35px", "rgba(0,0,0,0.08)"] }] }"#);

    let layers = prepare(&mut surface, &list, &Shelf::new(), Blending::Native).unwrap();

    assert!(surface.painted.is_empty());
    assert!(layers.bodies.is_empty());
}

#[test]
fn an_empty_group_with_an_svg_filter_still_gets_a_layer() {
    let mut surface = Counting::default();
    let list = empty_group(r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [{ "tag": "feFlood", "attrs": { "flood-color": "red" }, "children": [] }] }] }"#);

    let layers = prepare(&mut surface, &list, &Shelf::new(), Blending::Native).unwrap();

    assert_eq!(layers.bodies.len(), 1);
}

const STROKE: &str = r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
  { "tag": "feMorphology", "attrs": { "in": "SourceAlpha", "operator": "dilate", "radius": 4, "result": "grown" }, "children": [] },
  { "tag": "feFlood", "attrs": { "flood-color": "white", "result": "ink" }, "children": [] },
  { "tag": "feComposite", "attrs": { "in": "ink", "in2": "grown", "operator": "in", "result": "line" }, "children": [] },
  { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "line" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }] }] }] }"#;

const SHADOW: &str = r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
  { "tag": "feOffset", "attrs": { "in": "SourceAlpha", "dx": 0, "dy": 4, "result": "moved" }, "children": [] },
  { "tag": "feGaussianBlur", "attrs": { "in": "moved", "stdDeviation": 6, "result": "soft" }, "children": [] },
  { "tag": "feFlood", "attrs": { "flood-color": "black", "flood-opacity": 0.3, "result": "ink" }, "children": [] },
  { "tag": "feComposite", "attrs": { "in": "ink", "in2": "soft", "operator": "in", "result": "shade" }, "children": [] },
  { "tag": "feColorMatrix", "attrs": { "in": "SourceAlpha", "type": "matrix", "values": "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 255 0", "result": "solid" }, "children": [] },
  { "tag": "feComposite", "attrs": { "in": "shade", "in2": "solid", "operator": "out", "result": "cut" }, "children": [] },
  { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "cut" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }] }] }] }"#;

const FLOOD_UNDER: &str = r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
  { "tag": "feFlood", "attrs": { "flood-color": "red", "result": "ink" }, "children": [] },
  { "tag": "feComposite", "attrs": { "in": "SourceGraphic", "in2": "ink", "operator": "over" }, "children": [] }] }] }"#;

const ALPHA_LIFT: &str = r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
  { "tag": "feColorMatrix", "attrs": { "type": "matrix", "values": "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0.5" }, "children": [] }] }] }"#;

#[test]
fn an_empty_group_whose_svg_filter_strokes_its_content_costs_no_layer() {
    let mut surface = Counting::default();

    let layers = prepare(&mut surface, &empty_group(STROKE), &Shelf::new(), Blending::Native).unwrap();

    assert!(surface.painted.is_empty());
    assert!(layers.bodies.is_empty());
}

#[test]
fn an_empty_group_whose_svg_filter_shadows_its_content_costs_no_layer() {
    let mut surface = Counting::default();

    let layers = prepare(&mut surface, &empty_group(SHADOW), &Shelf::new(), Blending::Native).unwrap();

    assert!(surface.painted.is_empty());
    assert!(layers.bodies.is_empty());
}

#[test]
fn an_empty_group_whose_svg_filter_floods_under_it_still_gets_a_layer() {
    let mut surface = Counting::default();

    let layers = prepare(&mut surface, &empty_group(FLOOD_UNDER), &Shelf::new(), Blending::Native).unwrap();

    assert_eq!(layers.bodies.len(), 1);
}

#[test]
fn an_empty_group_whose_colour_matrix_lifts_alpha_still_gets_a_layer() {
    let mut surface = Counting::default();

    let layers = prepare(&mut surface, &empty_group(ALPHA_LIFT), &Shelf::new(), Blending::Native).unwrap();

    assert_eq!(layers.bodies.len(), 1);
}

fn stroked_square(at: f64) -> gpu_core::display_list::DisplayList {
    let (x0, x1) = (at, at + 20.0);
    let stroke = r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": { "x": "-25%", "y": "-25%", "width": "150%", "height": "150%" }, "children": [
  { "tag": "feMorphology", "attrs": { "in": "SourceAlpha", "operator": "dilate", "radius": 4, "result": "grown" }, "children": [] },
  { "tag": "feFlood", "attrs": { "flood-color": "white", "result": "ink" }, "children": [] },
  { "tag": "feComposite", "attrs": { "in": "ink", "in2": "grown", "operator": "in", "result": "line" }, "children": [] },
  { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "line" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }] }] }] }"#;
    parse(&format!(
        r#"{{ "width": {FRAME_SIDE}, "height": {FRAME_SIDE}, "background": null, "items": [{{ "kind": "path", "clip": "sq", "contours": [[{x0}, 10, {x1}, 10, {x1}, 30, {x0}, 30]], "rule": "nonzero",
  "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "blur": 0, "filters": [{stroke}] }}] }}"#
    ))
    .unwrap()
}

#[test]
fn an_item_stroked_by_a_filter_with_its_own_region_costs_no_layer_off_the_frame() {
    let mut off = Counting::default();
    let mut on = Counting::default();

    let culled = prepare(&mut off, &stroked_square(5000.0), &Shelf::new(), Blending::Native).unwrap();
    prepare(&mut on, &stroked_square(10.0), &Shelf::new(), Blending::Native).unwrap();

    assert_eq!(culled.culled.len(), 1);
    assert!(off.painted.is_empty());
    assert!(on.painted.iter().all(|r| r.width() < FRAME_SIDE as f64));
}
