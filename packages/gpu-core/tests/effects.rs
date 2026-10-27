use gpu_core::colour::rgba_of;
use gpu_core::display_list::{parse, Filter, Item};
use gpu_core::turbulence::{lattice_of, stitched_frequency, LATTICE};

fn square(extra: &str) -> String {
    format!(
        r#"{{
  "width": 64, "height": 64, "background": [0, 0, 0, 1],
  "items": [
    {{ "kind": "path", "clip": "sq", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
      "space": [1, 0, 0, 1], "filters": [{extra}] }}
  ]
}}"#
    )
}

#[test]
fn reads_css_colours_like_the_ts_backend() {
    assert_eq!(rgba_of("#ff0000"), Some([1.0, 0.0, 0.0, 1.0]));
    assert_eq!(rgba_of("#0f08"), Some([0.0, 1.0, 0.0, 0x88 as f32 / 255.0]));
    assert_eq!(rgba_of("rgba(255, 0, 0, 0.5)"), Some([1.0, 0.0, 0.0, 0.5]));
    assert_eq!(rgba_of("transparent"), Some([0.0, 0.0, 0.0, 0.0]));
    assert_eq!(rgba_of("tomato"), None);
}

#[test]
fn the_noise_lattice_matches_the_ts_backend() {
    let l = lattice_of(7.0);

    assert_eq!(l.selector.len(), LATTICE);
    assert_eq!([l.selector[0], l.selector[1], l.selector[255], l.selector[300]], [250, 41, 97, 172]);
    assert!((l.gradients[0] - 0.809_942_1).abs() < 1e-6);
    assert!((l.gradients[1] + 0.586_509_8).abs() < 1e-6);
    assert!((l.gradients[2 * LATTICE + 10] + 0.959_737_4).abs() < 1e-6);
    assert!((stitched_frequency(0.013, 300.0) - 0.013_333_333).abs() < 1e-8);
}

#[test]
fn parses_css_and_svg_filters() {
    let list = parse(&square(r#"{ "kind": "css", "fns": [{ "name": "brightness", "args": ["0.5"] }] },
      { "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [{ "tag": "feOffset", "attrs": { "dx": 4, "dy": "0" } }] }] }"#))
    .unwrap();

    let Item::Path(p) = &list.items[0] else { panic!() };
    let filters = p.look.filters.as_ref().unwrap();
    assert!(matches!(&filters[0], Filter::Css { fns } if fns[0].name == "brightness"));
    assert!(matches!(&filters[1], Filter::Svg { nodes } if nodes[0].children[0].tag == "feOffset"));
}

#[cfg(feature = "gpu")]
mod gpu {
    use super::square;
    use gpu_core::display_list::parse;
    use gpu_core::pictures::Pictures;
    use gpu_core::render::Renderer;

    fn render(json: &str) -> Vec<u8> {
        let mut renderer = Renderer::new().expect("a GPU adapter");
        let rendered = renderer.render(&parse(json).unwrap(), &Pictures::new()).unwrap();
        assert!(rendered.skipped.is_empty(), "{:?}", rendered.skipped);
        rendered.pixels
    }

    fn px(pixels: &[u8], x: usize, y: usize) -> [u8; 4] {
        pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4].try_into().unwrap()
    }

    #[test]
    fn brightness_scales_the_colour() {
        let pixels = render(&square(r#"{ "kind": "css", "fns": [{ "name": "brightness", "args": ["0.5"] }] }"#));

        assert!((126..=129).contains(&px(&pixels, 32, 32)[0]));
    }

    #[test]
    fn a_discrete_transfer_steps_the_colour() {
        let pixels = render(&square(
            r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
          { "tag": "feComponentTransfer", "attrs": {}, "children": [
            { "tag": "feFuncR", "attrs": { "type": "discrete", "tableValues": "0 1" } },
            { "tag": "feFuncG", "attrs": { "type": "discrete", "tableValues": "0.2 0.4 0.6" } } ] } ] }] }"#,
        ));

        assert_eq!(px(&pixels, 32, 32)[0], 255);
        assert!((152..=154).contains(&px(&pixels, 32, 32)[1]));
    }

    #[test]
    fn an_offset_moves_the_item() {
        let pixels = render(&square(r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [{ "tag": "feOffset", "attrs": { "dx": 8, "dy": 0 } }] }] }"#));

        assert_eq!(px(&pixels, 20, 32)[0], 0);
        assert_eq!(px(&pixels, 52, 32)[0], 255);
    }

    #[test]
    fn a_flood_composited_in_takes_the_item_shape() {
        let pixels = render(&square(
            r##"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
          { "tag": "feFlood", "attrs": { "flood-color": "#00ff00", "result": "f" } },
          { "tag": "feComposite", "attrs": { "in": "f", "in2": "SourceGraphic", "operator": "in" } } ] }] }"##,
        ));

        assert_eq!(px(&pixels, 32, 32), [0, 255, 0, 255]);
        assert_eq!(px(&pixels, 8, 8), [0, 0, 0, 255]);
    }

    #[test]
    fn a_primitive_subregion_keeps_its_output_inside_the_region() {
        let pixels = render(&square(r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [{ "tag": "feOffset", "attrs": { "dx": 0, "dy": 0, "x": 0, "y": 0, "width": 32, "height": 64 } }] }] }"#));

        assert_eq!(px(&pixels, 20, 32)[0], 255);
        assert_eq!(px(&pixels, 40, 32)[0], 0);
    }

    #[test]
    fn a_primitive_subregion_follows_the_filter_space_and_origin() {
        let json = square(r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [{ "tag": "feOffset", "attrs": { "dx": 0, "dy": 0, "x": 0, "y": 0, "width": 32, "height": 128 } }] }] }"#)
            .replace(r#""space": [1, 0, 0, 1]"#, r#""space": [0.5, 0, 0, 0.5], "origin": [16, 0]"#);
        let pixels = render(&json);

        assert_eq!(px(&pixels, 24, 32)[0], 255);
        assert_eq!(px(&pixels, 40, 32)[0], 0);
    }

    #[test]
    fn a_drop_shadow_lands_beside_the_item() {
        let pixels = render(&square(r##"{ "kind": "css", "fns": [{ "name": "drop-shadow", "args": ["8px", "0px", "0px", "#ff0000"] }] }"##));

        assert_eq!(px(&pixels, 52, 32), [255, 0, 0, 255]);
        assert_eq!(px(&pixels, 32, 32), [255, 255, 255, 255]);
    }

    #[test]
    fn turbulence_fills_its_region_with_noise() {
        let pixels = render(&square(
            r#"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
          { "tag": "feTurbulence", "attrs": { "type": "fractalNoise", "baseFrequency": "0.2", "numOctaves": 2, "seed": 3 } } ] }] }"#,
        ));
        let distinct: std::collections::HashSet<[u8; 4]> = (0..64).map(|x| px(&pixels, x, 10)).collect();

        assert!(distinct.len() > 8);
    }

    #[test]
    fn turbulence_samples_where_the_browser_does_one_pixel_past_the_corner() {
        let json = r#"{ "width": 64, "height": 64, "background": null, "items": [
    { "kind": "path", "clip": "sq", "contours": [[0, 0, 64, 0, 64, 64, 0, 64]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
      "space": [1, 0, 0, 1], "filters": [{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
        { "tag": "feTurbulence", "attrs": { "type": "fractalNoise", "baseFrequency": "0.25", "numOctaves": 1, "seed": 3,
          "x": 0, "y": 0, "width": 64, "height": 64, "stitchTiles": "stitch" } } ] }] }] } ] }"#;
        let pixels = render(json);
        let near = |a: [u8; 4], b: [u8; 4]| a.iter().zip(b).all(|(x, y)| (*x as i32 - y as i32).abs() <= 3);

        assert!(near(px(&pixels, 0, 0), [132, 122, 103, 126]), "{:?}", px(&pixels, 0, 0));
        assert!(near(px(&pixels, 20, 10), [120, 132, 138, 99]), "{:?}", px(&pixels, 20, 10));
    }
    fn warped(attrs: &str) -> Vec<u8> {
        render(&square(&format!(r#"{{ "kind": "svg", "nodes": [{{ "tag": "filter", "attrs": {{}}, "children": [{{ "tag": "feWarp", "attrs": {{ "cx": 0.5, "cy": 0.5, {attrs} }} }}] }}] }}"#)))
    }

    #[test]
    fn a_bulge_pulls_the_square_edge_outward() {
        let pixels = warped(r#""mode": "bulge", "radius": 32, "amount": 0.9"#);

        assert_eq!(px(&pixels, 14, 32)[0], 255);
        assert_eq!(px(&pixels, 2, 32)[0], 0);
    }

    #[test]
    fn a_twirl_turns_the_corner_away() {
        let pixels = warped(r#""mode": "twirl", "radius": 32, "amount": 90"#);

        assert_eq!(px(&pixels, 17, 17)[0], 0);
        assert_eq!(px(&pixels, 32, 32)[0], 255);
    }

    #[test]
    fn a_zoom_blur_smears_the_square_outward() {
        let pixels = warped(r#""mode": "radial", "radius": 1, "amount": 0.5, "spin": 0"#);

        assert!((10..245).contains(&px(&pixels, 12, 32)[0]));
        assert_eq!(px(&pixels, 32, 32)[0], 255);
    }

    #[test]
    fn a_lens_blur_softens_the_edge() {
        let pixels = warped(r#""mode": "lens", "radius": 1, "amount": 6, "boost": 1"#);

        assert!((10..245).contains(&px(&pixels, 15, 32)[0]));
    }
}
