use gpu_core::overlay_kept::{Moving, OverlayDrawn, OverlayKept, OverlayKey, OverlayQuality};
use gpu_core::retained::Camera;

const AT: Camera = Camera { x: 10.0, y: 20.0, zoom: 1.5 };
const KEY: OverlayKey = OverlayKey { camera: AT, size: (1440, 900), quality: OverlayQuality::Sharp };

#[test]
fn an_unchanged_camera_and_overlay_reuse_the_drawn_texture_and_anything_else_redraws_it() {
    let mut kept = OverlayKept::default();

    assert!(kept.stale(&KEY));
    kept.drew(KEY, OverlayDrawn::Settled);
    assert!(!kept.stale(&KEY));

    assert!(kept.stale(&OverlayKey { camera: Camera { zoom: 1.6, ..AT }, ..KEY }));
    assert!(kept.stale(&OverlayKey { size: (800, 600), ..KEY }));

    kept.forget();
    assert!(kept.stale(&KEY));

    kept.drew(KEY, OverlayDrawn::Pending);
    assert!(kept.stale(&KEY));
}

#[test]
fn a_moving_camera_draws_the_overlay_at_half_resolution_and_rest_redraws_it_sharp() {
    let mut kept = OverlayKept::default();

    assert_eq!(OverlayQuality::of(Moving::Camera).scale(), 0.5);
    assert_eq!(OverlayQuality::of(Moving::Still).scale(), 1.0);
    assert_eq!(OverlayQuality::of(Moving::Lift).scale(), 1.0);

    kept.drew(OverlayKey { quality: OverlayQuality::of(Moving::Camera), ..KEY }, OverlayDrawn::Settled);
    assert!(kept.stale(&KEY));
}
