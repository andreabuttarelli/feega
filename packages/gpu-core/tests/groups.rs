use gpu_core::display_list::{parse, Item};
use gpu_core::groups::{expand, Groups};

const FRAME: &str = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [
  { "kind": "path", "clip": "card", "contours": [[10, 10, 20, 10, 20, 20, 10, 20]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 5, 0], "blend": "normal", "blur": 2,
    "space": [1, 0, 0, 1], "scissor": [0, 0, 50, 50] } ] }"#;

const SCREEN: &str = r#"{ "width": 400, "height": 300, "background": [0, 0, 0, 1], "items": [
  { "kind": "use", "clip": "f1", "group": "frame-1", "matrix": [2, 0, 0, 2, 30, 40] },
  { "kind": "use", "clip": "gone", "group": "missing", "matrix": [1, 0, 0, 1, 0, 0] } ] }"#;

fn groups() -> Groups {
    let mut groups = Groups::new();
    groups.put("frame-1", parse(FRAME).unwrap());
    groups
}

#[test]
fn a_use_places_its_group_through_its_matrix() {
    let (list, missing) = expand(&parse(SCREEN).unwrap(), &groups());
    let Item::Path(card) = &list.items[1] else { panic!("{:?}", list.items) };

    assert_eq!(card.look.matrix, [2.0, 0.0, 0.0, 2.0, 40.0, 40.0]);
    assert_eq!(card.look.blur, 4.0);
    assert_eq!(card.look.space, Some([2.0, 0.0, 0.0, 2.0]));
    assert_eq!(missing, vec!["missing".to_string()]);
}

#[test]
fn a_use_clips_to_its_frame_on_screen_and_paints_the_frame_background() {
    let (list, _) = expand(&parse(SCREEN).unwrap(), &groups());
    let Item::Path(back) = &list.items[0] else { panic!() };
    let Item::Path(card) = &list.items[1] else { panic!() };

    assert_eq!(back.look.scissor, Some([30.0, 40.0, 230.0, 140.0]));
    assert_eq!(card.look.scissor, Some([30.0, 40.0, 130.0, 140.0]));
}

#[cfg(feature = "gpu")]
#[test]
fn a_put_group_is_drawn_where_its_use_places_it() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    renderer.put_group("frame-1", parse(FRAME).unwrap());
    let rendered = renderer.render(&parse(SCREEN).unwrap(), &gpu_core::pictures::Pictures::new()).unwrap();
    let at = |x: usize, y: usize| rendered.pixels[(y * 400 + x) * 4..(y * 400 + x) * 4 + 4].to_vec();

    assert!(at(70, 70)[0] > 240 && at(70, 70)[2] < 15);
    assert_eq!(at(200, 120), vec![0, 0, 255, 255]);
    assert_eq!(at(300, 250), vec![0, 0, 0, 255]);
    assert!(rendered.skipped.iter().any(|s| s.clip == "missing" && s.what == "group"));
}

#[test]
fn a_list_without_uses_is_left_as_it_is() {
    let (list, _) = expand(&parse(FRAME).unwrap(), &Groups::new());

    assert_eq!(list.items.len(), 1);
}
