use gpu_core::display_list::{parse, Item};
use gpu_core::pictures::Pictures;
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
