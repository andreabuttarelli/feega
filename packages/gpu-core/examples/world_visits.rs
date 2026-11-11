use std::fs;
use std::time::Instant;

use gpu_core::world::{parse_patch, World};

const TILE: u32 = 1024;
const VIEWPORT: (f64, f64) = (2880.0, 1800.0);
const ZOOMS: [f64; 3] = [0.1, 0.4, 1.0];
const ROUNDS: usize = 200;

fn main() {
    let path = std::env::args().nth(1).expect("a JSON file of frame boxes [[x, y, w, h], ...]");
    let boxes: Vec<[f64; 4]> = serde_json::from_str(&fs::read_to_string(path).expect("boxes")).expect("valid boxes");
    let puts: Vec<String> = boxes.iter().enumerate().map(|(i, [x, y, _, _])| format!(r#"{{ "kind": "use", "clip": "f{i}", "group": "g{i}", "matrix": [1, 0, 0, 1, {x}, {y}] }}"#)).collect();
    let mut world = World::new();
    let size = |g: &str| g[1..].parse::<usize>().ok().map(|i| (boxes[i][2], boxes[i][3]));
    world.patch(parse_patch(&format!(r#"{{ "put": [{}], "drop": [] }}"#, puts.join(", "))).expect("patch"), size);
    let centre = (boxes[0][0] + boxes[0][2] / 2.0, boxes[0][1] + VIEWPORT.1);

    for zoom in ZOOMS {
        let tiles_x = (VIEWPORT.0 / TILE as f64).ceil() as usize;
        let tiles_y = (VIEWPORT.1 / TILE as f64).ceil() as usize;
        let cameras: Vec<[f64; 6]> = (0..tiles_x * tiles_y).map(|t| {
            let (tx, ty) = ((t % tiles_x) as f64 * TILE as f64, (t / tiles_x) as f64 * TILE as f64);
            [zoom, 0.0, 0.0, zoom, VIEWPORT.0 / 2.0 - centre.0 * zoom - tx, VIEWPORT.1 / 2.0 - centre.1 * zoom - ty]
        }).collect();
        world.take_visited();
        let started = Instant::now();
        for _ in 0..ROUNDS {
            cameras.iter().for_each(|c| drop(world.scene(*c, TILE, TILE)));
        }
        let per_frame_us = started.elapsed().as_secs_f64() * 1e6 / ROUNDS as f64;
        let visited = world.take_visited() / ROUNDS;
        println!("uses {} zoom {zoom}: {visited} visited per frame ({} tiles, {:.1} per plan), {per_frame_us:.1} µs per frame", boxes.len(), cameras.len(), visited as f64 / cameras.len() as f64);
    }
}
