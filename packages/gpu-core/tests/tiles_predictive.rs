use gpu_core::retained::Camera;
use gpu_core::tiles::{coarse_first, magnified_share, step_of, TileKey, Tiles, Velocity, AHEAD_ZOOM_REACH};

const SCREEN: (u32, u32) = (1024, 768);

fn zoomed(zoom: f64) -> Camera {
    let (w, h) = (SCREEN.0 as f64, SCREEN.1 as f64);
    Camera { x: w / 2.0 * (1.0 - zoom), y: h / 2.0 * (1.0 - zoom), zoom }
}

#[test]
fn a_steady_zoom_in_is_predicted_further_in_around_the_same_centre() {
    let mut v = Velocity::default();
    for i in 0..4 {
        v.saw(i as f64 * 16.0, zoomed(1.0 + 0.02 * i as f64), SCREEN);
    }

    let ahead = v.predict(100.0, SCREEN).unwrap();

    assert!(ahead.zoom > 1.06 && ahead.zoom < 1.06 * AHEAD_ZOOM_REACH);
    let centre = |c: Camera| ((SCREEN.0 as f64 / 2.0 - c.x) / c.zoom, (SCREEN.1 as f64 / 2.0 - c.y) / c.zoom);
    let (a, b) = (centre(ahead), centre(zoomed(1.06)));
    assert!((a.0 - b.0).abs() < 1.0 && (a.1 - b.1).abs() < 1.0);
}

#[test]
fn a_fast_zoom_is_clamped_to_the_reach() {
    let mut v = Velocity::default();
    v.saw(0.0, zoomed(1.0), SCREEN);
    v.saw(16.0, zoomed(2.0), SCREEN);

    assert!((v.predict(100.0, SCREEN).unwrap().zoom - 2.0 * AHEAD_ZOOM_REACH).abs() < 1e-9);
}

#[test]
fn a_still_camera_predicts_nothing() {
    let mut v = Velocity::default();
    v.saw(0.0, zoomed(1.0), SCREEN);
    v.saw(16.0, zoomed(1.0), SCREEN);

    assert!(v.predict(100.0, SCREEN).is_none());
}

#[test]
fn bare_areas_are_baked_coarse_first_then_at_full_scale() {
    let mut tiles = Tiles::default();
    let c = zoomed(2.0);
    let step = step_of(c.zoom);
    let missing = tiles.frame(c, SCREEN).missing;

    let first = coarse_first(&tiles, c, SCREEN, missing.clone());
    assert!(first[0].step < step);

    for k in first.iter().filter(|k| k.step < step) {
        tiles.hold(*k);
    }
    let then = coarse_first(&tiles, c, SCREEN, tiles.frame(c, SCREEN).missing);
    assert_eq!(then[0].step, step);
}

#[test]
fn the_magnified_share_counts_screen_shown_past_the_cap() {
    let c = zoomed(1.0);
    let sharp: Vec<TileKey> = (0..4).flat_map(|ty| (0..5).map(move |tx| TileKey { step: step_of(1.0), tx, ty })).collect();
    let blurry = vec![TileKey { step: step_of(1.0) - 8, tx: 0, ty: 0 }];

    assert!(magnified_share(&sharp, c, SCREEN) < 0.01);
    assert!(magnified_share(&blurry, c, SCREEN) > 0.9);
}
