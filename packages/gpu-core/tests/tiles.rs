use gpu_core::retained::Camera;
use gpu_core::tiles::{NEAR_STEPS, tiles_kept, TILE_BUDGET_BYTES, TILE_BYTES, batches, bake_batches, BAKE_BATCH_TILES, Rest, REST_BLOCK_PX, step_of, step_zoom, TileKey, Tiles, BATCH_TILES, TILE_PX};
use vello::kurbo::Rect;

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
fn the_reserve_is_a_coarse_level_around_the_screen_so_a_fast_zoom_never_shows_a_blank() {
    let tiles = Tiles::default();
    let reserve = tiles.reserve(camera(1.0), SCREEN);
    assert!(!reserve.is_empty());
    assert!(reserve.iter().all(|k| k.step < 0));
    let screen_world = Rect::new(0.0, 0.0, SCREEN.0 as f64, SCREEN.1 as f64);
    let reach = reserve.iter().map(|k| k.world()).reduce(|a, b| a.union(b)).unwrap();
    assert!(reach.contains(screen_world.origin()) && reach.width() > screen_world.width() * 2.0);
}

#[test]
fn a_deep_fast_zoom_from_rest_always_finds_a_covering_tile_in_the_idle_set() {
    let mut tiles = Tiles::default();
    let rest = Camera { x: -200.0, y: -100.0, zoom: 0.3 };
    for key in tiles.frame(rest, SCREEN).missing {
        tiles.hold(key);
    }
    for key in tiles.reserve(rest, SCREEN) {
        tiles.hold(key);
    }

    for zoom in [0.6, 1.1, 2.0, 3.7, 6.7] {
        let pointer = (300.0, 400.0);
        let world = ((pointer.0 - rest.x) / rest.zoom, (pointer.1 - rest.y) / rest.zoom);
        let deep = Camera { x: pointer.0 - world.0 * zoom, y: pointer.1 - world.1 * zoom, zoom };
        let frame = tiles.frame(deep, SCREEN);
        assert!(frame.missing.iter().all(|k| tiles.covered(*k)), "blank at zoom {zoom}");
    }
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
fn a_sharper_step_replaces_the_one_on_screen_only_once_it_covers_the_whole_screen() {
    let mut tiles = Tiles::default();
    let coarse = tiles.frame(camera(step_zoom(-2)), SCREEN).missing;
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
fn during_a_gesture_a_tile_within_twice_its_sharpness_is_good_enough() {
    let mut tiles = Tiles::default();
    tiles.frame(camera(step_zoom(-4)), SCREEN).missing.iter().for_each(|k| tiles.hold(*k));
    let key = tiles.frame(camera(1.0), SCREEN).missing[0];
    assert!(tiles.covered_within(key, NEAR_STEPS));

    let mut far = Tiles::default();
    far.frame(camera(step_zoom(-8)), SCREEN).missing.iter().for_each(|k| far.hold(*k));
    assert!(!far.covered_within(key, NEAR_STEPS));
}

#[test]
fn while_idle_the_tiles_around_the_screen_and_one_step_sharper_are_fetched_ahead() {
    let tiles = Tiles::default();
    let ahead = tiles.ahead(camera(1.0), SCREEN);
    let step = step_of(1.0);

    assert!(ahead.iter().any(|k| k.step == step && !k.screen(camera(1.0)).overlaps(Rect::new(0.0, 0.0, SCREEN.0 as f64, SCREEN.1 as f64))));
    assert!(ahead.iter().any(|k| k.step == step + 1));
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
fn tiles_warm_only_after_a_second_without_rasters_or_uploads() {
    let mut warm = gpu_core::tiles::Warmup::default();
    warm.stirred(0.0);
    assert!(!warm.due(900.0));
    warm.stirred(900.0);
    assert!(!warm.due(1500.0));
    assert!(warm.due(1900.0));
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
fn idle_baking_rasters_bigger_blocks_than_a_gesture() {
    let missing = Tiles::default().frame(camera(1.0), SCREEN).missing;
    let baked = bake_batches(&missing);

    assert_eq!(baked.iter().map(|b| b.keys.len()).sum::<usize>(), missing.len());
    assert!(baked.len() < batches(&missing).len());
    assert!(baked.iter().all(|b| b.keys.len() <= (BAKE_BATCH_TILES * BAKE_BATCH_TILES) as usize));
}
