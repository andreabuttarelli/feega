#[cfg(feature = "gpu")]
mod gpu {
    use gpu_core::display_list::parse;
    use gpu_core::pictures::Pictures;
    use gpu_core::render::Renderer;

    fn gradient(to: &str) -> String {
        format!(
            r#"{{ "width": 64, "height": 16, "background": [0, 0, 0, 1], "items": [
  {{ "kind": "path", "clip": "g", "contours": [[0, 0, 64, 0, 64, 16, 0, 16]], "rule": "nonzero",
    "paint": {{ "kind": "linear", "from": [0, 0], "to": [64, 0], "stops": [{{ "at": 0, "color": [1, 0, 0, 1] }}, {{ "at": 1, "color": {to} }}] }},
    "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}
]}}"#
        )
    }

    #[test]
    fn unchanged_ramps_are_uploaded_once_and_a_new_gradient_still_draws() {
        let mut renderer = Renderer::new().expect("a GPU adapter");
        let blue = parse(&gradient("[0, 0, 1, 1]")).unwrap();
        let green = parse(&gradient("[0, 1, 0, 1]")).unwrap();
        let first = renderer.render(&blue, &Pictures::new()).unwrap().pixels;
        let again = renderer.render(&blue, &Pictures::new()).unwrap().pixels;
        let uploads = renderer.ramp_uploads();
        let changed = renderer.render(&green, &Pictures::new()).unwrap().pixels;
        let end = (8 * 64 + 63) * 4;

        assert_eq!(first, again);
        assert_eq!(uploads, 1);
        assert!(changed[end + 1] > 200 && changed[end + 2] < 50, "{:?}", &changed[end..end + 4]);
    }
}
