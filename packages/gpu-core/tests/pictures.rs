use gpu_core::display_list::{parse, Item};
use gpu_core::display_list::Size;
use gpu_core::pictures::{crop_rect, tile_cells, Pictures, Placed, MAX_TILES};
#[cfg(feature = "gpu")]
use gpu_core::pictures::picture;
use gpu_core::scene::{build, Layers};

#[cfg(feature = "gpu")]
const RED: [u8; 4] = [255, 0, 0, 255];
#[cfg(feature = "gpu")]
const GREEN: [u8; 4] = [0, 255, 0, 255];
#[cfg(feature = "gpu")]
const BLUE: [u8; 4] = [0, 0, 255, 255];

fn list(fit: &str, clipped: bool) -> String {
    format!(
        r#"{{
  "width": 64, "height": 64, "background": [0, 0, 1, 1],
  "items": [
    {{ "kind": "image", "clip": "pic", "src": "x", "video": false, "mediaTime": 0, "size": {{ "width": 32, "height": 32 }},
      "fit": "{fit}", "focus": [0.5, 0.5], "zoom": 1, "clipped": {clipped}, "inner": [1, 0, 0, 1, 0, 0],
      "opacity": 1, "matrix": [1, 0, 0, 1, 16, 16], "blur": 0, "blend": "normal" }}
  ]
}}"#
    )
}

#[cfg(feature = "gpu")]
fn halves() -> Pictures {
    let row: Vec<u8> = [RED, RED, GREEN, GREEN].concat();
    Pictures::from([("pic".to_string(), picture(4, 2, [row.clone(), row].concat()))])
}

#[cfg(feature = "gpu")]
fn at(pixels: &[u8], x: usize, y: usize) -> [u8; 4] {
    pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4].try_into().unwrap()
}

#[test]
fn parses_an_image_item() {
    let parsed = parse(&list("cover", true)).unwrap();

    assert!(matches!(&parsed.items[0], Item::Image(i) if i.fit == "cover" && i.size.width == 32.0));
}

#[test]
fn an_image_without_its_picture_is_skipped_by_name() {
    let (_, skipped) = build(&parse(&list("cover", true)).unwrap(), &Pictures::new(), &Layers::new());

    assert_eq!(skipped.len(), 1);
    assert_eq!(skipped[0].what, "image");
}

#[cfg(feature = "gpu")]
#[test]
fn cover_fills_the_box_and_crops_to_it() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&parse(&list("cover", true)).unwrap(), &halves()).unwrap().pixels;

    assert_eq!(at(&pixels, 18, 32), RED);
    assert_eq!(at(&pixels, 45, 32), GREEN);
    assert_eq!(at(&pixels, 32, 17), at(&pixels, 32, 46));
    assert_eq!(at(&pixels, 8, 32), BLUE);
    assert_eq!(at(&pixels, 56, 32), BLUE);
}

#[cfg(feature = "gpu")]
#[test]
fn contain_leaves_the_box_edges_empty() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&parse(&list("contain", true)).unwrap(), &halves()).unwrap().pixels;

    assert_eq!(at(&pixels, 20, 32), RED);
    assert_eq!(at(&pixels, 32, 18), BLUE);
    assert_eq!(at(&pixels, 32, 45), BLUE);
}

#[cfg(feature = "gpu")]
#[test]
fn an_unclipped_picture_spills_past_its_box() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&parse(&list("cover", false)).unwrap(), &halves()).unwrap().pixels;

    assert_eq!(at(&pixels, 4, 32), RED);
    assert_eq!(at(&pixels, 60, 32), GREEN);
}

const BOX: Size = Size { width: 200.0, height: 100.0 };
const SQUARE: Size = Size { width: 100.0, height: 100.0 };

#[test]
fn a_crop_window_stretches_the_picture_so_it_fills_the_box() {
    let placed = crop_rect(BOX, [0.25, 0.5, 0.5, 0.25]);

    assert_eq!(placed, Placed { x: -100.0, y: -200.0, width: 400.0, height: 400.0 });
}

#[test]
fn tiles_are_a_quarter_of_the_box_wide_per_unit_of_scale_placed_by_focus() {
    let cells = tile_cells(BOX, SQUARE, 2.0, 0.0, [0.5, 0.5]);

    assert_eq!(
        cells,
        vec![
            Placed { x: -50.0, y: 0.0, width: 100.0, height: 100.0 },
            Placed { x: 50.0, y: 0.0, width: 100.0, height: 100.0 },
            Placed { x: 150.0, y: 0.0, width: 100.0, height: 100.0 },
        ]
    );
}

#[test]
fn a_rotated_box_needs_more_tiles_to_reach_its_corners() {
    assert!(tile_cells(BOX, SQUARE, 2.0, 45.0, [0.5, 0.5]).len() > tile_cells(BOX, SQUARE, 2.0, 0.0, [0.5, 0.5]).len());
}

#[test]
fn tiling_never_asks_for_more_cells_than_the_limit() {
    let wide = Size { width: 1000.0, height: 1.0 };

    assert_eq!(tile_cells(Size { width: 1000.0, height: 1000.0 }, wide, 0.1, 0.0, [0.5, 0.5]).len(), MAX_TILES);
}

#[test]
fn parses_a_crop_window_and_a_tile_turn() {
    let json = list("crop", false).replace(r#""zoom": 1,"#, r#""zoom": 1, "crop": [0.1, 0.2, 0.5, 0.4], "tileTurn": 30,"#);

    assert!(matches!(&parse(&json).unwrap().items[0], Item::Image(i) if i.crop == Some([0.1, 0.2, 0.5, 0.4]) && i.tile_turn == 30.0));
}

#[test]
fn an_image_item_from_before_has_no_crop_and_no_turn() {
    assert!(matches!(&parse(&list("cover", true)).unwrap().items[0], Item::Image(i) if i.crop.is_none() && i.tile_turn == 0.0));
}

#[cfg(feature = "gpu")]
#[test]
fn a_gpu_picture_is_copied_again_only_when_its_change_is_announced() {
    use gpu_core::render::Change;
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let list = parse(&list("fill", true)).unwrap();
    let mut shown = |rgba: [u8; 4], change: Change| {
        let image = renderer.picture("pic", 2, 2, &rgba.repeat(4), change);
        at(&renderer.render(&list, &Pictures::from([("pic".to_string(), image)])).unwrap().pixels, 32, 32)
    };

    assert_eq!(shown(RED, Change::Announced), RED);
    assert_eq!(shown(GREEN, Change::Unannounced), RED);
    assert_eq!(shown(BLUE, Change::Announced), BLUE);
}
