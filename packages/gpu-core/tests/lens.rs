use gpu_core::display_list::{parse, Item};
#[cfg(feature = "gpu")]
use gpu_core::pictures::Pictures;

#[cfg(feature = "gpu")]
const SIZE: usize = 64;

fn lens(presence: f32) -> String {
    format!(
        r#"{{
  "width": 64, "height": 64, "background": [0, 0, 0, 1],
  "items": [
    {{ "kind": "path", "clip": "paper", "contours": [[0, 0, 64, 0, 64, 64, 0, 64]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }},
    {{ "kind": "lens", "clip": "blob", "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal",
      "lens": {{ "center": [32, 32], "drops": [32, 32, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0], "unwarp": [1, 0, 1], "blend": 7, "wobble": 0, "wobbleSpeed": 0,
        "ior": 1.5, "dispersion": 0, "frost": 0, "reflection": 0, "tintAmount": 0, "presence": {presence}, "tint": [1, 1, 1],
        "box": [8, 8, 48, 48], "time": 0, "seed": 7 }} }}
  ]
}}"#
    )
}

#[cfg(feature = "gpu")]
fn grey(pixels: &[u8], x: usize, y: usize) -> u8 {
    pixels[(y * SIZE + x) * 4]
}

#[cfg(feature = "gpu")]
fn render(json: &str) -> Vec<u8> {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    renderer.render(&parse(json).unwrap(), &Pictures::new()).unwrap().pixels
}

#[test]
fn a_lens_item_parses_with_its_pose() {
    let list = parse(&lens(1.0)).unwrap();

    let Item::Lens(item) = &list.items[1] else { panic!("expected a lens") };
    assert_eq!(item.lens.center, [32.0, 32.0]);
    assert_eq!(item.lens.params().len(), 35);
}

#[cfg(feature = "gpu")]
#[test]
fn a_lens_shows_the_content_through_its_middle_and_shades_below_it() {
    let pixels = render(&lens(1.0));

    assert!(grey(&pixels, 32, 32) > 200);
    assert!(grey(&pixels, 35, 46) < 200);
    assert_eq!(grey(&pixels, 2, 2), 255);
}

#[cfg(feature = "gpu")]
#[test]
fn an_absent_lens_leaves_the_content_alone() {
    let pixels = render(&lens(0.0));

    assert_eq!(grey(&pixels, 35, 46), 255);
}
