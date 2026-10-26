use std::time::Instant;

use gpu_core::display_list::{parse, parse_splice};
use gpu_core::groups::{Library, Limits};

const ITEMS: usize = 5000;
const ROUNDS: usize = 20;
const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 100_000 };

fn bar(i: usize, red: f32) -> String {
    let (x, y) = ((i % 100) * 10, (i / 100) * 10);
    format!(
        r#"{{ "kind": "path", "clip": "b{i}", "contours": [[{x}, {y}, {r}, {y}, {r}, {b}, {x}, {b}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [{red}, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#,
        r = x + 8,
        b = y + 8
    )
}

fn whole_json(edited: f32) -> String {
    let items: Vec<String> = (0..ITEMS).map(|i| bar(i, if i == ITEMS / 2 { edited } else { 1.0 })).collect();
    format!(r#"{{ "width": 1000, "height": 500, "background": [0, 0, 1, 1], "items": [{}] }}"#, items.join(","))
}

fn screen(group: &str) -> gpu_core::display_list::DisplayList {
    parse(&format!(r#"{{ "width": 1000, "height": 500, "background": null, "items": [{{ "kind": "use", "clip": "{group}", "group": "{group}", "matrix": [1, 0, 0, 1, 0, 0], "cache": false }}] }}"#)).unwrap()
}

fn median(mut times: Vec<f64>) -> f64 {
    times.sort_by(|a, b| a.total_cmp(b));
    times[times.len() / 2]
}

fn main() {
    let first = whole_json(1.0);
    let splice = format!(r#"{{ "head": {}, "tail": {}, "items": [{}] }}"#, ITEMS / 2, ITEMS - ITEMS / 2 - 1, bar(ITEMS / 2, 0.5));
    let (mut full, mut patched) = (Vec::new(), Vec::new());
    for round in 0..ROUNDS {
        let edited = whole_json(0.5 - round as f32 * 0.001);
        let mut lib = Library::new();
        lib.compose_encodings();
        lib.put_group("v1", &parse(&first).unwrap());
        lib.plan(&screen("v1"), LIMITS);

        let start = Instant::now();
        let list = parse(&edited).unwrap();
        lib.put_group("v2", &list);
        lib.plan(&screen("v2"), LIMITS);
        full.push(start.elapsed().as_secs_f64() * 1000.0);

        let start = Instant::now();
        assert!(lib.patch_group("v1", "v3", &parse_splice(&splice).unwrap()));
        lib.plan(&screen("v3"), LIMITS);
        patched.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    println!("{ITEMS} items, one edited: whole group {:.2} ms, patch {:.2} ms (parse + store + encode, median of {ROUNDS})", median(full), median(patched));
}
