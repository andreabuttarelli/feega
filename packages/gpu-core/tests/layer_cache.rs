#[cfg(feature = "gpu")]
use gpu_core::display_list::parse;
#[cfg(feature = "gpu")]
use gpu_core::pictures::Pictures;
#[cfg(feature = "gpu")]
use gpu_core::render::Renderer;

#[cfg(feature = "gpu")]
fn blurred_group(paths: usize) -> String {
    let items: Vec<String> = (0..paths)
        .map(|i| format!(r#"{{ "kind": "path", "clip": "p{i}", "contours": [[{x}, 10, {x2}, 10, {x2}, 20, {x}, 20]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [1, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#, x = i as f64 * 0.1, x2 = i as f64 * 0.1 + 5.0))
        .collect();
    format!(r#"{{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [{{ "kind": "group", "clip": "glow", "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 2, "blend": "normal", "items": [{}] }}] }}"#, items.join(","))
}

#[cfg(feature = "gpu")]
fn layers_kept_after_drawing(paths: usize) -> usize {
    let mut renderer = Renderer::new().expect("a GPU adapter");
    renderer.render(&parse(&blurred_group(paths)).unwrap(), &Pictures::new()).unwrap();
    renderer.cached_layers()
}

#[cfg(feature = "gpu")]
#[test]
fn a_light_blurred_group_keeps_its_layer_for_the_next_frame() {
    assert_eq!(layers_kept_after_drawing(10), 1);
}

#[cfg(feature = "gpu")]
#[test]
fn a_heavy_blurred_group_is_redrawn_instead_of_keyed() {
    assert_eq!(layers_kept_after_drawing(400), 0);
}
