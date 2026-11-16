use gpu_core::overlay_chunks::{parse_chunk_ops, OverlayChunks};
use gpu_core::world::{parse_overlay, OverlayPart};

fn path(clip: &str, x: f64) -> String {
    format!(r#"{{ "kind": "path", "clip": "{clip}", "contours": [[{x}, 0, 1, 0, 1, 1]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0, 0, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] }}"#)
}

fn apply(chunks: &mut OverlayChunks, json: &str) -> Vec<(OverlayPart, Vec<String>)> {
    chunks.apply(parse_chunk_ops(json).unwrap()).into_iter().map(|(part, items)| (part, items.iter().map(|i| i.clip().to_string()).collect())).collect()
}

#[test]
fn chunks_assemble_each_part_in_order() {
    let mut chunks = OverlayChunks::default();
    let parts = apply(&mut chunks, &format!(r#"{{ "put": [["a", [{}]], ["b", [{}, {}]]], "drop": [], "fixed": ["b", "a"], "selected": [] }}"#, path("a1", 0.0), path("b1", 0.0), path("b2", 0.0)));

    assert_eq!(parts, vec![(OverlayPart::Fixed, vec!["b1".into(), "b2".into(), "a1".into()]), (OverlayPart::Selected, vec![])]);
}

#[test]
fn moving_a_key_between_parts_needs_no_items() {
    let mut chunks = OverlayChunks::default();
    apply(&mut chunks, &format!(r#"{{ "put": [["a", [{}]], ["b", [{}]]], "drop": [], "fixed": ["a", "b"], "selected": [] }}"#, path("a1", 0.0), path("b1", 0.0)));

    let parts = apply(&mut chunks, r#"{ "put": [], "drop": [], "fixed": ["a"], "selected": ["b"] }"#);

    assert_eq!(parts, vec![(OverlayPart::Fixed, vec!["a1".into()]), (OverlayPart::Selected, vec!["b1".into()])]);
}

#[test]
fn a_changed_chunk_rebuilds_only_the_part_holding_it() {
    let mut chunks = OverlayChunks::default();
    apply(&mut chunks, &format!(r#"{{ "put": [["a", [{}]], ["b", [{}]]], "drop": [], "fixed": ["a"], "selected": ["b"] }}"#, path("a1", 0.0), path("b1", 0.0)));

    let parts = apply(&mut chunks, &format!(r#"{{ "put": [["b", [{}]]], "drop": [] }}"#, path("b2", 5.0)));

    assert_eq!(parts, vec![(OverlayPart::Selected, vec!["b2".into()])]);
}

#[test]
fn chunks_match_the_whole_list_they_replace() {
    let mut chunks = OverlayChunks::default();
    let (a, b) = (path("a1", 0.0), path("b1", 3.0));
    let whole = parse_overlay(&format!("[{a}, {b}]")).unwrap();

    let parts = chunks.apply(parse_chunk_ops(&format!(r#"{{ "put": [["a", [{a}]], ["b", [{b}]]], "drop": [], "fixed": ["a", "b"] }}"#)).unwrap());

    assert_eq!(parts, vec![(OverlayPart::Fixed, whole)]);
}

#[test]
fn a_dropped_key_leaves_the_part() {
    let mut chunks = OverlayChunks::default();
    apply(&mut chunks, &format!(r#"{{ "put": [["a", [{}]], ["b", [{}]]], "drop": [], "fixed": ["a", "b"] }}"#, path("a1", 0.0), path("b1", 0.0)));

    let parts = apply(&mut chunks, r#"{ "put": [], "drop": ["b"], "fixed": ["a"] }"#);

    assert_eq!(parts, vec![(OverlayPart::Fixed, vec!["a1".into()])]);
}
