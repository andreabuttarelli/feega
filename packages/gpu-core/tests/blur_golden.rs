#![cfg(feature = "gpu")]

use gpu_core::display_list::parse;
use gpu_core::files::write_png;
use gpu_core::pictures::Pictures;
use gpu_core::render::Renderer;

const SIZE: usize = 128;
const TOLERANCE: i32 = 4;
const CASES: [(&str, &str); 4] = [
    ("blur-2", r#"{ "kind": "css", "fns": [{ "name": "blur", "args": ["2px"] }] }"#),
    ("blur-6", r#"{ "kind": "css", "fns": [{ "name": "blur", "args": ["6px"] }] }"#),
    ("blur-20", r#"{ "kind": "css", "fns": [{ "name": "blur", "args": ["20px"] }] }"#),
    ("shadow-35", r#"{ "kind": "css", "fns": [{ "name": "drop-shadow", "args": ["4px", "10px", "35px", "rgba(20,40,200,0.6)"] }] }"#),
];

fn scene(filter: &str) -> String {
    format!(
        r#"{{
  "width": {SIZE}, "height": {SIZE}, "background": [1, 1, 1, 1],
  "items": [
    {{ "kind": "path", "clip": "shape", "contours": [[30, 24, 100, 40, 84, 104, 20, 88]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [0.9, 0.2, 0.1, 0.8] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
      "space": [1, 0, 0, 1], "filters": [{filter}] }},
    {{ "kind": "path", "clip": "bar", "contours": [[60, 8, 68, 8, 68, 120, 60, 120]], "rule": "nonzero",
      "paint": {{ "kind": "solid", "color": [0.1, 0.7, 0.3, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal",
      "space": [1, 0, 0, 1], "filters": [{filter}] }}
  ]
}}"#
    )
}

fn golden(name: &str) -> String {
    format!("{}/tests/fixtures/blur/{name}.png", env!("CARGO_MANIFEST_DIR"))
}

fn read(path: &str) -> Vec<u8> {
    let decoder = png::Decoder::new(std::io::BufReader::new(std::fs::File::open(path).expect("a golden image")));
    let mut reader = decoder.read_info().unwrap();
    let mut pixels = vec![0; reader.output_buffer_size()];
    reader.next_frame(&mut pixels).unwrap();
    pixels
}

#[test]
fn the_blur_matches_the_golden_images() {
    let mut renderer = Renderer::new().expect("a GPU adapter");
    for (name, filter) in CASES {
        let pixels = renderer.render(&parse(&scene(filter)).unwrap(), &Pictures::new()).unwrap().pixels;
        if std::env::var_os("WRITE_GOLDEN").is_some() {
            write_png(&golden(name), SIZE as u32, SIZE as u32, &pixels).unwrap();
            continue;
        }
        let worst = read(&golden(name)).iter().zip(&pixels).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap();

        assert!(worst <= TOLERANCE, "{name}: max channel difference {worst}");
    }
}
