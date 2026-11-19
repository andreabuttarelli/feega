use gpu_core::tiles::TileKey;
use gpu_core::watch::{visible_losses, Loss, LossKind};
use vello::kurbo::Rect;

const EVERYWHERE: Rect = Rect::new(-1e12, -1e12, 1e12, 1e12);

const SHARP: i32 = 4;
const SOFT: i32 = 2;

fn key(step: i32, tx: i64, ty: i64) -> TileKey {
    TileKey { step, tx, ty }
}

#[test]
fn the_same_tiles_drawn_again_lose_nothing() {
    let drawn = [key(SHARP, 0, 0), key(SHARP, 1, 0)];
    assert!(visible_losses(&drawn, &drawn, SHARP, EVERYWHERE).is_empty());
}

#[test]
fn a_sharp_tile_replaced_by_a_softer_level_is_a_loss() {
    let was = [key(SHARP, 0, 0)];
    let now = [key(SOFT, 0, 0)];
    assert_eq!(visible_losses(&was, &now, SHARP, EVERYWHERE), vec![Loss { key: key(SHARP, 0, 0), kind: LossKind::Coarser }]);
}

#[test]
fn a_tile_that_nothing_covers_any_more_is_uncovered() {
    let was = [key(SHARP, 0, 0), key(SHARP, 5, 5)];
    let now = [key(SHARP, 0, 0)];
    assert_eq!(visible_losses(&was, &now, SHARP, EVERYWHERE), vec![Loss { key: key(SHARP, 5, 5), kind: LossKind::Uncovered }]);
}

#[test]
fn sharpening_is_never_a_loss() {
    let was = [key(SOFT, 0, 0)];
    let now = [key(SHARP, 0, 0), key(SHARP, 1, 0), key(SHARP, 0, 1), key(SHARP, 1, 1)];
    assert!(visible_losses(&was, &now, SHARP, EVERYWHERE).is_empty());
}

#[test]
fn dropping_detail_the_zoom_does_not_need_is_not_a_loss() {
    let was = [key(SHARP, 0, 0)];
    let now = [key(SOFT, 0, 0)];
    assert!(visible_losses(&was, &now, SOFT, EVERYWHERE).is_empty());
}

#[test]
fn a_coarse_underlay_beneath_sharp_tiles_is_not_a_loss() {
    let was = [key(SHARP, 0, 0)];
    let now = [key(SOFT, 0, 0), key(SHARP, 0, 0)];
    assert!(visible_losses(&was, &now, SHARP, EVERYWHERE).is_empty());
}

mod settling {
    use gpu_core::retained::Camera;
    use gpu_core::tiles::{step_zoom, Tiles};
    use gpu_core::watch::visible_losses;
    use super::EVERYWHERE;

    const SCREEN: (u32, u32) = (1024, 768);

    fn at(step: i32) -> Camera {
        Camera { x: 0.0, y: 0.0, zoom: step_zoom(step) * 0.9 }
    }

    #[test]
    fn the_first_still_frame_never_shows_less_than_the_gesture_left() {
        for finer in 1..=6 {
            let mut tiles = Tiles::default();
            let camera = at(0);
            let fine = tiles.frame(Camera { zoom: step_zoom(finer), ..camera }, SCREEN).missing;
            fine.iter().for_each(|k| tiles.hold(*k));
            let coarse = tiles.frame(Camera { zoom: step_zoom(-3), ..camera }, SCREEN).missing;
            coarse.iter().for_each(|k| tiles.hold(*k));

            let moving = tiles.gesture_frame(camera, SCREEN).draw;
            let settled = tiles.frame(camera, SCREEN);
            let still: Vec<_> = settled.beneath.iter().chain(&settled.draw).copied().collect();

            let lost = visible_losses(&moving, &still, tiles.sharp_enough(camera), EVERYWHERE);
            assert!(lost.is_empty(), "finer {finer}: {} lost, moving {} still {}", lost.len(), moving.len(), still.len());
        }
    }
}

#[test]
fn what_lies_outside_the_visible_area_is_never_a_loss() {
    let was = [key(SOFT, 0, 0)];
    let now = [key(SHARP, 0, 0)];
    let corner = key(SHARP, 0, 0).world();

    assert!(visible_losses(&was, &now, SHARP, corner).is_empty());
}
