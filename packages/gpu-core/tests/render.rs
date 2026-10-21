use gpu_core::{display_list::parse, pictures::Pictures, scene::{build, Layers}, Skipped};

const SQUARE: &str = r#"{
  "width": 64, "height": 64, "background": [0, 0, 1, 1],
  "items": [
    { "kind": "path", "clip": "card", "contours": [[16, 16, 48, 16, 48, 48, 16, 48]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" },
    { "kind": "layer", "clip": "pic", "source": "pic:canvas", "size": { "width": 8, "height": 8 }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" }
  ]
}"#;

#[test]
fn parses_the_display_list_the_web_engine_writes() {
    let list = parse(SQUARE).unwrap();

    assert_eq!(list.items.len(), 2);
}

#[test]
fn names_a_layer_whose_picture_never_arrived() {
    let (_, skipped) = build(&parse(SQUARE).unwrap(), &Pictures::new(), &Layers::new());

    assert_eq!(skipped, vec![Skipped { clip: "pic".into(), what: "layer".into() }]);
}

#[cfg(feature = "gpu")]
#[test]
fn paints_a_square_over_the_background() {
    let list = parse(SQUARE).unwrap();
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&list, &Pictures::new()).unwrap().pixels;
    let at = |x: usize, y: usize| &pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4];

    assert_eq!(at(32, 32), &[255, 0, 0, 255]);
    assert_eq!(at(4, 4), &[0, 0, 255, 255]);
}

#[cfg(feature = "gpu")]
fn dashes_in_one_frame(dashes: usize, side: u32) -> String {
    let dash = |i: usize| {
        let x = (i * 7) as u32 % side;
        let y = (i * 7) as u32 / side * 4;
        format!(
            r#"{{ "kind": "path", "clip": "frame", "contours": [[{x}, {y}, {}, {y}, {}, {}, {x}, {}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [1, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal", "scissor": [0, 0, {side}, {side}] }}"#,
            x + 4,
            x + 4,
            y + 2,
            y + 2
        )
    };
    let items: Vec<String> = (0..dashes).map(dash).collect();
    format!(r#"{{ "width": {side}, "height": {side}, "background": [0, 0, 1, 1], "items": [{}] }}"#, items.join(","))
}

#[cfg(feature = "gpu")]
#[test]
fn thousands_of_dashes_in_one_frame_still_draw() {
    let side = 1600;
    let list = parse(&dashes_in_one_frame(3000, side)).unwrap();
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let pixels = renderer.render(&list, &Pictures::new()).unwrap().pixels;
    let at = |x: usize, y: usize| &pixels[(y * side as usize + x) * 4..(y * side as usize + x) * 4 + 4];

    assert_eq!(at(1, 1), &[255, 0, 0, 255]);
    assert_eq!(at(side as usize - 1, side as usize - 1), &[0, 0, 255, 255]);
}
