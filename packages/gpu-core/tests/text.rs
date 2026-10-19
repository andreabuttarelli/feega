use std::fs;
use std::path::Path;

use gpu_core::display_list::{DisplayList, Item, Paint, PathItem};
use gpu_core::text::{typeset, FontShelf};
use gpu_text::Source;
use serde::Deserialize;
use vello::kurbo::{Affine, Point};

const FIXTURE: &str = "tests/fixtures/text-parity.json";
const REPO: &str = "../..";
const MAX_DRIFT_PX: f64 = 0.25;
const MAX_PAINT_DRIFT: f32 = 0.01;

#[derive(Deserialize)]
struct Case {
    name: String,
    list: DisplayList,
    expected: Vec<Item>,
}

fn cases() -> Vec<Case> {
    serde_json::from_str(&fs::read_to_string(FIXTURE).expect("fixture written by native-parity.test.ts")).expect("fixture")
}

fn shelf(list: &DisplayList) -> FontShelf {
    list.faces.iter().map(|f| (f.url.clone(), Source::from_bytes(&fs::read(Path::new(REPO).join(&f.url)).expect("font file")).expect("font"))).collect()
}

fn paths(items: &[Item]) -> Vec<&PathItem> {
    items.iter().map(|i| match i {
        Item::Path(p) => p,
        other => panic!("not a path: {}", other.kind()),
    }).collect()
}

fn rings(p: &PathItem) -> Vec<Vec<Point>> {
    let m = Affine::new(p.look.matrix);
    p.contours.iter().map(|c| c.chunks_exact(2).map(|xy| m * Point::new(xy[0], xy[1])).collect()).collect()
}

fn to_segment(p: Point, a: Point, b: Point) -> f64 {
    let ab = b - a;
    let t = if ab.hypot2() == 0.0 { 0.0 } else { ((p - a).dot(ab) / ab.hypot2()).clamp(0.0, 1.0) };
    p.distance(a + ab * t)
}

fn reach(from: &[Vec<Point>], to: &[Vec<Point>]) -> f64 {
    let edges: Vec<(Point, Point)> = to.iter().flat_map(|r| r.iter().zip(r.iter().cycle().skip(1)).map(|(a, b)| (*a, *b))).collect();
    from.iter().flatten().map(|p| edges.iter().map(|(a, b)| to_segment(*p, *a, *b)).fold(f64::INFINITY, f64::min)).fold(0.0, f64::max)
}

fn drift(a: &PathItem, b: &PathItem) -> f64 {
    let (ra, rb) = (rings(a), rings(b));
    reach(&ra, &rb).max(reach(&rb, &ra))
}

fn colours(p: &Paint) -> Vec<f32> {
    match p {
        Paint::Solid { color } => color.to_vec(),
        Paint::Linear { from, to, stops } => from.iter().chain(to).map(|v| *v as f32 / 100.0).chain(stops.iter().flat_map(|s| s.color)).collect(),
        Paint::Radial { center, radius, stops } => center.iter().chain([radius]).map(|v| *v as f32 / 100.0).chain(stops.iter().flat_map(|s| s.color)).collect(),
    }
}

fn paint_drift(a: &Paint, b: &Paint) -> f32 {
    let (ca, cb) = (colours(a), colours(b));
    assert_eq!(ca.len(), cb.len(), "paint kinds differ");
    ca.iter().zip(&cb).map(|(x, y)| (x - y).abs()).fold(0.0, f32::max)
}

#[test]
fn native_text_matches_the_ts_pipeline_on_every_parity_case() {
    let mut table = vec!["| case | TS items | native items | max outline drift (px) | max paint drift |".to_string(), "|---|---|---|---|---|".to_string()];
    let mut failures = vec![];
    for case in cases() {
        let (set, skipped) = typeset(&case.list, &shelf(&case.list));
        assert!(skipped.is_empty(), "{}: {:?}", case.name, skipped);
        let (native, expected) = (paths(&set.items), paths(&case.expected));
        let outline = native.iter().zip(&expected).map(|(n, e)| drift(n, e)).fold(0.0, f64::max);
        let paint = native.iter().zip(&expected).map(|(n, e)| paint_drift(&n.paint, &e.paint).max((n.look.opacity - e.look.opacity).abs())).fold(0.0, f32::max);
        let rules = native.iter().zip(&expected).all(|(n, e)| n.rule == e.rule && (n.look.blur - e.look.blur).abs() < 0.01);
        table.push(format!("| {} | {} | {} | {:.3} | {:.4} |", case.name, expected.len(), native.len(), outline, paint));
        if native.len() != expected.len() || outline > MAX_DRIFT_PX || paint > MAX_PAINT_DRIFT || !rules {
            failures.push(case.name);
        }
    }
    println!("{}", table.join("\n"));
    assert!(failures.is_empty(), "off parity: {failures:?}\n{}", table.join("\n"));
}

#[test]
fn a_text_item_without_its_font_is_skipped_by_name() {
    let case = cases().into_iter().next().unwrap();
    let (set, skipped) = typeset(&case.list, &FontShelf::new());

    assert!(set.items.is_empty());
    assert_eq!(skipped.iter().map(|s| s.what.as_str()).collect::<Vec<_>>(), vec!["font"]);
}

#[cfg(feature = "gpu")]
#[test]
fn the_renderer_lays_out_and_draws_a_text_item_with_its_fonts() {
    let case = cases().into_iter().find(|c| c.name == "font mono").unwrap();
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    for face in &case.list.faces {
        renderer.put_font(&face.url, Source::from_bytes(&fs::read(Path::new(REPO).join(&face.url)).unwrap()).unwrap());
    }
    let rendered = renderer.render(&case.list, &gpu_core::pictures::Pictures::new()).unwrap();
    let background = rendered.pixels[..4].to_vec();

    assert!(rendered.skipped.is_empty(), "{:?}", rendered.skipped);
    assert!(rendered.pixels.chunks(4).filter(|p| *p != background.as_slice()).count() > 1000);
}
