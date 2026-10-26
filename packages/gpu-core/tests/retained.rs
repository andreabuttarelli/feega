use gpu_core::retained::{merged, subtract, tiles, Camera, Damage, Lookup, Outcome, Quality, Retained, Step};
use vello::kurbo::Rect;

const W: u32 = 800;
const H: u32 = 600;
const O: f64 = 75.0;

fn at(x: f64, y: f64, zoom: f64) -> Camera {
    Camera { x, y, zoom }
}

fn rendered(r: &mut Retained, camera: Camera, now: f64) -> Step {
    r.step(camera, Damage::none(), now)
}

fn outcome(step: &Step) -> Option<Outcome> {
    match step {
        Step::Raster(r) => Some(r.outcome),
        Step::Present => Some(Outcome::Reused),
        Step::Idle => None,
    }
}

fn area(rects: &[Rect]) -> f64 {
    rects.iter().map(|r| r.area()).sum()
}

#[test]
fn the_overscan_is_an_eighth_of_the_short_side_and_never_over_128() {
    assert_eq!(Retained::new(W, H).overscan(), 75);
    assert_eq!(Retained::new(3000, 2000).overscan(), 128);
    assert_eq!(Retained::new(W, H).size(), (950, 750));
}

#[test]
fn the_first_frame_is_a_full_render_of_the_whole_retained_texture() {
    let mut r = Retained::new(W, H);

    let Step::Raster(first) = rendered(&mut r, at(10.0, 20.0, 1.0), 0.0) else { panic!("a raster") };

    assert_eq!(first.outcome, Outcome::Full);
    assert_eq!(first.rects, vec![Rect::new(0.0, 0.0, 950.0, 750.0)]);
}

#[test]
fn a_pan_inside_the_overscan_reuses_the_texture_without_rastering() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    assert!(matches!(rendered(&mut r, at(40.0, -30.0, 1.0), 16.0), Step::Present));
    let look = r.lookup(at(40.0, -30.0, 1.0));
    assert_eq!((look.scale, look.x, look.y), (1.0, O - 40.0, O + 30.0));
}

#[test]
fn the_camera_is_snapped_to_whole_device_pixels() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    rendered(&mut r, at(10.4, 9.6, 1.0), 16.0);

    let look = r.lookup(at(10.4, 9.6, 1.0));
    assert_eq!((look.x, look.y), (O - 10.0, O - 10.0));
}

#[test]
fn an_unchanged_camera_with_no_damage_draws_nothing() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    assert!(matches!(rendered(&mut r, at(0.2, 0.0, 1.0), 16.0), Step::Idle));
}

#[test]
fn a_pan_past_the_overscan_leads_by_the_overscan_and_rasters_only_the_uncovered_strip() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    let Step::Raster(scroll) = rendered(&mut r, at(-100.0, 0.0, 1.0), 16.0) else { panic!("a raster") };

    assert_eq!(scroll.outcome, Outcome::Partial);
    assert_eq!(scroll.shift, Some((-175, 0)));
    assert_eq!(scroll.rects, vec![Rect::new(775.0, 0.0, 950.0, 750.0)]);
    assert_eq!(scroll.camera, at(-175.0, 0.0, 1.0));
}

#[test]
fn a_jump_with_no_overlap_is_a_full_render() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    assert_eq!(outcome(&rendered(&mut r, at(-5000.0, 0.0, 1.0), 16.0)), Some(Outcome::Full));
}

#[test]
fn an_edit_rasters_the_old_and_new_bounds_only() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    let damage = Damage::Rects(vec![Rect::new(10.0, 10.0, 50.0, 50.0), Rect::new(300.0, 300.0, 340.0, 320.0)]);
    let Step::Raster(edit) = r.step(at(0.0, 0.0, 1.0), damage, 16.0) else { panic!("a raster") };

    assert_eq!(edit.outcome, Outcome::Partial);
    assert_eq!(edit.shift, None);
    assert_eq!(edit.rects, vec![Rect::new(84.0, 84.0, 126.0, 126.0), Rect::new(374.0, 374.0, 416.0, 396.0)]);
}

#[test]
fn damage_over_sixty_percent_of_the_view_is_a_full_render() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    let damage = Damage::Rects(vec![Rect::new(0.0, 0.0, 700.0, 600.0)]);

    assert_eq!(outcome(&r.step(at(0.0, 0.0, 1.0), damage, 16.0)), Some(Outcome::Full));
}

#[test]
fn during_a_zoom_gesture_a_slow_scene_is_only_reprojected() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(20.0);

    assert!(matches!(rendered(&mut r, at(-40.0, -30.0, 1.1), 16.0), Step::Present));
    assert!(r.pending());
    let look = r.lookup(at(-40.0, -30.0, 1.1));
    assert!((look.scale - 1.0 / 1.1).abs() < 1e-9);
}

#[test]
fn after_the_zoom_settles_a_sharp_render_refines_it() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(11.0);
    rendered(&mut r, at(0.0, 0.0, 1.1), 16.0);

    assert!(!matches!(rendered(&mut r, at(0.0, 0.0, 1.1), 60.0), Step::Raster(_)));
    let Step::Raster(refine) = rendered(&mut r, at(0.0, 0.0, 1.1), 130.0) else { panic!("a raster") };

    assert_eq!((refine.outcome, refine.quality), (Outcome::Full, Quality::Sharp));
    assert!(!r.pending());
}

#[test]
fn a_slow_full_render_refines_at_quarter_resolution_first() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(20.0);
    rendered(&mut r, at(0.0, 0.0, 2.0), 16.0);

    let Step::Raster(rough) = rendered(&mut r, at(0.0, 0.0, 2.0), 200.0) else { panic!("a raster") };
    assert_eq!(rough.quality, Quality::Rough);
    assert!(r.pending());

    let Step::Raster(sharp) = rendered(&mut r, at(0.0, 0.0, 2.0), 216.0) else { panic!("a raster") };
    assert_eq!(sharp.quality, Quality::Sharp);
}

#[test]
fn a_zoom_out_that_uncovers_the_view_rasters_even_mid_gesture() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    assert!(matches!(rendered(&mut r, at(200.0, 150.0, 0.5), 16.0), Step::Raster(_)));
}

#[test]
fn full_damage_always_rasters_everything() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);

    assert_eq!(outcome(&r.step(at(0.0, 0.0, 1.0), Damage::All, 16.0)), Some(Outcome::Full));
}

#[test]
fn a_rect_minus_another_leaves_at_most_four_strips() {
    let whole = Rect::new(0.0, 0.0, 100.0, 100.0);

    assert_eq!(area(&subtract(whole, Rect::new(20.0, 20.0, 80.0, 80.0))), 10_000.0 - 3600.0);
    assert_eq!(subtract(whole, Rect::new(-10.0, -10.0, 200.0, 200.0)), vec![]);
    assert_eq!(subtract(whole, Rect::new(500.0, 0.0, 600.0, 100.0)), vec![whole]);
}

#[test]
fn damage_is_merged_down_to_eight_rects() {
    let many: Vec<Rect> = (0..20).map(|i| Rect::new(i as f64 * 10.0, 0.0, i as f64 * 10.0 + 5.0, 5.0)).collect();

    let merged = merged(many.clone(), 8);

    assert!(merged.len() <= 8);
    assert!(many.iter().all(|r| merged.iter().any(|m| m.union(*r) == *m)));
}

#[test]
fn overlapping_damage_becomes_one_rect() {
    let merged = merged(vec![Rect::new(0.0, 0.0, 10.0, 10.0), Rect::new(5.0, 5.0, 15.0, 15.0)], 8);

    assert_eq!(merged, vec![Rect::new(0.0, 0.0, 15.0, 15.0)]);
}

#[test]
fn a_lookup_turned_bottom_up_maps_the_same_pixels() {
    let look = Lookup { scale: 0.5, x: 10.0, y: 20.0 };
    let (source_h, target_h) = (400.0, 300.0);
    let down = |sy: f64| sy * look.scale + look.y;

    let up = look.bottom_up(source_h, target_h);

    for sy in [0.0, 17.5, 300.0] {
        assert_eq!(source_h - down(sy), (target_h - sy) * up.scale + up.y);
    }
    assert_eq!((up.scale, up.x), (0.5, 10.0));
}

#[test]
fn a_region_larger_than_the_scratch_target_is_split_into_tiles() {
    let parts = tiles(Rect::new(0.0, 0.0, 950.0, 750.0), 800, 600);

    assert_eq!(parts.len(), 4);
    assert_eq!(area(&parts), 950.0 * 750.0);
    assert!(parts.iter().all(|p| p.width() <= 800.0 && p.height() <= 600.0));
}

#[test]
fn a_zoom_out_that_uncovers_the_view_rasters_rough_while_the_gesture_runs() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(20.0);

    let Step::Raster(mid) = rendered(&mut r, at(200.0, 150.0, 0.5), 16.0) else { panic!("a raster") };
    assert_eq!(mid.quality, Quality::Rough);

    let Step::Raster(settled) = rendered(&mut r, at(200.0, 150.0, 0.5), 300.0) else { panic!("a raster") };
    assert_eq!(settled.quality, Quality::Sharp);
}

#[test]
fn during_a_zoom_gesture_a_cheap_scene_is_redrawn_sharp_every_frame() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(4.0);

    for (i, zoom) in [1.05, 1.1, 1.15].into_iter().enumerate() {
        let Step::Raster(live) = rendered(&mut r, at(0.0, 0.0, zoom), 16.0 * (i + 1) as f64) else { panic!("a raster") };
        assert_eq!((live.outcome, live.quality), (Outcome::Full, Quality::Sharp));
        assert_eq!(live.camera.zoom, zoom);
    }
}

#[test]
fn a_scene_that_misses_the_live_budget_falls_back_to_the_reprojected_texture() {
    let mut r = Retained::new(W, H);
    rendered(&mut r, at(0.0, 0.0, 1.0), 0.0);
    r.took(4.0);
    rendered(&mut r, at(0.0, 0.0, 1.05), 16.0);

    r.took(14.0);

    assert!(matches!(rendered(&mut r, at(0.0, 0.0, 1.1), 32.0), Step::Present));
}
