use std::collections::HashMap;

use gpu_core::canvas::Canvas;
use gpu_core::content_key::stamp;
use gpu_core::display_list::{parse, Rgba, Size};
use gpu_core::filter_passes::Op;
use gpu_core::filters::Runner;
use gpu_core::layers::{prepare, Blending, Surface};
use gpu_core::scene::{Placed, Shelf};
use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{Fill, Mix};

const TILE: f64 = 100.0;

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
}

struct Flat;

impl Runner for Flat {
    type Tex = (u32, u32);
    fn run(&self, _: Op, inputs: [&(u32, u32); 2], _: &[f32]) -> (u32, u32) {
        *inputs[0]
    }
    fn size(tex: &(u32, u32)) -> (u32, u32) {
        *tex
    }
}

#[derive(Default)]
struct Remembering {
    zooming: bool,
    painted: Vec<Rect>,
    bodies: HashMap<String, ()>,
}

impl Surface for Remembering {
    type Canvas = Nothing;
    type Runner = Flat;
    type Error = ();
    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, TILE, TILE)
    }
    fn paint(&mut self, region: Rect, _: Option<Rgba>, _: &dyn Fn(&mut Nothing)) -> Result<(u32, u32), ()> {
        self.painted.push(region);
        Ok((region.width() as u32, region.height() as u32))
    }
    fn runner(&self) -> &Flat {
        &Flat
    }
    fn place(&mut self, _: (u32, u32), region: Rect) -> Placed<()> {
        Placed { image: (), origin: Point::new(region.x0, region.y0), scale: 1.0 }
    }
    fn recall_body(&mut self, key: &str, origin: Point, scale: f64) -> Option<Placed<()>> {
        self.bodies.get(key).map(|_| Placed { image: (), origin, scale })
    }
    fn stepped(&self) -> bool {
        self.zooming
    }
    fn remember_body(&mut self, key: &str, _: &Placed<()>) {
        self.bodies.insert(key.to_string(), ());
    }
}

fn blurred_square_at(x: f64) -> gpu_core::display_list::DisplayList {
    let mut list = parse(&format!(
        r#"{{ "width": 100, "height": 100, "background": null, "items": [
  {{ "kind": "path", "clip": "sq", "contours": [[0, 0, 40, 0, 40, 40, 0, 40]], "rule": "nonzero",
    "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 20], "blend": "normal", "blur": 3 }} ] }}"#
    ))
    .unwrap();
    stamp(&mut list.items);
    if let gpu_core::display_list::Item::Path(path) = &mut list.items[0] {
        path.look.matrix[4] = x;
    }
    list
}

#[test]
fn a_blurred_body_moved_by_whole_pixels_is_recalled_not_rendered_again() {
    let mut surface = Remembering::default();
    let pictures: Shelf<()> = Shelf::new();

    prepare(&mut surface, &blurred_square_at(10.0), &pictures, Blending::Native).unwrap();
    let first = surface.painted.len();
    let moved = prepare(&mut surface, &blurred_square_at(37.0), &pictures, Blending::Native).unwrap();

    assert_eq!(surface.painted.len(), first);
    assert_eq!(moved.bodies[&0].origin.x, surface.painted[0].x0 + 27.0);
}

#[test]
fn a_body_moved_by_a_fraction_of_a_pixel_is_rendered_again() {
    let mut surface = Remembering::default();
    let pictures: Shelf<()> = Shelf::new();

    prepare(&mut surface, &blurred_square_at(10.0), &pictures, Blending::Native).unwrap();
    let first = surface.painted.len();
    prepare(&mut surface, &blurred_square_at(10.5), &pictures, Blending::Native).unwrap();

    assert!(surface.painted.len() > first);
}

#[test]
fn a_body_crossing_the_tile_edge_is_rendered_whole_so_other_tiles_can_reuse_it() {
    let mut surface = Remembering::default();
    let pictures: Shelf<()> = Shelf::new();

    prepare(&mut surface, &blurred_square_at(80.0), &pictures, Blending::Native).unwrap();

    assert!(surface.painted[0].x1 > TILE);
}

fn blurred_square_scaled(scale: f64) -> gpu_core::display_list::DisplayList {
    let mut list = blurred_square_at(10.0);
    if let gpu_core::display_list::Item::Path(path) = &mut list.items[0] {
        path.look.matrix[0] = scale;
        path.look.matrix[3] = scale;
    }
    list
}

#[test]
fn while_zooming_a_body_is_rendered_once_per_zoom_step_and_drawn_scaled_in_between() {
    let mut surface = Remembering { zooming: true, ..Default::default() };
    let pictures: Shelf<()> = Shelf::new();

    prepare(&mut surface, &blurred_square_scaled(1.02), &pictures, Blending::Native).unwrap();
    let first = surface.painted.len();
    let closer = prepare(&mut surface, &blurred_square_scaled(1.1), &pictures, Blending::Native).unwrap();

    assert_eq!(surface.painted.len(), first);
    assert!(closer.bodies[&0].scale < 1.0);
}

#[test]
fn at_rest_a_body_is_rendered_at_its_exact_scale() {
    let mut surface = Remembering::default();
    let pictures: Shelf<()> = Shelf::new();

    prepare(&mut surface, &blurred_square_scaled(1.02), &pictures, Blending::Native).unwrap();
    let first = surface.painted.len();
    let rest = prepare(&mut surface, &blurred_square_scaled(1.1), &pictures, Blending::Native).unwrap();

    assert!(surface.painted.len() > first);
    assert_eq!(rest.bodies[&0].scale, 1.0);
}
