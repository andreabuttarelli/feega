use gpu_core::blob::{params, ROW_LENGTH};
use gpu_core::display_list::{parse, Item};
#[cfg(feature = "gpu")]
use gpu_core::pictures::Pictures;

#[cfg(feature = "gpu")]
const SIZE: usize = 64;

const ROW: &str = "32, 32, 9.6, 0, 32, 32, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1.42, 0.025, 0, 1, 0, 1, 1, 1, 1, 0, 8, 8, 48, 48";

fn scene(blob: bool) -> String {
    let drop = format!(r#", {{ "kind": "blob", "clip": "drop", "row": [{ROW}], "time": 0.5, "seed": 7, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#);
    format!(
        r#"{{ "width": 64, "height": 64, "background": [0, 0, 0, 1], "items": [
    {{ "kind": "path", "clip": "half", "contours": [[0, 0, 32, 0, 32, 64, 0, 64]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}{} ] }}"#,
        if blob { drop } else { String::new() }
    )
}

#[test]
fn a_blob_parses_with_its_pose_row() {
    let list = parse(&scene(true)).unwrap();

    let Item::Blob(blob) = &list.items[1] else { panic!("a blob") };
    assert_eq!(blob.row.len(), ROW_LENGTH);
    assert_eq!(blob.look.matrix, [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]);
}

#[test]
fn the_shader_reads_the_row_then_time_seed_and_both_matrices() {
    let list = parse(&scene(true).replace(r#""matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#, r#""matrix": [2, 0, 0, 2, 10, 20], "blend": "normal" } ] }"#)).unwrap();
    let Item::Blob(blob) = &list.items[1] else { panic!("a blob") };

    let p = params(blob);
    assert_eq!(p.len(), ROW_LENGTH + 2 + 12);
    assert_eq!(p[ROW_LENGTH..ROW_LENGTH + 2], [0.5, 7.0]);
    assert_eq!(p[ROW_LENGTH + 2..ROW_LENGTH + 8], [2.0, 0.0, 0.0, 2.0, 10.0, 20.0]);
    assert_eq!(p[ROW_LENGTH + 8..], [0.5, 0.0, 0.0, 0.5, -5.0, -10.0]);
}

#[cfg(feature = "gpu")]
fn render(json: &str) -> (Vec<u8>, usize) {
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
    let rendered = renderer.render(&parse(json).unwrap(), &Pictures::new()).unwrap();
    (rendered.pixels, rendered.skipped.len())
}

#[cfg(feature = "gpu")]
#[test]
fn a_blob_refracts_what_lies_beneath_inside_its_box_only() {
    let (with, skipped) = render(&scene(true));
    let (without, _) = render(&scene(false));
    let at = |p: &[u8], x: usize, y: usize| p[(y * SIZE + x) * 4..(y * SIZE + x) * 4 + 3].to_vec();

    assert_eq!(skipped, 0);
    assert_eq!(at(&with, 2, 2), at(&without, 2, 2));
    assert_eq!(at(&with, 60, 60), at(&without, 60, 60));
    assert!((20..44).any(|x| at(&with, x, 32) != at(&without, x, 32)));
}
