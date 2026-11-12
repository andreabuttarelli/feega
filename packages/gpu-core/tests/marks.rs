use gpu_core::display_list::Item;
use gpu_core::marks::{Marks, Part};

const LOOK: &str = r#""look":{"handle":8,"border":1,"fill":[1,1,1,1],"far":[0.25,1.5,0.05],"dpr":1,"edge":8,"reach":22,"dash":4}"#;

fn marks(body: &str) -> Marks {
    Marks::parse(&format!("{{\"marks\":[{body}],{LOOK}}}")).unwrap()
}

const BOX: &str = r#"{"quad":[100,100,200,100,200,150,100,150],"line":"solid","color":[0,0.6,1,1],"width":1,"offset":-1,"handles":"all","handleRadius":2,"body":true,"edges":true,"rotate":true}"#;

const AT_2X: [f64; 6] = [2.0, 0.0, 0.0, 2.0, 10.0, 20.0];

fn bounds(item: &Item) -> [f64; 4] {
    let Item::Path(p) = item else { panic!("not a path") };
    let xs = p.contours.iter().flat_map(|c| c.iter().step_by(2).copied());
    let ys = p.contours.iter().flat_map(|c| c.iter().skip(1).step_by(2).copied());
    let (x0, x1) = xs.fold((f64::MAX, f64::MIN), |(a, b), v| (a.min(v), b.max(v)));
    let (y0, y1) = ys.fold((f64::MAX, f64::MIN), |(a, b), v| (a.min(v), b.max(v)));
    [x0, y0, x1, y1]
}

#[test]
fn a_ring_is_drawn_where_the_camera_puts_its_box() {
    let items = marks(BOX).items(AT_2X);
    assert_eq!(bounds(&items[0]), [210.0, 220.0, 410.0, 320.0]);
}

#[test]
fn the_ring_keeps_its_pixel_width_at_any_zoom() {
    let far = marks(BOX).items([0.1, 0.0, 0.0, 0.1, 0.0, 0.0]);
    let near = marks(BOX).items([8.0, 0.0, 0.0, 8.0, 0.0, 0.0]);
    let Item::Path(f) = &far[0] else { panic!() };
    let Item::Path(n) = &near[0] else { panic!() };
    let inner_gap = |p: &gpu_core::display_list::PathItem| p.contours[0][0] - p.contours[1].iter().step_by(2).copied().fold(f64::MAX, f64::min);
    assert!((inner_gap(f).abs() - 1.0).abs() < 1e-9);
    assert!((inner_gap(n).abs() - 1.0).abs() < 1e-9);
}

#[test]
fn a_box_with_all_handles_draws_eight_of_them() {
    let items = marks(BOX).items(AT_2X);
    assert_eq!(items.len(), 1 + 8 * 2);
}

#[test]
fn a_handle_is_hit_before_the_body_under_it() {
    let m = marks(BOX);
    let hit = m.hit(AT_2X, 410.0, 320.0).unwrap();
    assert_eq!((hit.index, hit.part, hit.n), (0, Part::Handle, 2));
}

#[test]
fn a_side_band_is_hit_as_an_edge() {
    let hit = marks(BOX).hit(AT_2X, 250.0, 221.0).unwrap();
    assert_eq!((hit.part, hit.n), (Part::Edge, 4));
}

#[test]
fn just_outside_a_corner_is_the_rotate_zone() {
    let hit = marks(BOX).hit(AT_2X, 200.0, 210.0).unwrap();
    assert_eq!((hit.part, hit.n), (Part::Rotate, 0));
}

#[test]
fn inside_the_box_is_the_body() {
    let hit = marks(BOX).hit(AT_2X, 300.0, 270.0).unwrap();
    assert_eq!((hit.part, hit.n), (Part::Body, 0));
}

#[test]
fn far_from_every_mark_nothing_is_hit() {
    assert!(marks(BOX).hit(AT_2X, 900.0, 900.0).is_none());
}

#[test]
fn a_hover_ring_answers_no_hit() {
    let ring = r#"{"quad":[0,0,10,0,10,10,0,10],"line":"solid","color":[0,0.6,1,1],"width":1.5,"offset":1,"radius":2,"handles":"none"}"#;
    assert!(marks(ring).hit([1.0, 0.0, 0.0, 1.0, 0.0, 0.0], 5.0, 5.0).is_none());
}

#[test]
fn the_later_mark_is_on_top() {
    let m = marks(&format!("{BOX},{BOX}"));
    assert_eq!(m.hit(AT_2X, 300.0, 270.0).unwrap().index, 1);
}

#[test]
fn rect_of_is_the_screen_box_of_a_mark() {
    assert_eq!(marks(BOX).rect_of(AT_2X, 0), Some([210.0, 220.0, 200.0, 100.0]));
    assert_eq!(marks(BOX).rect_of(AT_2X, 3), None);
}

#[test]
fn a_rotated_box_is_hit_inside_its_turned_quad() {
    let diamond = r#"{"quad":[50,0,100,50,50,100,0,50],"line":"solid","color":[0,0,0,1],"width":1,"offset":-1,"handles":"none","body":true}"#;
    let m = marks(diamond);
    let id = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    assert!(m.hit(id, 50.0, 50.0).is_some());
    assert!(m.hit(id, 5.0, 5.0).is_none());
}

#[test]
fn a_dashed_ring_breaks_into_dashes() {
    let dashed = BOX.replace("\"solid\"", "\"dashed\"").replace("\"all\"", "\"none\"");
    let items = marks(&dashed).items(AT_2X);
    let Item::Path(p) = &items[0] else { panic!() };
    assert!(p.contours.len() > 20);
}

#[test]
fn no_marks_draw_nothing() {
    assert!(Marks::default().items(AT_2X).is_empty());
}

const RING: &str = r#"{"quad":[0,0,100,0,100,100,0,100],"line":"solid","color":[0,0.6,1,1],"width":2,"offset":1,"handles":"corners","onRing":true,"boosted":true}"#;

fn ring_width(zoom: f64) -> f64 {
    let items = marks(RING).items([zoom, 0.0, 0.0, zoom, 0.0, 0.0]);
    let Item::Path(p) = &items[0] else { panic!() };
    let outer = p.contours[0].iter().step_by(2).copied().fold(f64::MAX, f64::min);
    let inner = p.contours[1].iter().step_by(2).copied().fold(f64::MAX, f64::min);
    inner - outer
}

#[test]
fn a_boosted_ring_thickens_only_when_zoomed_far_out() {
    assert!((ring_width(1.0) - 2.0).abs() < 1e-9);
    assert!((ring_width(0.05) - 3.0).abs() < 1e-9);
}

#[test]
fn handles_on_the_ring_sit_on_its_centre_line() {
    let items = marks(RING).items([1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
    assert_eq!(bounds(&items[1]), [-6.0, -6.0, 2.0, 2.0]);
}

#[test]
fn a_mark_with_its_own_reach_is_hit_farther_out() {
    let node = RING.replace("\"boosted\":true", "\"boosted\":true,\"edges\":true,\"hitReach\":8");
    let m = marks(&node);
    let id = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
    assert_eq!(m.hit(id, 5.0, 5.0).map(|h| (h.part, h.n)), Some((Part::Handle, 0)));
    assert_eq!(m.hit(id, 50.0, 107.0).map(|h| (h.part, h.n)), Some((Part::Edge, 5)));
    assert!(marks(RING).hit(id, 5.0, 5.0).is_none());
}
