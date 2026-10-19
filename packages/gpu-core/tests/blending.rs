#![cfg(feature = "gpu")]

use gpu_core::display_list::parse;
use gpu_core::layers::Blending;
use gpu_core::pictures::Pictures;
use gpu_core::render::Renderer;

const POSTER: &str = r#"{ "width": 64, "height": 32, "background": null, "items": [
  { "kind": "group", "clip": "p", "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal", "items": [
    { "kind": "path", "clip": "p", "contours": [[0, 0, 64, 0, 64, 32, 0, 32]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [0.9, 0.8, 0.2, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" },
    { "kind": "path", "clip": "p", "contours": [[16, 0, 48, 0, 48, 32, 16, 32]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [0.2, 0.4, 0.9, 1] }, "opacity": 0.5, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "multiply",
      "masks": [{ "mode": "intersect", "invert": false, "level": 1, "feather": 0, "cover": { "kind": "path", "contours": [[0, 0, 64, 0, 64, 32, 0, 32]], "matrix": [1, 0, 0, 1, 0, 0] } }] } ] } ] }"#;

fn rendered(blending: Blending) -> Vec<u8> {
    let mut renderer = Renderer::new().expect("a GPU adapter").blending(blending);
    renderer.render(&parse(POSTER).unwrap(), &Pictures::new()).unwrap().pixels
}

fn at(pixels: &[u8], x: usize, y: usize) -> Vec<u8> {
    pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4].to_vec()
}

#[test]
fn a_blended_layer_composited_on_its_backdrop_matches_the_native_blend() {
    let native = rendered(Blending::Native);
    let composited = rendered(Blending::Composited);

    for (x, y) in [(4, 16), (32, 16), (60, 16)] {
        let (a, b) = (at(&native, x, y), at(&composited, x, y));
        assert!(a.iter().zip(&b).all(|(p, q)| p.abs_diff(*q) <= 2), "{x},{y}: {a:?} vs {b:?}");
    }
    assert_ne!(at(&native, 32, 16), at(&native, 4, 16));
}
