use std::fmt::Write;
use std::time::Instant;

use gpu_core::display_list::parse;
use gpu_core::pictures::Pictures;
use gpu_core::render::Renderer;

const CARDS: usize = 48;
const COLUMNS: usize = 8;
const RUNS: usize = 30;
const WIDTH: u32 = 1600;
const HEIGHT: u32 = 1000;

fn card(x: f64, y: f64, fns: &str) -> String {
    let (w, h, r) = (150.0, 110.0, 12.0);
    let mut points = String::new();
    for (cx, cy, from) in [(x + w - r, y + r, -0.5), (x + w - r, y + h - r, 0.0), (x + r, y + h - r, 0.5), (x + r, y + r, 1.0)] {
        for i in 0..=8 {
            let a = std::f64::consts::PI * (from + 0.5 * i as f64 / 8.0);
            let _ = write!(points, "{}{:.3}, {:.3}", if points.is_empty() { "" } else { ", " }, cx + r * a.cos(), cy + r * a.sin());
        }
    }
    let filters = if fns.is_empty() { String::new() } else { format!(r#", "filters": [{{ "kind": "css", "fns": [{fns}] }}]"#) };
    format!(r#"{{ "kind": "path", "clip": "c{x}-{y}", "contours": [[{points}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal", "space": [1, 0, 0, 1]{filters} }}"#)
}

fn list(fns: &str) -> String {
    let items: Vec<String> = (0..CARDS).map(|i| card(30.0 + (i % COLUMNS) as f64 * 195.0, 30.0 + (i / COLUMNS) as f64 * 160.0, fns)).collect();
    format!(r#"{{ "width": {WIDTH}, "height": {HEIGHT}, "background": [0.95, 0.95, 0.96, 1], "items": [{}] }}"#, items.join(","))
}

fn main() {
    let analytic = r#"{ "name": "drop-shadow", "args": ["0px", "8px", "24px", "rgba(0, 0, 0, 0.18)"] }"#;
    let filtered = r#"{ "name": "drop-shadow", "args": ["0px", "8px", "24px", "rgba(0, 0, 0, 0.18)"] }, { "name": "brightness", "args": ["1"] }"#;
    let pictures = Pictures::new();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    for (name, fns) in [("no shadow", ""), ("filter path", filtered), ("analytic", analytic)] {
        let list = parse(&list(fns)).unwrap();
        renderer.render(&list, &pictures).unwrap();
        let mut ms: Vec<f64> = (0..RUNS)
            .map(|_| {
                let start = Instant::now();
                renderer.render(&list, &pictures).unwrap();
                start.elapsed().as_secs_f64() * 1000.0
            })
            .collect();
        ms.sort_by(f64::total_cmp);
        println!("{name:12} {CARDS} card shadows  p50 {:7.2} ms  p95 {:7.2} ms", ms[RUNS / 2], ms[RUNS * 95 / 100]);
    }
}
