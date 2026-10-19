use gpu_core::display_list::{parse, Item};
use gpu_core::glyphs::{outline, Fonts};
use gpu_text::{Ligatures, Source};

const DM_SANS: &[u8] = include_bytes!("../../../static/fonts/dm-sans-latin.woff2");

fn letter_h() -> u32 {
    Source::from_bytes(DM_SANS).unwrap().at(&[]).shape("H", Ligatures::On)[0].glyph
}

fn list(glyph: u32, font: &str) -> String {
    format!(
        r#"{{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [
  {{ "kind": "glyphs", "clip": "title", "font": "{font}", "coords": [["wght", 600]], "size": 40,
     "glyphs": [[{glyph}, 12, 50]], "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }},
     "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }} ] }}"#
    )
}

fn fonts() -> Fonts {
    let mut fonts = Fonts::new();
    fonts.put("dm-sans", Source::from_bytes(DM_SANS).unwrap());
    fonts
}

#[test]
fn a_glyph_run_becomes_its_outline_at_its_size_and_baseline() {
    let (drawn, missing) = outline(&parse(&list(letter_h(), "dm-sans")).unwrap(), &fonts());
    let Item::Path(path) = &drawn.items[0] else { panic!("{:?}", drawn.items) };
    let ys: Vec<f64> = path.contours.iter().flat_map(|c| c.chunks(2).map(|p| p[1])).collect();
    let top = ys.iter().cloned().fold(f64::MAX, f64::min);
    let bottom = ys.iter().cloned().fold(f64::MIN, f64::max);

    assert!(missing.is_empty());
    assert!((bottom - 50.0).abs() < 0.5, "baseline at {bottom}");
    assert!((26.0..30.0).contains(&(bottom - top)), "cap height {}", bottom - top);
}

#[test]
fn a_run_in_a_font_never_put_is_named() {
    let (drawn, missing) = outline(&parse(&list(letter_h(), "nope")).unwrap(), &fonts());

    assert_eq!(missing, vec!["nope".to_string()]);
    assert!(matches!(drawn.items[0], Item::Other { .. }));
}

#[cfg(feature = "gpu")]
#[test]
fn text_renders_natively_without_a_browser() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    renderer.put_font("dm-sans", Source::from_bytes(DM_SANS).unwrap());
    let rendered = renderer.render(&parse(&list(letter_h(), "dm-sans")).unwrap(), &gpu_core::pictures::Pictures::new()).unwrap();
    let lit = rendered.pixels.chunks(4).filter(|p| p[0] > 200).count();

    assert!(rendered.skipped.is_empty(), "{:?}", rendered.skipped);
    assert!((150..600).contains(&lit), "{lit} lit pixels");
}
