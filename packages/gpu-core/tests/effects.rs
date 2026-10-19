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
}
