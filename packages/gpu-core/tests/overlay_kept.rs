use gpu_core::overlay_kept::{OverlayDrawn, OverlayKept, OverlayKey};
use gpu_core::retained::Camera;

const AT: Camera = Camera { x: 10.0, y: 20.0, zoom: 1.5 };
const KEY: OverlayKey = OverlayKey { camera: AT, size: (1440, 900) };

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
