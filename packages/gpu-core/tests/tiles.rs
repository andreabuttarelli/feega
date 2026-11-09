use gpu_core::retained::Camera;
use gpu_core::tiles::{batches, Rest, REST_BLOCK_PX, step_of, step_zoom, TileKey, Tiles, BATCH_TILES, TILE_PX};
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
