use gpu_text::{lay_out, Flow, Fonts, Laid, Source, Spaces, Type};

const DM_SANS: &[u8] = include_bytes!("../../../static/fonts/dm-sans-latin.woff2");
const SIZE: f32 = 100.0;
const WIDE: f32 = 100_000.0;
const WRAPPING: Flow = Flow { spaces: Spaces::Collapse, wraps: true };

fn fonts() -> Fonts {
    let mut fonts = Fonts::new();
    fonts.register("DM Sans", &Source::from_bytes(DM_SANS).unwrap());
    fonts
}

fn type_(tracking: f32) -> Type {
    Type { family: "DM Sans".into(), weight: 400.0, italic: false, axes: vec![], size: SIZE, tracking, leading: 1.2 }
}

fn lay(text: &str, tracking: f32, flow: Flow, room: f32) -> Laid {
    lay_out(&text.split('\n').collect::<Vec<_>>(), &type_(tracking), flow, room, &mut fonts())
}

#[test]
fn breaks_greedily_at_spaces() {
    let one = lay("aa bb cc", 0.0, WRAPPING, WIDE);
    let narrow = lay("aa bb cc", 0.0, WRAPPING, one.width * 0.7);

    assert_eq!(one.lines.len(), 1);
    assert_eq!(narrow.lines.len(), 2);
}

#[test]
fn runs_past_the_room_when_it_may_not_wrap() {
    assert_eq!(lay("aa bb cc", 0.0, Flow { spaces: Spaces::Keep, wraps: false }, 1.0).lines.len(), 1);
}

#[test]
fn collapses_runs_of_spaces_unless_they_are_kept() {
    let collapsed = lay("a     b", 0.0, WRAPPING, WIDE).width;
    let kept = lay("a     b", 0.0, Flow { spaces: Spaces::Keep, wraps: true }, WIDE).width;

    assert!(kept > collapsed);
}

#[test]
fn tracks_after_every_character() {
    let plain = lay("abc", 0.0, WRAPPING, WIDE).width;
    let tracked = lay("abc", 0.1, WRAPPING, WIDE).width;

    assert!((tracked - plain - 3.0 * 0.1 * SIZE).abs() < 0.5);
}

#[test]
fn stacks_paragraphs_one_line_height_apart() {
    let laid = lay("a\nb", 0.0, WRAPPING, WIDE);

    assert_eq!(laid.lines.len(), 2);
    assert!((laid.height - 2.0 * 1.2 * SIZE).abs() < 1.0);
    assert!((laid.lines[1].baseline - laid.lines[0].baseline - 1.2 * SIZE).abs() < 1.0);
}

#[test]
fn names_the_registered_face_of_every_glyph() {
    let laid = lay("ab", 0.0, WRAPPING, WIDE);

    assert_eq!(laid.lines[0].glyphs.len(), 2);
    assert!(laid.lines[0].glyphs.iter().all(|g| g.font == 0));
    assert!(laid.lines[0].glyphs[1].x > laid.lines[0].glyphs[0].x);
}
