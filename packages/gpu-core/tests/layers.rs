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
fn a_path_is_bounded_by_its_transformed_points() {
    let list = parse(&square(r#", "matrix": [2, 0, 0, 1, 4, 0]"#).replace(r#""matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "matrix""#, r#""blend": "normal", "matrix""#)).unwrap();

    let b = gpu_core::scene::bounds::<vello::Scene>(&list.items[0], &gpu_core::pictures::Pictures::new()).unwrap();
    assert_eq!((b.x0, b.y0, b.x1, b.y1), (36.0, 16.0, 100.0, 48.0));
}

#[test]
fn an_image_is_bounded_by_its_box_when_clipped() {
    let json = r#"{ "width": 64, "height": 64, "background": null, "items": [
    { "kind": "image", "clip": "pic", "src": "x", "video": false, "mediaTime": 0, "size": { "width": 20, "height": 10 },
      "fit": "cover", "focus": [0.5, 0.5], "zoom": 1, "clipped": true, "inner": [1, 0, 0, 1, 0, 0], "opacity": 1, "matrix": [1, 0, 0, 1, 5, 6], "blend": "normal" } ] }"#;
    let pictures = gpu_core::pictures::Pictures::from([("pic".to_string(), gpu_core::pictures::picture(1, 1, vec![0; 4]))]);

    let b = gpu_core::scene::bounds::<vello::Scene>(&parse(json).unwrap().items[0], &pictures).unwrap();
    assert_eq!((b.x0, b.y0, b.x1, b.y1), (5.0, 6.0, 25.0, 16.0));
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
fn a_backdrop_blurs_only_what_lies_under_the_item() {
    let json = r#"{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [
    { "kind": "path", "clip": "half", "contours": [[0, 0, 32, 0, 32, 64, 0, 64]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" },
    { "kind": "path", "clip": "glass", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 1, 1, 0] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "backdrop": 4 } ] }"#;
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let rendered = renderer.render(&parse(json).unwrap(), &Pictures::new()).unwrap();
    let pixels = rendered.pixels;

    assert!(rendered.skipped.is_empty());
    assert!((60..200).contains(&grey(&pixels, 32, 32)));
    assert_eq!(grey(&pixels, 30, 4), 255);
    assert_eq!(grey(&pixels, 34, 4), 0);
}

#[cfg(feature = "gpu")]
#[test]
fn a_picture_under_a_backdrop_stays_drawn_frame_after_frame() {
    let json = r#"{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [
    { "kind": "image", "clip": "under", "src": "u", "video": false, "mediaTime": 0, "size": { "width": 64, "height": 64 },
      "fit": "fill", "focus": [0.5, 0.5], "zoom": 1, "clipped": true, "inner": [1, 0, 0, 1, 0, 0], "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" },
    { "kind": "path", "clip": "glass", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 1, 1, 0] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "backdrop": 4 } ] }"#;
    let pictures = Pictures::from([("under".to_string(), picture(2, 2, vec![255; 16]))]);
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");

    for frame in 0..3 {
        let pixels = renderer.render(&parse(json).unwrap(), &pictures).unwrap().pixels;
        assert_eq!(grey(&pixels, 4, 4), 255, "frame {frame}");
    }
}

#[cfg(feature = "gpu")]
#[test]
fn a_wipe_cuts_the_item_at_its_scissor() {
    let pixels = render(&square(r#", "scissor": [0, 0, 32, 64]"#));

    assert_eq!(grey(&pixels, 20, 32), 255);
    assert_eq!(grey(&pixels, 40, 32), 0);
}

#[cfg(feature = "gpu")]
#[test]
fn a_remembered_layer_is_drawn_as_it_was_and_replaced_when_it_changes() {
    let soft = square(r#", "blur": 6"#);
    let softer = square(r#", "blur": 9"#);
    let mut shared = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let first = shared.render(&parse(&soft).unwrap(), &Pictures::new()).unwrap().pixels;
    let other = shared.render(&parse(&softer).unwrap(), &Pictures::new()).unwrap().pixels;
    let again = shared.render(&parse(&soft).unwrap(), &Pictures::new()).unwrap().pixels;

    assert_eq!(first, render(&soft));
    assert_eq!(other, render(&softer));
    assert_ne!(first, other);
    assert_eq!(again, first);
}

#[cfg(feature = "gpu")]
#[test]
fn a_frame_after_a_blurred_one_matches_a_fresh_renderer() {
    let blurred = square(r#", "blur": 6"#);
    let plain = square(RECT_MASK);
    let mut shared = gpu_core::render::Renderer::new().expect("a GPU adapter");
    shared.render(&parse(&blurred).unwrap(), &Pictures::new()).unwrap();
    let reused = shared.render(&parse(&plain).unwrap(), &Pictures::new()).unwrap().pixels;

    assert_eq!(reused, render(&plain));
}
