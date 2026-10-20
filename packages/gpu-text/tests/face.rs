use gpu_text::{Ligatures, Op, Source};

const DM_SANS: &[u8] = include_bytes!("../../../static/fonts/dm-sans-latin.woff2");

fn source() -> Source {
    Source::from_bytes(DM_SANS).expect("dm sans decodes")
}

#[test]
fn decodes_a_web_font_and_reads_its_axes() {
    let source = source();

    assert!(source.axes().contains_key("wght"));
    assert!(source.covers('a' as u32));
    assert!(!source.covers('★' as u32));
}

#[test]
fn reads_the_metrics_the_browser_lays_lines_with() {
    let face = source().at(&[]);

    assert_eq!(face.units_per_em(), 1000);
    assert!(face.ascent() > 0.0 && face.descent() > 0.0);
}

#[test]
fn shapes_one_glyph_per_character_with_ligatures_off() {
    let face = source().at(&[]);
    let off = face.shape("fifl", Ligatures::Off);

    assert_eq!(off.len(), 4);
    assert!(off.iter().all(|g| g.chars == 1 && g.advance > 0.0));
    assert_eq!(face.shape("fifl", Ligatures::On).iter().map(|g| g.chars).sum::<u32>(), 4);
}

#[test]
fn widens_with_the_weight_axis() {
    let source = source();
    let light = source.at(&[("wght".into(), 300.0)]).shape("m", Ligatures::On)[0].advance;
    let bold = source.at(&[("wght".into(), 900.0)]).shape("m", Ligatures::On)[0].advance;

    assert!(bold > light);
}

#[test]
fn outlines_a_glyph_in_font_units_as_closed_contours() {
    let face = source().at(&[]);
    let glyph = face.shape("o", Ligatures::On)[0].glyph;
    let commands = face.outline(glyph);

    assert_eq!(commands.first().map(|c| c.op), Some(Op::Move));
    assert_eq!(commands.iter().filter(|c| c.op == Op::Close).count(), 2);
    assert!(commands.iter().flat_map(|c| c.at.chunks(2)).all(|p| p[1] <= face.ascent() && p[1] >= -face.descent()));
}
