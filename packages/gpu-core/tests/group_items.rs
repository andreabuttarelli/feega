use gpu_core::display_list::{parse, Item};
use gpu_core::groups::{expand, Groups};
#[cfg(feature = "gpu")]
use gpu_core::pictures::{picture, Pictures};

const SQUARE: &str = r#"{ "kind": "path", "clip": "c", "contours": [[X0, 0, X1, 0, X1, 32, X0, 32]], "rule": "nonzero",
  "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" }"#;

fn square(x0: u32, x1: u32) -> String {
    SQUARE.replace("X0", &x0.to_string()).replace("X1", &x1.to_string())
}

fn group(extra: &str) -> String {
    format!(
        r#"{{ "width": 64, "height": 32, "background": [1, 1, 1, 1], "items": [
  {{ "kind": "group", "clip": "c", "items": [{}, {}], "opacity": 0.5, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal"{extra} }} ] }}"#,
        square(0, 40),
        square(24, 64)
    )
}

const LAYER: &str = r#"{ "width": 64, "height": 32, "background": [0, 0, 1, 1], "items": [
  { "kind": "layer", "clip": "c", "source": "c:canvas", "size": { "width": 16, "height": 16 },
    "opacity": 1, "matrix": [2, 0, 0, 2, 8, 0], "blur": 0, "blend": "normal" } ] }"#;

#[test]
fn parses_a_group_with_its_children() {
    let parsed = parse(&group("")).unwrap();

    let Item::Group(g) = &parsed.items[0] else { panic!("{:?}", parsed.items) };
    assert_eq!(g.items.len(), 2);
    assert_eq!(g.look.opacity, 0.5);
}

#[test]
fn parses_a_layer_with_its_picture_source() {
    let parsed = parse(LAYER).unwrap();

    let Item::Layer(l) = &parsed.items[0] else { panic!("{:?}", parsed.items) };
    assert_eq!(l.source, "c:canvas");
    assert_eq!(l.size.width, 16.0);
}

#[test]
fn a_use_places_group_children_and_layers_through_its_matrix() {
    let frame = format!(r#"{{ "width": 64, "height": 32, "background": null, "items": [
  {{ "kind": "group", "clip": "c", "items": [{}], "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 0, "blend": "normal" }},
  {{ "kind": "layer", "clip": "c", "source": "c:canvas", "size": {{ "width": 16, "height": 16 }}, "opacity": 1, "matrix": [2, 0, 0, 2, 8, 0], "blur": 0, "blend": "normal" }} ] }}"#, square(0, 40));
    let mut groups = Groups::new();
    groups.put("f", parse(&frame).unwrap());
    let screen = r#"{ "width": 200, "height": 100, "background": null, "items": [{ "kind": "use", "clip": "u", "group": "f", "matrix": [1, 0, 0, 1, 10, 20] }] }"#;

    let (list, _) = expand(&parse(screen).unwrap(), &groups);

    let Item::Group(g) = &list.items[0] else { panic!("{:?}", list.items) };
    let Item::Path(inner) = &g.items[0] else { panic!() };
    assert_eq!(inner.look.matrix, [1.0, 0.0, 0.0, 1.0, 10.0, 20.0]);
    let Item::Layer(l) = &list.items[1] else { panic!() };
    assert_eq!(l.look.matrix, [2.0, 0.0, 0.0, 2.0, 18.0, 20.0]);
}

#[cfg(feature = "gpu")]
fn at(pixels: &[u8], x: usize, y: usize) -> [u8; 4] {
    pixels[(y * 64 + x) * 4..(y * 64 + x) * 4 + 4].try_into().unwrap()
}

#[cfg(feature = "gpu")]
fn rendered(json: &str, pictures: &Pictures) -> Vec<u8> {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let out = renderer.render(&parse(json).unwrap(), pictures).unwrap();
    assert!(out.skipped.is_empty(), "{:?}", out.skipped);
    out.pixels
}

#[cfg(feature = "gpu")]
#[test]
fn a_group_fades_once_so_its_overlap_is_not_darker() {
    let pixels = rendered(&group(""), &Pictures::new());

    assert_eq!(at(&pixels, 32, 16), at(&pixels, 8, 16));
}

#[cfg(feature = "gpu")]
#[test]
fn a_filtered_group_filters_its_children_together() {
    let filters = r#", "filters": [{ "kind": "css", "fns": [{ "name": "invert", "args": ["1"] }] }]"#;
    let pixels = rendered(&group(filters), &Pictures::new());

    assert_eq!(at(&pixels, 32, 16), at(&pixels, 8, 16));
    assert!(at(&pixels, 8, 16)[1] > 100);
}

#[cfg(feature = "gpu")]
#[test]
fn a_layer_draws_its_picture_at_its_size_through_its_matrix() {
    let green = [0u8, 255, 0, 255].repeat(4 * 4);
    let pictures = Pictures::from([("c:canvas".to_string(), picture(4, 4, green))]);

    let pixels = rendered(LAYER, &pictures);

    assert_eq!(at(&pixels, 20, 16), [0, 255, 0, 255]);
    assert_eq!(at(&pixels, 4, 16), [0, 0, 255, 255]);
    assert_eq!(at(&pixels, 50, 16), [0, 0, 255, 255]);
}

#[test]
fn a_turned_use_paints_its_background_as_the_turned_rectangle() {
    let frame = r#"{ "width": 40, "height": 20, "background": [0, 0, 0, 1], "items": [] }"#;
    let mut groups = Groups::new();
    groups.put("f", parse(frame).unwrap());
    let screen = r#"{ "width": 200, "height": 200, "background": null, "items": [{ "kind": "use", "clip": "u", "group": "f", "matrix": [0, 1, -1, 0, 100, 0] }] }"#;

    let (list, _) = expand(&parse(screen).unwrap(), &groups);

    let Item::Path(back) = &list.items[0] else { panic!("{:?}", list.items) };
    assert_eq!(back.contours[0], vec![100.0, 0.0, 100.0, 40.0, 80.0, 40.0, 80.0, 0.0]);
}
