use gpu_core::display_list::{parse, Cover, Item, MaskMode};
use gpu_core::kernel::gaussian;
#[cfg(feature = "gpu")]
use gpu_core::pictures::{picture, Pictures};

#[cfg(feature = "gpu")]
const SIZE: usize = 64;

fn square(extra: &str) -> String {
    format!(
        r#"{{
  "width": 64, "height": 64, "background": [0, 0, 0, 1],
  "items": [
    {{ "kind": "path", "clip": "sq", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal"{extra} }}
  ]
}}"#
    )
}

const RECT_MASK: &str = r#", "blur": 0, "masks": [{ "mode": "add", "invert": false, "level": 1, "feather": 0,
  "cover": { "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [16, 0, 0, 64, 16, 0] } }]"#;

const MATTE: &str = r#", "blur": 0, "matte": { "luma": false, "invert": true, "items": [
  { "kind": "path", "clip": "m", "contours": [[0, 0, 32, 0, 32, 64, 0, 64]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#;

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
fn the_kernel_matches_the_ts_backend() {
    let k = gaussian(2.0);

    assert_eq!(k.step, 1);
    assert_eq!(k.weights.len(), 7);
    assert!((k.weights[0] - 0.1997).abs() < 1e-3);
    assert!((k.weights[0] + 2.0 * k.weights[1..].iter().sum::<f32>() - 1.0).abs() < 1e-5);
}

#[test]
fn wide_kernels_stride_to_stay_within_the_tap_budget() {
    let k = gaussian(60.0);

    assert_eq!(k.step, 3);
    assert!(k.weights.len() <= 64);
}

#[test]
fn parses_masks_and_mattes() {
    let masked = parse(&square(RECT_MASK)).unwrap();
    let matted = parse(&square(MATTE)).unwrap();

    let Item::Path(p) = &masked.items[0] else { panic!() };
    let layer = &p.look.masks.as_ref().unwrap()[0];
    assert_eq!(layer.mode, MaskMode::Add);
    assert!(matches!(layer.cover, Cover::Path { .. }));
    let Item::Path(m) = &matted.items[0] else { panic!() };
    assert_eq!(m.look.matte.as_ref().unwrap().items.len(), 1);
}

#[cfg(feature = "gpu")]
#[test]
fn blur_softens_the_edge_and_keeps_the_middle() {
    let pixels = render(&square(r#", "blur": 3"#));

    assert_eq!(grey(&pixels, 32, 32), 255);
    assert!((100..156).contains(&grey(&pixels, 16, 32)));
    assert!(grey(&pixels, 12, 32) > 0);
}

#[cfg(feature = "gpu")]
#[test]
fn a_mask_keeps_only_what_its_cover_covers() {
    let pixels = render(&square(RECT_MASK));

    assert_eq!(grey(&pixels, 24, 32), 255);
    assert_eq!(grey(&pixels, 40, 32), 0);
}

#[cfg(feature = "gpu")]
#[test]
fn an_inverted_alpha_matte_hides_what_the_matte_covers() {
    let pixels = render(&square(MATTE));

    assert_eq!(grey(&pixels, 20, 32), 0);
    assert_eq!(grey(&pixels, 40, 32), 255);
}

#[cfg(feature = "gpu")]
#[test]
fn a_picture_mask_keeps_what_its_picture_covers() {
    let json = square(
        r#", "blur": 0, "masks": [{ "mode": "add", "invert": false, "level": 1, "feather": 0,
  "cover": { "kind": "picture", "src": "p", "luma": false, "matrix": [16, 0, 0, 64, 16, 0] } }]"#,
    );
    let opaque = picture(1, 1, vec![255, 255, 255, 255]);
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&parse(&json).unwrap(), &Pictures::from([("p".to_string(), opaque)])).unwrap().pixels;

    assert_eq!(grey(&pixels, 24, 32), 255);
    assert_eq!(grey(&pixels, 40, 32), 0);
}

#[cfg(feature = "gpu")]
#[test]
fn a_picture_mask_survives_frames_that_grow_the_image_atlas() {
    let masked = r#", "blur": 0, "masks": [{ "mode": "add", "invert": false, "level": 1, "feather": 0,
  "cover": { "kind": "picture", "src": "p", "luma": false, "matrix": [16, 0, 0, 64, 16, 0] } }]"#;
    let item = |x: u32| format!(r#"{{ "kind": "path", "clip": "c{x}", "contours": [[{x}, 0, {x}, 0, {x}, 1, {x}, 1]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "blur": 2 }}"#);
    let crowded = |n: u32| {
        let extra: Vec<String> = (0..n).map(item).collect();
        let list = square(masked);
        if n == 0 {
            return list;
        }
        list.replacen("\n  ]", &format!(",\n{}\n  ]", extra.join(",\n")), 1)
    };
    let pictures = Pictures::from([("p".to_string(), picture(1, 1, vec![255, 255, 255, 255]))]);
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");

    for n in [0, 12, 0, 24, 1] {
        let pixels = renderer.render(&parse(&crowded(n)).unwrap(), &pictures).unwrap().pixels;
        assert_eq!(grey(&pixels, 24, 32), 255, "with {n} extra layers");
    }
}

#[cfg(feature = "gpu")]
#[test]
fn a_wipe_cuts_the_item_at_its_scissor() {
    let pixels = render(&square(r#", "scissor": [0, 0, 32, 64]"#));

    assert_eq!(grey(&pixels, 20, 32), 255);
    assert_eq!(grey(&pixels, 40, 32), 0);
}
