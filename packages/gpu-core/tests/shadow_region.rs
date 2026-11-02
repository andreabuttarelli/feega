#[cfg(feature = "gpu")]
mod gpu {
    use gpu_core::display_list::parse;
    use gpu_core::pictures::Pictures;
    use gpu_core::render::Renderer;

    fn placed(width: u32, height: u32, x: f64, y: f64) -> String {
        format!(
            r#"{{ "width": {width}, "height": {height}, "background": [0.92, 0.92, 0.92, 1], "items": [
  {{ "kind": "path", "clip": "card", "contours": [[0, 0, 200, 0, 200, 140, 0, 140]], "rule": "nonzero",
    "paint": {{ "kind": "solid", "color": [0.85, 0.85, 0.85, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, {x}, {y}], "blend": "normal",
    "space": [1, 0, 0, 1], "origin": [{x}, {y}],
    "filters": [{{ "kind": "css", "fns": [{{ "name": "drop-shadow", "args": ["20px", "20px", "40px", "rgba(0,0,0,0.25)"] }}] }}] }} ] }}"#
        )
    }

    fn red(pixels: &[u8], width: u32, x: u32, y: u32) -> u8 {
        pixels[((y * width + x) * 4) as usize]
    }

    #[test]
    fn a_thin_strip_beside_a_shape_repaints_the_shadow_cast_into_it() {
        let mut renderer = Renderer::new().expect("a GPU adapter");
        let whole = renderer.render(&parse(&placed(418, 358, 109.0, 109.0)).unwrap(), &Pictures::new()).unwrap().pixels;
        let strip = renderer.render(&parse(&placed(6, 146, -197.0, 3.0)).unwrap(), &Pictures::new()).unwrap().pixels;

        let (x, y) = (311, 200);
        assert_eq!(red(&strip, 6, x - 306, y - 106), red(&whole, 418, x, y));
    }
}
