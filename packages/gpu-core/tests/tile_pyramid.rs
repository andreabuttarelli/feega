use gpu_core::retained::{Camera, Damage};
use gpu_core::tile_pyramid::{side, Key, Pyramid, Target, GUTTER_PX, TILE_PX};
use gpu_core::texture_budget::bytes_of;
use vello::kurbo::Rect;

const VIEW: (u32, u32) = (1024, 768);
const TILE: f64 = TILE_PX as f64;
const AT_ONE: Camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
const ROOMY: u64 = 1 << 40;

fn rendered_all(p: &mut Pyramid, camera: Camera, target: Target) -> usize {
    let plan = p.plan(camera, VIEW, target);
    let n = plan.render.len();
    for r in &plan.render {
        p.kept(r.key);
    }
    n
}

#[test]
fn a_tile_covers_its_own_world_square_at_its_zoom() {
    let key = Key::new(2.0, 1, -1);
    assert_eq!(key.world(), Rect::new(TILE / 2.0, -TILE / 2.0, TILE, 0.0));
}

#[test]
fn a_gesture_targets_the_power_of_two_at_or_above_the_zoom() {
    assert_eq!(Target::Gesture.zoom(1.0), 1.0);
    assert_eq!(Target::Gesture.zoom(1.3), 2.0);
    assert_eq!(Target::Gesture.zoom(0.3), 0.5);
    assert_eq!(Target::Settled.zoom(1.3), 1.3);
}

#[test]
fn the_visible_tiles_cover_the_viewport_nearest_the_centre_first() {
    let mut p = Pyramid::new(ROOMY);
    let plan = p.plan(AT_ONE, VIEW, Target::Settled);
    let keys: Vec<Key> = plan.render.iter().map(|r| r.key).collect();
    assert_eq!(keys.len(), 4);
    let centre = Rect::new(0.0, 0.0, VIEW.0 as f64, VIEW.1 as f64).center();
    assert!(keys[0].world().contains(centre) || keys[0].world().x1 == centre.x);
    let union = keys.iter().map(|k| k.world()).reduce(|a, b| a.union(b)).unwrap();
    assert!(union.contains_rect(Rect::new(0.0, 0.0, VIEW.0 as f64, VIEW.1 as f64)));
}

#[test]
fn a_tile_with_nothing_to_stand_in_must_render_this_frame() {
    let mut p = Pyramid::new(ROOMY);
    let plan = p.plan(AT_ONE, VIEW, Target::Settled);
    assert!(plan.render.iter().all(|r| r.forced));
}

#[test]
fn a_zoom_in_draws_the_coarser_tiles_while_the_sharp_ones_render() {
    let mut p = Pyramid::new(ROOMY);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    let closer = Camera { zoom: 1.5, ..AT_ONE };
    let plan = p.plan(closer, VIEW, Target::Gesture);
    assert!(!plan.render.is_empty());
    assert!(plan.render.iter().all(|r| !r.forced));
    assert!(plan.covers.iter().any(|c| c.key.zoom() == 1.0));
    assert!(!plan.sharp);
}

#[test]
fn a_zoom_out_draws_the_finer_tiles_it_already_has() {
    let mut p = Pyramid::new(ROOMY);
    let close = Camera { zoom: 2.0, ..AT_ONE };
    rendered_all(&mut p, close, Target::Settled);
    let plan = p.plan(Camera { zoom: 1.0, ..AT_ONE }, VIEW, Target::Gesture);
    assert!(plan.covers.iter().any(|c| c.key.zoom() == 2.0));
}

#[test]
fn a_pan_inside_cached_tiles_renders_nothing() {
    let mut p = Pyramid::new(ROOMY);
    let wide = (VIEW.0 * 2, VIEW.1 * 2);
    let plan = p.plan(AT_ONE, wide, Target::Settled);
    plan.render.iter().for_each(|r| p.kept(r.key));
    let moved = p.plan(Camera { x: -100.0, y: -60.0, zoom: 1.0 }, VIEW, Target::Settled);
    assert!(moved.render.is_empty());
    assert!(moved.sharp);
}

#[test]
fn an_exact_zoom_tile_maps_to_the_screen_one_texel_per_pixel() {
    let mut p = Pyramid::new(ROOMY);
    let camera = Camera { x: 37.0, y: -12.0, zoom: 1.7 };
    rendered_all(&mut p, camera, Target::Settled);
    let plan = p.plan(camera, VIEW, Target::Settled);
    for c in &plan.covers {
        assert_eq!(c.look.scale, 1.0);
        assert_eq!(c.look.x.fract(), 0.0);
        assert_eq!(c.within.x0.fract(), 0.0);
    }
}

#[test]
fn an_edit_drops_only_the_tiles_it_touches_at_every_zoom() {
    let mut p = Pyramid::new(ROOMY);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    rendered_all(&mut p, Camera { zoom: 2.0, ..AT_ONE }, Target::Settled);
    let before = p.len();
    let gone = p.invalidate(&Damage::Rects(vec![Rect::new(10.0, 10.0, 20.0, 20.0)]));
    assert_eq!(gone.len(), 2);
    assert!(gone.iter().any(|k| k.zoom() == 1.0) && gone.iter().any(|k| k.zoom() == 2.0));
    assert_eq!(p.len(), before - 2);
}

#[test]
fn an_edit_in_a_neighbours_gutter_drops_that_neighbour_too() {
    let mut p = Pyramid::new(ROOMY);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    let edge = TILE - GUTTER_PX as f64 / 2.0;
    let gone = p.invalidate(&Damage::Rects(vec![Rect::new(edge - 0.1, 100.0, edge, 101.0)]));
    assert_eq!(gone.len(), 2);
}

#[test]
fn an_edit_with_no_area_still_drops_the_tile_it_sits_in() {
    let mut p = Pyramid::new(ROOMY);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    let gone = p.invalidate(&Damage::Rects(vec![Rect::new(100.0, 100.0, 100.0, 100.0)]));
    assert_eq!(gone.len(), 1);
}

#[test]
fn damage_to_everything_empties_the_cache() {
    let mut p = Pyramid::new(ROOMY);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    p.invalidate(&Damage::All);
    assert_eq!(p.len(), 0);
}

#[test]
fn over_budget_the_least_recently_drawn_tiles_go_first() {
    let one = bytes_of((side(), side()));
    let mut p = Pyramid::new(5 * one);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    let far = Camera { x: -TILE * 200.0, y: 0.0, zoom: 1.0 };
    rendered_all(&mut p, far, Target::Settled);
    let gone = p.evict();
    assert_eq!(gone.len(), 3);
    assert!(gone.iter().all(|k| k.world().x0 < 10_000.0));
    assert!(p.bytes() <= 5 * one);
}

#[test]
fn tiles_drawn_this_frame_are_never_evicted() {
    let one = bytes_of((side(), side()));
    let mut p = Pyramid::new(one);
    rendered_all(&mut p, AT_ONE, Target::Settled);
    assert!(p.evict().is_empty());
    assert_eq!(p.len(), 4);
}
