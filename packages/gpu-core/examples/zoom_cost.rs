use std::fmt::Write;
use std::time::Instant;

use gpu_core::display_list::{parse, DisplayList};
use gpu_core::pictures::Pictures;
use gpu_core::render::Renderer;

const GROUPS: usize = 120;
const PATHS_PER_GROUP: usize = 150;
const FRAMES: usize = 90;
const WIDTH: u32 = 1600;
const HEIGHT: u32 = 1000;
const GROUP_SIDE: f64 = 600.0;

fn group() -> DisplayList {
    let mut items = String::new();
    for i in 0..PATHS_PER_GROUP {
        let (x, y) = ((i % 15) as f64 * 38.0, (i / 15) as f64 * 55.0);
        let paint = if i % 3 == 0 {
            r#"{ "kind": "linear", "from": [0, 0], "to": [1, 1], "stops": [{ "at": 0, "color": [1, 0.2, 0, 1] }, { "at": 1, "color": [0, 0.3, 1, 1] }] }"#.to_string()
        } else {
            format!(r#"{{ "kind": "solid", "color": [{}, 0.5, 0.2, 1] }}"#, (i % 10) as f64 / 10.0)
        };
        let _ = write!(
            items,
            r#"{}{{ "kind": "path", "clip": "p{i}", "contours": [[{x}, {y}, {}, {y}, {}, {}, {x}, {}]], "rule": "nonzero", "paint": {paint}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#,
            if i == 0 { "" } else { "," },
            x + 30.0,
            x + 30.0,
            y + 45.0,
            y + 45.0
        );
    }
    parse(&format!(r#"{{ "width": {}, "height": {}, "background": [1, 1, 1, 1], "items": [{items}] }}"#, GROUP_SIDE as u32, GROUP_SIDE as u32)).unwrap()
}

fn screen(zoom: f64) -> DisplayList {
    let uses: Vec<String> = (0..GROUPS)
        .map(|g| {
            let (col, row) = ((g % 12) as f64, (g / 12) as f64);
            let (x, y) = (col * (GROUP_SIDE + 40.0) * zoom, row * (GROUP_SIDE + 40.0) * zoom);
            format!(r#"{{ "kind": "use", "clip": "g{g}", "group": "g{g}", "matrix": [{zoom}, 0, 0, {zoom}, {x}, {y}], "cache": false }}"#)
        })
        .collect();
    parse(&format!(r#"{{ "width": {WIDTH}, "height": {HEIGHT}, "background": null, "items": [{}] }}"#, uses.join(","))).unwrap()
}

fn run(compose: bool) -> (f64, f64, f64) {
    let mut renderer = Renderer::new().expect("a GPU adapter");
    if compose {
        renderer.compose_encodings();
    }
    for g in 0..GROUPS {
        renderer.put_group(&format!("g{g}"), group());
    }
    let pictures = Pictures::new();
    let frames: Vec<DisplayList> = (0..FRAMES).map(|f| screen(0.15 + 0.012 * f as f64)).collect();
    renderer.draw_and_wait(&frames[0], &pictures).expect("warm up");
    let mut times: Vec<f64> = frames
        .iter()
        .map(|list| {
            let start = Instant::now();
            renderer.draw_and_wait(list, &pictures).expect("render");
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(|a, b| a.total_cmp(b));
    let n = times.len();
    (times[n / 2], times[n * 95 / 100], times[n - 1])
}

fn main() {
    for (name, compose) in [("re-encode every frame", false), ("composed encodings", true)] {
        let (p50, p95, max) = run(compose);
        println!("{name:24} p50 {p50:7.2} ms  p95 {p95:7.2} ms  max {max:7.2} ms");
    }
}
