use gpu_core::canvas::Canvas;
use gpu_core::display_list::{parse, DisplayList, Item, Paint, Size};
use gpu_core::fragments::compose;
use gpu_core::groups::{Library, Limits};
use gpu_core::lod::{blur_px, detail, Detail};
use vello::kurbo::{Affine, BezPath, Rect};
use vello::peniko::{Fill, Mix};
use vello::Scene;

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };
const GLYPHS: usize = 20;

#[derive(Default)]
struct Recorder {
    fragments: usize,
    fills: Vec<Paint>,
}

impl Canvas for Recorder {
    type Picture = ();

    fn size(_: &()) -> Size {
        Size { width: 1.0, height: 1.0 }
    }

    fn fill(&mut self, _: Fill, _: Affine, paint: &Paint, _: &BezPath) {
        self.fills.push(paint.clone());
    }

    fn picture(&mut self, _: Affine, _: &(), _: Affine, _: Rect) {}

    fn push_layer(&mut self, _: Mix, _: f32, _: Rect) {}

    fn push_clip(&mut self, _: Fill, _: Affine, _: &BezPath) {}

    fn pop(&mut self) {}

    fn fragment(&mut self, _: &Scene, _: Affine) -> bool {
        self.fragments += 1;
        true
    }
}

fn path(clip: &str, x: f64, y: f64, w: f64, h: f64, extra: &str) -> String {
    format!(
        r#"{{ "kind": "path", "clip": "{clip}", "contours": [[{x}, {y}, {}, {y}, {}, {}, {x}, {}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal"{extra} }}"#,
        x + w,
        x + w,
        y + h,
        y + h
    )
}

fn page() -> DisplayList {
    let glyphs: Vec<String> = (0..GLYPHS).map(|i| path(&format!("g{i}"), 3.0 * i as f64, 100.0, 2.0, 6.0, "")).collect();
    let items = [vec![path("card", 0.0, 0.0, 400.0, 300.0, "")], glyphs].concat().join(",");
    parse(&format!(r#"{{ "width": 400, "height": 300, "background": null, "items": [{items}] }}"#)).unwrap()
}

fn drawn_at(scale: f64) -> Recorder {
    let mut library = Library::new();
    library.compose_encodings();
    library.put_group("a", &page());
    let screen = parse(&format!(
        r#"{{ "width": 800, "height": 600, "background": null, "items": [{{ "kind": "use", "clip": "a", "group": "a", "matrix": [{scale}, 0, 0, {scale}, 0, 0], "cache": false }}] }}"#
    ))
    .unwrap();
    let plan = library.plan(&screen, LIMITS);
    let mut recorder = Recorder::default();
    compose(&mut recorder, plan.screen.fragments.get("a").unwrap(), Affine::scale(scale), Rect::new(0.0, 0.0, 800.0, 600.0));
    recorder
}

fn blurred_at(scale: f64) -> f64 {
    let mut library = Library::new();
    library.compose_encodings();
    let soft = path("soft", 10.0, 10.0, 80.0, 80.0, r#", "blur": 3"#);
    library.put_group("a", &parse(&format!(r#"{{ "width": 100, "height": 100, "background": null, "items": [{soft}] }}"#)).unwrap());
    let screen = parse(&format!(
        r#"{{ "width": 800, "height": 600, "background": null, "items": [{{ "kind": "use", "clip": "a", "group": "a", "matrix": [{scale}, 0, 0, {scale}, 0, 0], "cache": false }}] }}"#
    ))
    .unwrap();
    let Item::Path(drawn) = &library.plan(&screen, LIMITS).screen.items[0] else { panic!("a path") };
    drawn.look.blur
}

#[test]
fn the_ladder_skips_below_half_a_pixel_and_draws_bars_below_one_and_a_half() {
    assert_eq!(detail(0.3, true), Detail::Skip);
    assert_eq!(detail(1.0, true), Detail::Bar);
    assert_eq!(detail(1.0, false), Detail::Full);
    assert_eq!(detail(5.0, true), Detail::Full);
}

#[test]
fn a_blur_under_half_a_pixel_is_dropped() {
    assert_eq!(blur_px(0.4), 0.0);
    assert_eq!(blur_px(2.0), 2.0);
}

#[test]
fn at_full_size_every_run_is_drawn_from_its_encoding() {
    let drawn = drawn_at(1.0);

    assert_eq!(drawn.fragments, 3);
    assert!(drawn.fills.is_empty());
}

#[test]
fn tiny_text_runs_become_bars_and_the_big_shape_stays_vector() {
    let drawn = drawn_at(0.1);

    assert_eq!(drawn.fragments, 1);
    assert_eq!(drawn.fills.len(), 2);
}

#[test]
fn sub_pixel_runs_are_not_drawn_at_all() {
    let drawn = drawn_at(0.05);

    assert_eq!(drawn.fragments, 1);
    assert!(drawn.fills.is_empty());
}

#[test]
fn runs_outside_the_viewport_are_not_drawn() {
    let mut library = Library::new();
    library.compose_encodings();
    library.put_group("a", &page());
    let plan = library.plan(&parse(r#"{ "width": 800, "height": 600, "background": null, "items": [{ "kind": "use", "clip": "a", "group": "a", "matrix": [1, 0, 0, 1, 0, 0], "cache": false }] }"#).unwrap(), LIMITS);
    let mut recorder = Recorder::default();

    compose(&mut recorder, plan.screen.fragments.get("a").unwrap(), Affine::translate((0.0, -150.0)), Rect::new(0.0, 0.0, 800.0, 90.0));

    assert_eq!(recorder.fragments, 1);
}

#[test]
fn a_blur_that_shrinks_under_half_a_pixel_on_screen_is_drawn_sharp() {
    assert_eq!(blurred_at(1.0), 3.0);
    assert_eq!(blurred_at(0.1), 0.0);
}
