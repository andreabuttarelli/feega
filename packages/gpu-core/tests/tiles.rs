use gpu_core::retained::Camera;
use gpu_core::tiles::{lifted_keys, NEAR_STEPS, tiles_kept, TILE_BUDGET_BYTES, TILE_BYTES, batches, bake_batches, BAKE_BATCH_TILES, Rest, REST_BLOCK_PX, step_of, step_zoom, TileKey, Tiles, BATCH_TILES, TILE_PX};
use vello::kurbo::{Point, Rect};

const SCREEN: (u32, u32) = (1024, 768);

fn camera(zoom: f64) -> Camera {
    Camera { x: 0.0, y: 0.0, zoom }
}

#[test]
fn a_zoom_step_is_a_quarter_octave_rounded_up() {
    assert_eq!(step_of(1.0), 0);
    assert_eq!(step_of(1.1), 1);
    assert!((step_zoom(4) - 2.0).abs() < 1e-9);
}

#[test]
fn the_visible_tiles_cover_the_screen_nearest_the_centre_first() {
    let tiles = Tiles::default();
    let frame = tiles.frame(camera(1.0), SCREEN);
    let per_row = (SCREEN.0 as f64 / TILE_PX as f64).ceil() as usize;
    let rows = (SCREEN.1 as f64 / TILE_PX as f64).ceil() as usize;
    assert_eq!(frame.missing.len(), per_row * rows);
    let centre = |k: &TileKey| {
        let r = k.screen(camera(1.0));
        ((r.center().x - 512.0).powi(2) + (r.center().y - 384.0).powi(2)).sqrt()
    };
    assert!(frame.missing.windows(2).all(|w| centre(&w[0]) <= centre(&w[1])));
}

#[test]
fn a_tile_rastered_at_the_step_is_drawn_and_no_longer_missing() {
    let mut tiles = Tiles::default();
    let first = tiles.frame(camera(1.0), SCREEN);
    let key = first.missing[0];
    tiles.hold(key);

    let next = tiles.frame(camera(1.0), SCREEN);
    assert!(!next.missing.contains(&key));
    assert!(next.draw.contains(&key));
}

#[test]
fn zooming_in_draws_the_coarser_tiles_until_the_new_step_is_rastered() {
    let mut tiles = Tiles::default();
    for key in tiles.frame(camera(1.0), SCREEN).missing {
        tiles.hold(key);
    }

    let zoomed = tiles.frame(camera(1.5), SCREEN);
    assert!(!zoomed.missing.is_empty());
    assert!(zoomed.draw.iter().all(|k| k.step == 0));
    let screen = Rect::new(0.0, 0.0, SCREEN.0 as f64, SCREEN.1 as f64);
    let covered: f64 = zoomed.draw.iter().map(|k| k.screen(camera(1.5)).intersect(screen).area()).sum();
    assert!(covered >= screen.area() - 1.0);
}

#[test]
fn zooming_out_draws_the_finer_tiles_it_holds() {
    let mut tiles = Tiles::default();
    for key in tiles.frame(camera(1.0), SCREEN).missing {
        tiles.hold(key);
    }

    let out = tiles.frame(camera(0.8), SCREEN);
    assert!(out.draw.iter().any(|k| k.step == 0));
}

#[test]
fn a_change_drops_every_tile_it_touches_at_every_step() {
    let mut tiles = Tiles::default();
    for zoom in [1.0, 2.0] {
        for key in tiles.frame(camera(zoom), SCREEN).missing {
            tiles.hold(key);
        }
    }

    tiles.invalidate(Rect::new(10.0, 10.0, 20.0, 20.0));

    assert!(tiles.frame(camera(1.0), SCREEN).missing.iter().any(|k| k.world().contains(vello::kurbo::Point::new(15.0, 15.0))));
    assert!(tiles.frame(camera(2.0), SCREEN).missing.iter().any(|k| k.world().contains(vello::kurbo::Point::new(15.0, 15.0))));
}

#[test]
fn a_missing_tile_under_a_coarser_one_is_covered_and_a_bare_one_is_not() {
    let mut tiles = Tiles::default();
    for key in tiles.frame(camera(1.0), SCREEN).missing {
        tiles.hold(key);
    }

    let zoomed = tiles.frame(camera(1.5), SCREEN);
    assert!(zoomed.missing.iter().all(|k| tiles.covered(*k)));

    let elsewhere = TileKey { step: 2, tx: 1000, ty: 1000 };
    assert!(!tiles.covered(elsewhere));
}

#[test]
fn eviction_never_leaves_a_drawn_tile_without_its_store_entry() {
    let mut tiles = Tiles::default();
    for step in -12..=4 {
        for key in tiles.frame(camera(step_zoom(step)), SCREEN).missing {
            tiles.hold(key);
        }
    }
    let gone = tiles.evict_beyond(camera(1.0), SCREEN, 40);
    assert!(!gone.is_empty());

    let frame = tiles.frame(camera(1.0), SCREEN);
    assert!(frame.draw.iter().all(|k| tiles.holds(*k) && !gone.contains(k)));
}

#[test]
fn missing_tiles_raster_together_by_block_nearest_block_first() {
    let tiles = Tiles::default();
    let missing = tiles.frame(camera(1.0), SCREEN).missing;
    let blocks = batches(&missing);

    assert_eq!(blocks.iter().map(|b| b.keys.len()).sum::<usize>(), missing.len());
    assert!(blocks.iter().all(|b| b.keys.len() <= (BATCH_TILES * BATCH_TILES) as usize));
    assert!(blocks[0].keys.contains(&missing[0]));
    for b in &blocks {
        let union = b.keys.iter().map(|k| k.world()).reduce(|a, r| a.union(r)).unwrap();
        assert_eq!(b.world(), union);
        assert!(b.keys.iter().all(|k| k.step == b.step));
    }
}

#[test]
fn at_rest_the_exact_picture_is_rastered_in_screen_blocks_nearest_the_centre_first() {
    let rest = Rest::new(camera(1.3), SCREEN);
    let blocks = rest.todo();

    let area: f64 = blocks.iter().map(|b| b.area()).sum();
    assert_eq!(area, (SCREEN.0 * SCREEN.1) as f64);
    assert!(blocks.iter().all(|b| b.width() <= REST_BLOCK_PX as f64 && b.height() <= REST_BLOCK_PX as f64));
    let centre = vello::kurbo::Point::new(SCREEN.0 as f64 / 2.0, SCREEN.1 as f64 / 2.0);
    assert!(blocks.windows(2).all(|w| w[0].center().distance(centre) <= w[1].center().distance(centre)));
}

#[test]
fn the_rest_picture_belongs_to_one_camera_and_one_screen() {
    let rest = Rest::new(camera(1.3), SCREEN);

    assert!(rest.shows(camera(1.3), SCREEN));
    assert!(!rest.shows(camera(1.31), SCREEN));
    assert!(!rest.shows(Camera { x: 0.5, ..camera(1.3) }, SCREEN));
    assert!(!rest.shows(camera(1.3), (SCREEN.0 + 1, SCREEN.1)));
}

#[test]
fn a_changed_tile_stays_on_screen_until_its_replacement_is_rastered() {
    let mut tiles = Tiles::default();
    let keys = tiles.frame(camera(1.0), SCREEN).missing;
    keys.iter().for_each(|k| tiles.hold(*k));

    tiles.invalidate(Rect::new(0.0, 0.0, 10.0, 10.0));
    tiles.clear();

    let frame = tiles.frame(camera(1.0), SCREEN);
    assert!(keys.iter().all(|k| frame.draw.contains(k) && frame.missing.contains(k)));
    tiles.hold(keys[0]);
    assert!(!tiles.frame(camera(1.0), SCREEN).missing.contains(&keys[0]));
}

fn filled(tiles: &mut Tiles) {
    for step in -12..=4 {
        for key in tiles.frame(camera(step_zoom(step)), SCREEN).missing {
            tiles.hold(key);
        }
    }
}

#[test]
fn eviction_never_drops_the_tiles_on_screen_or_one_ring_around_it() {
    let mut tiles = Tiles::default();
    filled(&mut tiles);
    let at = camera(1.0);
    let ring = Rect::new(-(TILE_PX as f64), -(TILE_PX as f64), SCREEN.0 as f64 + TILE_PX as f64, SCREEN.1 as f64 + TILE_PX as f64);

    let gone = tiles.evict_beyond(at, SCREEN, 0);

    assert!(!gone.is_empty());
    assert!(gone.iter().all(|k| k.step != step_of(1.0) || !k.screen(at).overlaps(ring)));
}

#[test]
fn eviction_drops_the_least_recently_drawn_tiles_first() {
    let mut tiles = Tiles::default();
    let old = tiles.frame(camera(step_zoom(-20)), SCREEN).missing;
    let recent = tiles.frame(camera(step_zoom(-16)), SCREEN).missing;
    old.iter().chain(&recent).for_each(|k| tiles.hold(*k));
    tiles.drawn(&old);
    tiles.drawn(&recent);

    let gone = tiles.evict_beyond(camera(1.0), SCREEN, recent.len());

    assert_eq!(gone.len(), old.len());
    assert!(old.iter().all(|k| gone.contains(k)));
}

#[test]
fn the_tile_budget_follows_the_screen_and_caps_at_the_memory_budget() {
    assert!(tiles_kept((1440, 900), TILE_BUDGET_BYTES) < tiles_kept((2880, 1800), TILE_BUDGET_BYTES));
    assert!(tiles_kept((100_000, 100_000), TILE_BUDGET_BYTES) as u64 * TILE_BYTES <= TILE_BUDGET_BYTES);
    let phone = 128 << 20;
    assert!(tiles_kept((100_000, 100_000), phone) as u64 * TILE_BYTES <= phone);
}

#[test]
fn a_retina_desktop_keeps_as_many_tiles_as_the_memory_budget_holds() {
    assert_eq!(tiles_kept((2880, 1800), TILE_BUDGET_BYTES) as u64, TILE_BUDGET_BYTES / TILE_BYTES);
}

#[test]
fn a_sharper_step_replaces_the_one_on_screen_only_once_it_covers_the_whole_screen() {
    let mut tiles = Tiles::default();
    let coarse = tiles.frame(camera(step_zoom(-4)), SCREEN).missing;
    coarse.iter().for_each(|k| tiles.hold(*k));
    let sharp = tiles.frame(camera(1.0), SCREEN).missing;
    sharp.iter().take(sharp.len() / 2).for_each(|k| tiles.hold(*k));

    let half = tiles.frame(camera(1.0), SCREEN);
    assert!(half.draw.iter().all(|k| k.step != step_of(1.0)));

    sharp.iter().for_each(|k| tiles.hold(*k));
    let whole = tiles.frame(camera(1.0), SCREEN);
    assert!(sharp.iter().all(|k| whole.draw.contains(k)));
}

#[test]
fn a_tile_within_twice_its_sharpness_is_near_enough_to_start_the_rest_picture() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(-4)), SCREEN).missing.iter().for_each(|k| tiles.hold(*k));
    let key = tiles.frame(camera(1.0), SCREEN).missing[0];
    assert!(tiles.covered_within(key, NEAR_STEPS));

    let mut far = Tiles::default();
    far.frame(camera(step_zoom(-8)), SCREEN).missing.iter().for_each(|k| far.hold(*k));
    assert!(!far.covered_within(key, NEAR_STEPS));
}

#[test]
fn zooming_out_over_sharper_tiles_needs_no_raster_during_the_gesture() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(2)), SCREEN).missing.iter().for_each(|k| tiles.hold(*k));
    tiles.frame(camera(step_zoom(2)), (SCREEN.0 * 2, SCREEN.1 * 2)).missing.iter().for_each(|k| tiles.hold(*k));
    let key = tiles.frame(camera(1.0), SCREEN).missing[0];

    assert!(tiles.covered_within(key, NEAR_STEPS));
}

#[test]
fn a_changed_tile_on_screen_is_queued_to_raster_again_even_while_it_still_shows() {
    let mut tiles = Tiles::default();
    let keys = tiles.frame(camera(1.0), SCREEN).missing;
    keys.iter().for_each(|k| tiles.hold(*k));
    tiles.invalidate(keys[0].world());

    let queue = tiles.queue(tiles.frame(camera(1.0), SCREEN).missing);

    assert!(queue.stale.contains(&keys[0]));
    assert!(queue.blank.is_empty() && queue.blurry.is_empty());
}

#[test]
fn tiles_warm_a_moment_after_the_last_gesture() {
    let mut warm = gpu_core::tiles::Warmup::default();
    warm.stirred(0.0);
    assert!(!warm.due(400.0));
    assert!(warm.due(600.0));
}

#[test]
fn a_lift_without_a_camera_move_draws_from_tiles() {
    use gpu_core::tiles::{path_for, Moment, Path};
    let still = Moment { gesture: false, lifting: false, settling: false };

    assert_eq!(path_for(still), Path::Exact);
    assert_eq!(path_for(Moment { lifting: true, ..still }), Path::Tiles);
    assert_eq!(path_for(Moment { gesture: true, ..still }), Path::Tiles);
    assert_eq!(path_for(Moment { settling: true, ..still }), Path::Tiles);
}

#[test]
fn a_rest_picture_with_a_block_drawn_while_a_group_was_building_is_not_adopted() {
    use gpu_core::tiles::Drawn;
    let camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
    let mut rest = Rest::new(camera, (REST_BLOCK_PX, REST_BLOCK_PX * 2));
    rest.next();
    rest.drew(Drawn::Lacking);
    rest.next();
    rest.drew(Drawn::Whole);

    assert!(rest.todo().is_empty());
    assert!(!rest.adoptable());

    let mut whole = Rest::new(camera, (REST_BLOCK_PX, REST_BLOCK_PX));
    whole.next();
    whole.drew(Drawn::Whole);
    assert!(whole.adoptable());
}

#[test]
fn idle_baking_rasters_every_missing_tile_in_bounded_blocks() {
    let missing = Tiles::default().frame(camera(1.0), SCREEN).missing;
    let baked = bake_batches(&missing);

    assert_eq!(baked.iter().map(|b| b.keys.len()).sum::<usize>(), missing.len());
    assert!(baked.iter().all(|b| b.keys.len() <= (BAKE_BATCH_TILES * BAKE_BATCH_TILES) as usize));
}

#[test]
fn a_tile_drawn_before_its_frame_was_ready_is_dropped_where_other_tiles_cover_it() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(-4)), SCREEN).missing.iter().for_each(|k| tiles.hold(*k));
    let key = tiles.frame(camera(1.0), SCREEN).missing[0];

    assert!(!tiles.hold_lacking(key));
    assert!(!tiles.holds(key));
}

#[test]
fn a_tile_drawn_before_its_frame_was_ready_is_shown_where_nothing_covers_it_and_drawn_again() {
    let mut tiles = Tiles::default();
    let key = tiles.frame(camera(1.0), SCREEN).missing[0];

    assert!(tiles.hold_lacking(key));
    assert!(tiles.holds(key));
    assert!(tiles.queue(tiles.frame(camera(1.0), SCREEN).missing).stale.contains(&key));
}


#[test]
fn the_held_screen_shows_under_the_current_tiles_while_it_is_no_softer_than_a_quarter_stretch() {
    use gpu_core::tiles::underlay_shows;

    assert!(underlay_shows(1.0));
    assert!(underlay_shows(1.2));
    assert!(!underlay_shows(1.3));
    assert!(underlay_shows(0.3));
}

#[test]
fn tiles_do_not_warm_while_frames_are_still_building() {
    use gpu_core::tiles::{Building, Warmup};
    let mut warm = Warmup::default();
    warm.stirred(0.0);

    assert!(!warm.due_when(500.0, Building::Frames));
    assert!(warm.due_when(500.0, Building::Nothing));
}

#[test]
fn tiles_warm_later_after_an_upload_than_after_a_gesture() {
    use gpu_core::tiles::Warmup;
    let mut after_gesture = Warmup::default();
    after_gesture.stirred(0.0);
    let mut after_upload = Warmup::default();
    after_upload.uploaded(0.0);

    assert!(after_gesture.due(600.0));
    assert!(!after_upload.due(1400.0));
    assert!(after_upload.due(1600.0));
}

#[test]
fn the_cheap_coarse_levels_warm_while_uploads_still_hold_the_rest() {
    use gpu_core::tiles::Warmup;
    let mut warm = Warmup::default();
    warm.moved(0.0);
    warm.uploaded(400.0);

    assert!(warm.coarse_due(600.0));
    assert!(!warm.due(600.0));
}


const KEPT: usize = 1000;
const WIDE: Rect = Rect::new(0.0, 0.0, 40000.0, 20000.0);

fn baked(canvas: Rect, at: Camera) -> Tiles {
    let mut tiles = Tiles::default();
    tiles.set_canvas(canvas);
    let keys = tiles.pyramid(at, SCREEN, KEPT);
    keys.iter().for_each(|k| tiles.hold(*k));
    tiles
}

fn union(keys: &[TileKey]) -> Rect {
    keys.iter().map(|k| k.world()).reduce(|a, b| a.union(b)).unwrap()
}

#[test]
fn the_pyramid_is_baked_coarse_to_sharp_from_a_sixteenth_to_one_pixel_ratio() {
    let mut tiles = Tiles::default();
    tiles.set_pixel_ratio(2.0);
    tiles.set_canvas(WIDE);

    let keys = tiles.pyramid(camera(0.3), SCREEN, KEPT);

    let steps: Vec<i32> = keys.iter().map(|k| k.step).collect();
    assert!(steps.windows(2).all(|w| w[0] <= w[1]));
    let top = step_of(2.0);
    assert_eq!(steps.first(), Some(&(top - 16)));
    assert_eq!(steps.last(), Some(&top));
}

#[test]
fn the_coarsest_level_covers_the_whole_canvas_and_the_sharpest_only_the_view() {
    let mut tiles = Tiles::default();
    tiles.set_canvas(WIDE);

    let keys = tiles.pyramid(camera(0.05), SCREEN, KEPT);

    let coarse: Vec<TileKey> = keys.iter().filter(|k| k.step == keys[0].step).copied().collect();
    assert!(union(&coarse).contains(WIDE.origin()) && union(&coarse).x1 >= WIDE.x1 && union(&coarse).y1 >= WIDE.y1);
    let sharp: Vec<TileKey> = keys.iter().filter(|k| k.step == 0).copied().collect();
    assert!(!sharp.is_empty() && union(&sharp).area() < WIDE.area() / 4.0);
}

#[test]
fn no_level_bakes_more_than_its_share_of_the_kept_tiles() {
    use gpu_core::tiles::{PYRAMID, CANVAS_TILES};
    let mut tiles = Tiles::default();
    tiles.set_canvas(WIDE);

    let keys = tiles.pyramid(camera(1.0), SCREEN, KEPT);

    for (i, level) in PYRAMID.iter().enumerate() {
        let count = keys.iter().filter(|k| k.step == -level.below_top).count();
        let allowed = (KEPT as u64 * level.share_percent / 100) as usize;
        let allowed = if i == 0 { allowed.max(CANVAS_TILES) } else { allowed };
        assert!(count <= allowed, "level {} baked {count} > {allowed}", level.below_top);
    }
}

#[test]
fn a_zoom_out_between_levels_needs_no_raster_once_the_pyramid_is_baked() {
    let tiles = baked(WIDE, Camera { x: -10000.0, y: -5000.0, zoom: 1.0 });

    let at = |zoom: f64| Camera { x: -10000.0 * zoom + 512.0 * (1.0 - zoom), y: -5000.0 * zoom + 384.0 * (1.0 - zoom), zoom };
    for zoom in [0.9, 0.7, 0.5, 0.3] {
        let missing = tiles.frame(at(zoom), SCREEN).missing;
        assert!(missing.is_empty(), "zoom {zoom}: {} missing", missing.len());
    }
    assert!(tiles.queue(tiles.frame(at(0.1), SCREEN).missing).blank.is_empty());
}

#[test]
fn a_far_zoom_out_shows_no_blank_tile_on_the_canvas() {
    let tiles = baked(WIDE, Camera { x: -10000.0, y: -5000.0, zoom: 1.0 });
    let fit = Camera { x: 0.0, y: 0.0, zoom: SCREEN.0 as f64 / WIDE.width() };

    let blank = tiles.queue(tiles.frame(fit, SCREEN).missing).blank;

    assert!(blank.iter().all(|k| !k.world().overlaps(WIDE)), "{} blank on the canvas", blank.len());
}

#[test]
fn a_zoom_out_draws_at_least_one_texel_per_device_pixel_and_at_most_a_root_two_more() {
    let mut tiles = Tiles::default();
    tiles.set_pixel_ratio(2.0);

    for zoom in (5..=40).map(|i| i as f64 * 0.05) {
        let density = step_zoom(tiles.step_for(camera(zoom)));
        assert!(density >= zoom - 1e-9, "zoom {zoom}: {density} texels per pixel");
        assert!(density <= zoom * 2f64.sqrt() + 1e-9, "zoom {zoom}: {density} oversampled");
    }
    assert_eq!(tiles.step_for(camera(3.0)), step_of(3.0));
}

#[test]
fn above_the_pixel_ratio_the_view_is_rastered_on_demand() {
    let tiles = baked(WIDE, camera(1.0));

    assert!(!tiles.frame(camera(1.6), SCREEN).missing.is_empty());
}

#[test]
fn pyramid_tiles_survive_eviction_during_a_zoom_away_from_where_they_were_planned() {
    let mut tiles = baked(WIDE, Camera { x: -10000.0, y: -5000.0, zoom: 1.0 });
    let planned = tiles.pyramid(Camera { x: -10000.0, y: -5000.0, zoom: 1.0 }, SCREEN, KEPT);
    let held = tiles.len();
    assert!(planned.is_empty());
    let deep = Camera { x: -40000.0, y: -20000.0, zoom: 4.0 };
    (0..200).for_each(|i| tiles.hold(TileKey { step: step_of(4.0), tx: i, ty: 0 }));

    let gone = tiles.evict_beyond(deep, SCREEN, held);

    assert_eq!(gone.len(), 200);
    assert!(gone.iter().all(|k| k.step == step_of(4.0)));
}

#[test]
fn without_a_whole_canvas_allowance_the_coarsest_level_stays_around_the_view() {
    let mut tiles = Tiles::default();
    tiles.set_canvas(WIDE);
    tiles.set_canvas_tiles(0);

    let keys = tiles.pyramid(camera(1.0), SCREEN, KEPT);

    let coarse: Vec<TileKey> = keys.iter().filter(|k| k.step == keys[0].step).copied().collect();
    assert!(union(&coarse).area() < WIDE.area());
}

#[test]
fn evicting_thousands_of_tiles_zoomed_in_on_a_wide_canvas_takes_milliseconds() {
    let mut tiles = baked(WIDE, camera(1.0));
    let step = step_of(4.0);
    (0..4000).for_each(|i| tiles.hold(TileKey { step, tx: i % 200, ty: i / 200 }));

    let started = std::time::Instant::now();
    tiles.evict_beyond(camera(4.0), SCREEN, 100);

    assert!(started.elapsed().as_millis() < 200, "evicting took {:?}", started.elapsed());
}

#[test]
fn a_missing_tile_shown_by_sharper_held_tiles_is_not_unsharp() {
    let mut tiles = Tiles::default();
    let coarse = tiles.frame(camera(1.0), SCREEN).missing;
    tiles.frame(camera(step_zoom(2)), (SCREEN.0 * 2, SCREEN.1 * 2)).missing.iter().for_each(|k| tiles.hold(*k));
    assert_eq!(tiles.unsharp(&coarse), 0);

    let mut blurry = Tiles::default();
    blurry.frame(camera(step_zoom(-2)), SCREEN).missing.iter().for_each(|k| blurry.hold(*k));
    assert_eq!(blurry.unsharp(&coarse), coarse.len());
}

#[test]
fn during_a_gesture_every_blurry_visible_tile_is_queued_centre_out_before_the_stale_ones() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(-4)), SCREEN).missing.iter().for_each(|k| tiles.hold(*k));
    let visible = tiles.frame(camera(1.0), SCREEN).missing;
    let changed = visible[0];
    tiles.hold(changed);
    tiles.invalidate(changed.world());

    let order = tiles.queue(tiles.frame(camera(1.0), SCREEN).missing).order();

    let blurry: Vec<TileKey> = visible.iter().copied().filter(|k| *k != changed).collect();
    assert_eq!(order[..blurry.len()], blurry[..]);
    assert_eq!(order[blurry.len()], changed);
    assert!(order[blurry.len() + 1..].iter().all(|k| k.step < changed.step && k.world().overlaps(changed.world())));
}

#[test]
fn during_a_gesture_tiles_shown_by_sharper_held_ones_are_not_queued() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(2)), (SCREEN.0 * 2, SCREEN.1 * 2)).missing.iter().for_each(|k| tiles.hold(*k));

    let order = tiles.queue(tiles.frame(camera(1.0), SCREEN).missing).order();

    assert!(order.is_empty());
}

#[test]
fn one_draw_rasters_a_block_of_up_to_four_by_four_tiles_nearest_first() {
    let tiles = Tiles::default();
    let order = tiles.queue(tiles.frame(camera(1.0), (SCREEN.0 * 2, SCREEN.1 * 2)).missing).order();

    let blocks = batches(&order);

    assert_eq!(blocks.iter().map(|b| b.keys.len()).sum::<usize>(), order.len());
    assert!(blocks[0].keys.contains(&order[0]));
    assert_eq!(blocks.iter().map(|b| b.span()).max(), Some((4, 4)));
}

#[test]
fn an_expensive_tile_during_a_gesture_waits_for_the_frames_it_overspent() {
    let mut credit = gpu_core::tiles::RasterCredit::default();
    credit.earn(4.0);
    assert!(credit.allows());
    credit.spend(12.0);
    assert!(!credit.allows());

    credit.earn(4.0);
    credit.earn(4.0);
    assert!(!credit.allows());
    credit.earn(4.0);
    assert!(credit.allows());
}

#[test]
fn cheap_tiles_fill_one_frame_budget_and_idle_frames_do_not_bank_more() {
    let mut credit = gpu_core::tiles::RasterCredit::default();
    credit.earn(4.0);
    credit.earn(4.0);
    credit.earn(4.0);
    (0..7).for_each(|_| credit.spend(0.5));
    assert!(credit.allows());
    credit.spend(0.5);
    assert!(!credit.allows());
}

#[test]
fn the_level_the_view_draws_covers_the_screen_and_a_margin_around_it_whatever_its_share() {
    let mut tiles = Tiles::default();
    tiles.set_pixel_ratio(2.0);
    tiles.set_canvas(WIDE);
    let at = Camera { x: -2000.0, y: -1000.0, zoom: 0.2 };

    let keys = tiles.pyramid(at, SCREEN, 200);

    let step = tiles.step_for(at);
    let world = Rect::new(2000.0 / 0.2, 1000.0 / 0.2, (2000.0 + SCREEN.0 as f64) / 0.2, (1000.0 + SCREEN.1 as f64) / 0.2);
    let level = union(&keys.iter().filter(|k| k.step == step).copied().collect::<Vec<_>>());
    assert!(level.contains(Point::new(world.x0 - world.width() / 4.0, world.y0 - world.height() / 4.0)));
    assert!(level.contains(Point::new(world.x1 + world.width() / 4.0, world.y1 + world.height() / 4.0)));
}

#[test]
fn panning_past_the_canvas_edge_rasters_nothing_for_the_empty_space() {
    let mut tiles = baked(WIDE, camera(0.2));
    tiles.set_pixel_ratio(1.0);
    let past = Camera { x: 2000.0, y: 2000.0, zoom: 0.2 };

    let missing = tiles.frame(past, SCREEN).missing;

    assert!(missing.iter().all(|k| k.world().overlaps(WIDE)), "{} empty tiles missing", missing.iter().filter(|k| !k.world().overlaps(WIDE)).count());
}

#[test]
fn a_level_covering_the_painted_screen_hides_the_coarser_ones_under_it() {
    let mut tiles = Tiles::default();
    tiles.set_canvas(WIDE);
    let fit = Camera { x: 200.0, y: 200.0, zoom: 4.0 * SCREEN.0 as f64 / WIDE.width() };
    let planned = tiles.pyramid(fit, SCREEN, KEPT);
    let coarsest = planned[0].step;
    planned.iter().filter(|k| k.step == coarsest).for_each(|k| tiles.hold(*k));
    tiles.hold(TileKey { step: coarsest - 4, tx: 0, ty: 0 });

    let frame = tiles.frame(fit, SCREEN);

    assert!(!frame.missing.is_empty());
    let steps: std::collections::BTreeSet<i32> = frame.draw.iter().map(|k| k.step).collect();
    assert_eq!(steps.into_iter().collect::<Vec<_>>(), vec![coarsest]);
}

#[test]
fn a_changed_tile_shown_from_a_sharper_step_is_queued_to_raster_again() {
    let mut tiles = Tiles::default();
    let sharp = tiles.frame(camera(step_zoom(1)), SCREEN).missing;
    sharp.iter().for_each(|k| tiles.hold(*k));
    tiles.frame(camera(step_zoom(1)), (SCREEN.0 * 2, SCREEN.1 * 2)).missing.iter().for_each(|k| tiles.hold(*k));
    let shown = tiles.frame(camera(1.0), SCREEN).draw;
    assert!(shown.iter().all(|k| k.step == 1));
    tiles.invalidate(shown[0].world());

    let frame = tiles.frame(camera(1.0), SCREEN);

    assert!(frame.missing.contains(&shown[0]));
    assert!(tiles.queue(frame.missing).stale.contains(&shown[0]));
}

#[test]
fn a_lifted_use_needs_the_tiles_of_its_rest_that_its_move_brings_on_screen() {
    let rest = Rect::new(-1000.0, 0.0, -500.0, 200.0);

    let keys = lifted_keys(camera(1.0), SCREEN, rest, (1200.0, 0.0), 0);

    assert!(!keys.is_empty());
    assert!(keys.iter().all(|k| k.world().overlaps(rest) && k.step == 0));
    assert!(lifted_keys(camera(1.0), SCREEN, rest, (0.0, 0.0), 0).is_empty());
}

#[test]
fn a_stall_long_past_does_not_starve_the_frames_after_it() {
    let mut credit = gpu_core::tiles::RasterCredit::default();
    credit.earn(4.0);
    credit.spend(300.0);

    let waited = (1..).find(|_| {
        credit.earn(4.0);
        credit.allows()
    });

    assert!(waited.unwrap() <= 4, "waited {waited:?} frames");
}

#[test]
fn the_level_that_covers_the_whole_canvas_survives_eviction_without_a_plan() {
    let mut tiles = Tiles::default();
    tiles.set_canvas(WIDE);
    let overview = tiles.pyramid(Camera { x: 0.0, y: 0.0, zoom: SCREEN.0 as f64 / WIDE.width() }, SCREEN, KEPT);
    let canvas_step = overview[0].step;
    overview.iter().for_each(|k| tiles.hold(*k));
    let mut fresh = Tiles::default();
    fresh.set_canvas(WIDE);
    overview.iter().filter(|k| k.step == canvas_step).for_each(|k| fresh.hold(*k));
    let deep = Camera { x: -20000.0, y: -10000.0, zoom: 2.0 };
    (0..200).for_each(|i| fresh.hold(TileKey { step: step_of(2.0), tx: 10000 + i, ty: 5000 }));

    let gone = fresh.evict_beyond(deep, SCREEN, 0);

    assert!(gone.iter().all(|k| k.step != canvas_step), "evicted {} overview tiles", gone.iter().filter(|k| k.step == canvas_step).count());
}

