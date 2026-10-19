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

const BLOB_FRAME: &str = r#"{ "width": 64, "height": 64, "background": [1, 1, 1, 1], "items": [
  { "kind": "path", "clip": "paper", "contours": [[0, 0, 64, 0, 64, 64, 0, 64]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" },
  { "kind": "lens", "clip": "blob", "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal",
    "lens": { "center": [32, 32], "drops": [32, 32, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0], "unwarp": [1, 0, 1], "blend": 24, "wobble": 2, "wobbleSpeed": 0,
      "ior": 1.5, "dispersion": 0, "frost": 4, "reflection": 1, "tintAmount": 0, "presence": 1, "tint": [1, 1, 1],
      "box": [-30, -30, 124, 124], "time": 0, "seed": 7 } } ] }"#;

const BLOB_SCREEN: &str = r#"{ "width": 256, "height": 256, "background": [0, 0, 0, 1], "items": [
  { "kind": "path", "clip": "other", "contours": [[0, 0, 8, 0, 8, 8, 0, 8]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" },
  { "kind": "use", "clip": "f", "group": "blob-frame", "matrix": [0.5, 0, 0, 0.5, 100, 100] } ] }"#;

#[test]
fn a_used_lens_is_placed_in_screen_space_inside_its_frame() {
    let mut groups = Groups::new();
    groups.put("blob-frame", parse(BLOB_FRAME).unwrap());
    let (list, _) = expand(&parse(BLOB_SCREEN).unwrap(), &groups);
    let Item::Lens(lens) = &list.items[3] else { panic!("{:?}", list.items) };

    assert_eq!(lens.lens.center, [116.0, 116.0]);
    assert_eq!(&lens.lens.drops[..3], &[116.0, 116.0, 20.0]);
    assert_eq!(lens.lens.blend, 12.0);
    assert_eq!(lens.lens.wobble, 1.0);
    assert_eq!(lens.lens.frost, 2.0);
    assert_eq!(lens.lens.area, [100.0, 100.0, 32.0, 32.0]);
    assert_eq!(lens.under, 2);
}

#[cfg(feature = "gpu")]
#[test]
fn a_used_lens_draws_nothing_outside_its_frame() {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    renderer.put_group("blob-frame", parse(BLOB_FRAME).unwrap());
    let rendered = renderer.render(&parse(BLOB_SCREEN).unwrap(), &gpu_core::pictures::Pictures::new()).unwrap();
    let at = |x: usize, y: usize| rendered.pixels[(y * 256 + x) * 4..(y * 256 + x) * 4 + 4].to_vec();

    assert_eq!(at(32, 32), vec![0, 0, 0, 255]);
    assert_eq!(at(90, 116), vec![0, 0, 0, 255]);
    assert_eq!(at(140, 140), vec![0, 0, 0, 255]);
    assert_ne!(at(116, 116), vec![0, 0, 0, 255]);
}

#[test]
fn a_list_without_uses_is_left_as_it_is() {
    let (list, _) = expand(&parse(FRAME).unwrap(), &Groups::new());

    assert_eq!(list.items.len(), 1);
}
