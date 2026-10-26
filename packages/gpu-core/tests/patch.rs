use std::sync::Arc;

use gpu_core::display_list::{parse, parse_splice, DisplayList};
use gpu_core::groups::{Library, Limits};

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };
const ITEMS: usize = 40;
const EDITED: usize = 35;

fn bar(i: usize, red: f32) -> String {
    let x = i * 10;
    format!(
        r#"{{ "kind": "path", "clip": "bar{i}", "contours": [[{x}, 10, {r}, 10, {r}, 20, {x}, 20]], "rule": "nonzero",
    "paint": {{ "kind": "solid", "color": [{red}, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#,
        r = x + 5
    )
}

fn list(reds: &[f32]) -> DisplayList {
    let items: Vec<String> = reds.iter().enumerate().map(|(i, red)| bar(i, *red)).collect();
    parse(&format!(r#"{{ "width": 800, "height": 600, "background": [0, 0, 1, 1], "items": [{}] }}"#, items.join(","))).unwrap()
}

fn splice(head: usize, tail: usize, items: &[(usize, f32)]) -> gpu_core::display_list::Splice {
    let items: Vec<String> = items.iter().map(|(i, red)| bar(*i, *red)).collect();
    parse_splice(&format!(r#"{{ "head": {head}, "tail": {tail}, "items": [{}] }}"#, items.join(","))).unwrap()
}

fn screen(group: &str) -> DisplayList {
    parse(&format!(
        r#"{{ "width": 800, "height": 600, "background": null, "items": [
      {{ "kind": "use", "clip": "{group}", "group": "{group}", "matrix": [1, 0, 0, 1, 0, 0], "cache": false }}] }}"#
    ))
    .unwrap()
}

fn composing() -> Library {
    let mut library = Library::new();
    library.compose_encodings();
    library
}

fn red_bars() -> Vec<f32> {
    vec![1.0; ITEMS]
}

fn one_edited() -> Vec<f32> {
    let mut reds = red_bars();
    reds[EDITED] = 0.5;
    reds
}

fn edit_of_one() -> gpu_core::display_list::Splice {
    splice(EDITED, ITEMS - EDITED - 1, &[(EDITED, 0.5)])
}

#[test]
fn a_patched_group_composes_like_the_whole_edited_list() {
    let mut patched = composing();
    patched.put_group("v1", &list(&red_bars()));
    assert!(patched.patch_group("v1", "v2", &edit_of_one()));

    let mut whole = composing();
    whole.put_group("v2", &list(&one_edited()));

    let from_patch = patched.plan(&screen("v2"), LIMITS).screen.fragments;
    let from_whole = whole.plan(&screen("v2"), LIMITS).screen.fragments;
    let (a, b) = (from_patch.get("v2").unwrap(), from_whole.get("v2").unwrap());
    assert_eq!(a.runs.len(), b.runs.len());
    for (x, y) in a.runs.iter().zip(&b.runs) {
        assert_eq!((x.bounds, x.extent, x.end), (y.bounds, y.extent, y.end));
    }
}

#[test]
fn runs_before_the_edit_are_kept_and_the_edited_run_is_rebuilt() {
    let mut lib = composing();
    lib.put_group("v1", &list(&red_bars()));
    let before = lib.plan(&screen("v1"), LIMITS).screen.fragments;

    assert!(lib.patch_group("v1", "v2", &edit_of_one()));
    let after = lib.plan(&screen("v2"), LIMITS).screen.fragments;

    let (old, new) = (before.get("v1").unwrap(), after.get("v2").unwrap());
    assert!(Arc::ptr_eq(&old.runs[0], &new.runs[0]));
    assert!(Arc::ptr_eq(&old.runs[1], &new.runs[1]));
    assert!(Arc::ptr_eq(&old.runs[2], &new.runs[2]));
    assert!(!Arc::ptr_eq(&old.runs[3], &new.runs[3]));
}

#[test]
fn a_patch_grows_and_shrinks_the_group() {
    let mut lib = composing();
    lib.put_group("v1", &list(&red_bars()));

    assert!(lib.patch_group("v1", "v2", &splice(ITEMS, 0, &[(ITEMS, 1.0)])));
    assert!(lib.patch_group("v2", "v3", &splice(0, 0, &[])));

    assert_eq!(lib.items_in("v2"), Some(ITEMS + 1));
    assert_eq!(lib.items_in("v3"), Some(0));
}

#[test]
fn a_patch_against_a_missing_or_shorter_group_changes_nothing() {
    let mut lib = composing();
    lib.put_group("v1", &list(&red_bars()));

    assert!(!lib.patch_group("gone", "v2", &splice(0, 0, &[])));
    assert!(!lib.patch_group("v1", "v3", &splice(30, 30, &[])));

    assert_eq!(lib.items_in("v2"), None);
    assert_eq!(lib.items_in("v3"), None);
    assert_eq!(lib.items_in("v1"), Some(ITEMS));
}

#[test]
fn putting_the_group_again_forgets_the_runs_a_patch_would_reuse() {
    let mut lib = composing();
    lib.put_group("v1", &list(&red_bars()));
    let before = lib.plan(&screen("v1"), LIMITS).screen.fragments;
    lib.patch_group("v1", "v2", &edit_of_one());

    lib.put_group("v2", &list(&red_bars()));
    let after = lib.plan(&screen("v2"), LIMITS).screen.fragments;

    assert!(!Arc::ptr_eq(&before.get("v1").unwrap().runs[0], &after.get("v2").unwrap().runs[0]));
}
