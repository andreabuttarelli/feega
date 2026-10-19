use gpu_core::{display_list::parse, scene::build, Skipped};

const SQUARE: &str = r#"{
  "width": 64, "height": 64, "background": [0, 0, 1, 1],
  "items": [
    { "kind": "path", "clip": "card", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" },
    { "kind": "image", "clip": "pic", "src": "x" }
  ]
}"#;

#[test]
fn parses_the_display_list_the_web_engine_writes() {
    let list = parse(SQUARE).unwrap();

    assert_eq!(list.items.len(), 2);
}

#[test]
fn names_the_items_it_does_not_draw_yet() {
    let (_, skipped) = build(&parse(SQUARE).unwrap());

    assert_eq!(skipped, vec![Skipped { clip: "pic".into(), what: "image".into() }]);
}

#[cfg(feature = "gpu")]
#[test]
fn paints_a_square_over_the_background() {
    let list = parse(SQUARE).unwrap();
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&list).unwrap();
    let at = |x: usize, y: usize| &pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4];

    assert_eq!(at(32, 32), &[255, 0, 0, 255]);
    assert_eq!(at(4, 4), &[0, 0, 255, 255]);
}
