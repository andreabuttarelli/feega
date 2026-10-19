use std::collections::HashMap;

use gpu_text::{FaceBook, FaceRule, Request, Source};

const DM_SANS: &[u8] = include_bytes!("../../../static/fonts/dm-sans-latin.woff2");
const LATIN: (u32, u32) = (0, 0xff);
const EVERYTHING: (u32, u32) = (0, 0x10ffff);

fn rule(family: &str, weight: (f32, f32), source: &str, ranges: Vec<(u32, u32)>) -> FaceRule {
    FaceRule { family: family.into(), italic: false, weight, source: source.into(), ranges }
}

fn book() -> FaceBook {
    let dm = Source::from_bytes(DM_SANS).unwrap();
    let rules = vec![rule("DM Sans", (100.0, 1000.0), "dm", vec![LATIN]), rule("Brand", (700.0, 700.0), "brand-700", vec![EVERYTHING]), rule("Brand", (400.0, 400.0), "brand-400", vec![EVERYTHING])];
    let sources = HashMap::from([("dm".to_string(), dm.clone()), ("brand-700".to_string(), dm.clone()), ("brand-400".to_string(), dm)]);
    FaceBook::new(rules, sources)
}

fn ask(family: &str, weight: f32, code_point: char) -> Option<gpu_text::Resolved> {
    book().resolve(&Request { family: family.into(), weight, italic: false, size: 20.0, axes: vec![] }, code_point as u32)
}

#[test]
fn picks_the_rule_whose_range_and_file_hold_the_character() {
    assert!(ask("DM Sans", 400.0, 'a').is_some());
    assert!(ask("DM Sans", 400.0, 'Ā').is_none());
}

#[test]
fn drives_the_axes_the_font_has_then_the_explicit_ones() {
    let resolved = book().resolve(&Request { family: "DM Sans".into(), weight: 700.0, italic: false, size: 120.0, axes: vec![("wght".into(), 300.0)] }, 'a' as u32).unwrap();

    assert_eq!(resolved.face.coords(), &[("wght".to_string(), 300.0)]);
}

#[test]
fn matches_static_files_by_the_nearest_weight_like_the_browser() {
    assert_eq!(ask("Brand", 650.0, 'a').unwrap().rule, 1);
    assert_eq!(ask("Brand", 300.0, 'a').unwrap().rule, 2);
}

#[test]
fn slants_an_upright_face_when_italic_is_asked_and_none_is_there() {
    let slanted = book().resolve(&Request { family: "Brand".into(), weight: 400.0, italic: true, size: 20.0, axes: vec![] }, 'a' as u32).unwrap();

    assert!(slanted.skew > 0.0);
    assert_eq!(ask("Brand", 400.0, 'a').unwrap().skew, 0.0);
}

#[test]
fn finds_nothing_for_a_family_without_files() {
    assert!(ask("Missing", 400.0, 'a').is_none());
}
