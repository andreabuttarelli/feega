use vello::kurbo::{Affine, BezPath, Point};
use vello::peniko::{Color, Fill};
use vello::Scene;

use gpu_core::engine::fullness;
use gpu_core::tiles::{split_render, Piece, Rendered, MAX_SPLITS};

fn covered(pieces: &[Piece]) -> u64 {
    pieces.iter().map(|p| p.w as u64 * p.h as u64).sum()
}

fn area(p: Piece) -> f64 {
    p.w as f64 * p.h as f64
}

fn disjoint(pieces: &[Piece]) -> bool {
    pieces.iter().all(|a| pieces.iter().filter(|b| *b != a).all(|b| a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y))
}

#[test]
fn a_render_that_fits_is_one_piece() {
    let pieces = split_render((772, 772), |_| Rendered { fullness: 0.5 });

    assert_eq!(pieces, vec![Piece { x: 0, y: 0, w: 772, h: 772 }]);
}

#[test]
fn an_overflowing_render_is_split_in_halves_until_each_fits() {
    let mut tried = Vec::new();
    let pieces = split_render((772, 516), |p| {
        tried.push(p);
        Rendered { fullness: area(p) / 100_000.0 }
    });

    assert_eq!(covered(&pieces), 772 * 516);
    assert!(pieces.iter().all(|p| p.w as u64 * p.h as u64 <= 100_000));
    assert_eq!(tried[1], Piece { x: 0, y: 0, w: 386, h: 516 });
    assert!(disjoint(&pieces));
}

#[test]
fn splitting_stops_after_twelve_halvings() {
    let mut deepest = 0;
    let pieces = split_render((4096, 4096), |p| {
        deepest = deepest.max(4096 * 4096 / (p.w as u64 * p.h as u64));
        Rendered { fullness: 1e9 * area(p) / (4096.0 * 4096.0) }
    });

    assert_eq!(deepest, 1 << MAX_SPLITS);
    assert_eq!(covered(&pieces), 4096 * 4096);
}

fn dense(segments: usize) -> Scene {
    let mut path = BezPath::new();
    path.move_to(Point::new(0.0, 0.0));
    for i in 0..segments {
        path.line_to(Point::new((i % 700) as f64, (i / 700 % 700) as f64 + (i % 2) as f64));
    }
    path.close_path();
    let mut scene = Scene::new();
    scene.fill(Fill::NonZero, Affine::IDENTITY, Color::BLACK, None, &path);
    scene
}

#[test]
fn a_huge_scene_overflows_vellos_buffers_and_a_small_one_does_not() {
    assert!(fullness(&dense(1_000)) <= 1.0);
    assert!(fullness(&dense(2_200_000)) > 1.0);
}

fn landing_batch_at_close_zoom() -> Scene {
    let mut path = BezPath::new();
    path.move_to(Point::new(0.0, 0.0));
    for i in 0..14_000 {
        path.line_to(Point::new(if i % 2 == 0 { 800.0 } else { 0.0 }, 0.0));
    }
    let mut scene = Scene::new();
    scene.fill(Fill::NonZero, Affine::IDENTITY, Color::BLACK, None, &path);
    scene
}

#[test]
fn a_scene_within_the_segment_buffers_is_not_split() {
    let scene = landing_batch_at_close_zoom();
    let segments = scene.bump_estimate(None).segments.len();

    assert!(segments > 1 << 18 && segments < 1 << 21, "{segments}");
    assert!(fullness(&scene) <= 1.0);
}

#[test]
fn a_tile_takes_from_each_piece_only_what_they_share() {
    let tile = Piece { x: 256, y: 0, w: 260, h: 260 };

    assert_eq!(tile.overlap(Piece { x: 0, y: 0, w: 386, h: 772 }), Some(Piece { x: 256, y: 0, w: 130, h: 260 }));
    assert_eq!(tile.overlap(Piece { x: 0, y: 300, w: 772, h: 472 }), None);
}
