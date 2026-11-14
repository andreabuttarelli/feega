use std::cell::Cell;

use gpu_core::canvas::Canvas;
use gpu_core::display_list::{parse, Rgba, Size};
use gpu_core::filter_passes::Op;
use gpu_core::filters::Runner;
use gpu_core::layers::{prepare, Blending, Surface};
use gpu_core::scene::{Placed, Shelf};
use gpu_core::tally::Reason;
use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{Fill, Mix};

const FRAME_SIDE: f64 = 100.0;

thread_local! {
    static FILLS: Cell<usize> = const { Cell::new(0) };
}

struct Fills;

impl Canvas for Fills {
    type Picture = ();

    fn size(_: &()) -> Size {
        Size { width: 1.0, height: 1.0 }
    }

    fn fill_plain(&mut self, _: Fill, _: Affine, _: &gpu_core::display_list::Paint, _: &BezPath) {
        FILLS.with(|f| f.set(f.get() + 1));
    }

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
struct Backdrops {
    fills: Vec<usize>,
}

impl Surface for Backdrops {
    type Canvas = Fills;
    type Runner = Flat;
    type Error = ();

    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, FRAME_SIDE, FRAME_SIDE)
    }

    fn paint(&mut self, reason: Reason, region: Rect, base: Option<Rgba>, draw: &dyn Fn(&mut Fills)) -> Result<(u32, u32), ()> {
        FILLS.with(|f| f.set(0));
        draw(&mut Fills);
        if reason == Reason::Backdrop && base.is_some() {
            self.fills.push(FILLS.with(Cell::get));
        }
        Ok((region.width() as u32, region.height() as u32))
    }

    fn runner(&self) -> &Flat {
        &Flat
    }

    fn place(&mut self, _: (u32, u32), region: Rect) -> Placed<()> {
        Placed { image: (), origin: Point::new(region.x0, region.y0) }
    }
}

fn square(at: f64, extra: &str) -> String {
    let (x0, x1) = (at, at + 20.0);
    format!(
        r#"{{ "kind": "path", "clip": "sq{at}", "contours": [[{x0}, 10, {x1}, 10, {x1}, 30, {x0}, 30]], "rule": "nonzero",
  "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal"{extra} }}"#
    )
}

#[test]
fn a_backdrop_encodes_only_what_lies_under_it() {
    let items = [square(0.0, ""), square(60.0, ""), square(70.0, ""), square(5.0, r#", "backdrop": 2"#)];
    let list = parse(&format!(r#"{{ "width": 100, "height": 100, "background": [0, 0, 0, 1], "items": [{}] }}"#, items.join(","))).unwrap();
    let mut surface = Backdrops::default();

    prepare(&mut surface, &list, &Shelf::default(), Blending::Native).unwrap();

    assert_eq!(surface.fills, vec![1]);
}
