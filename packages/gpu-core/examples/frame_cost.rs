use std::fs;
use std::time::Instant;

use gpu_core::display_list::parse;
use gpu_core::files::Files;
use gpu_core::render::Renderer;

const FRAMES: usize = 60;

fn main() {
    let path = std::env::args().nth(1).expect("a display list json");
    let list = parse(&fs::read_to_string(path).expect("display list")).expect("valid display list");
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let pictures = Files::new().pictures(&list);
    renderer.draw_and_wait(&list, &pictures).expect("warm up");
    let mut times: Vec<f64> = (0..FRAMES)
        .map(|_| {
            let start = Instant::now();
            renderer.draw_and_wait(&list, &pictures).expect("render");
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(|a, b| a.total_cmp(b));
    println!("p50 {:.2} ms  p95 {:.2} ms  max {:.2} ms", times[FRAMES / 2], times[FRAMES * 95 / 100], times[FRAMES - 1]);
}
