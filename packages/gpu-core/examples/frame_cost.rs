use std::fs;
use std::time::Instant;

use gpu_core::display_list::parse;
use gpu_core::files::Files;
use gpu_core::render::Renderer;

const ROUNDS: usize = 8;

fn main() {
    let lists: Vec<_> = std::env::args().skip(1).map(|path| parse(&fs::read_to_string(path).expect("display list")).expect("valid display list")).collect();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let pictures: Vec<_> = lists.iter().map(|list| Files::new().pictures(list)).collect();
    renderer.draw_and_wait(&lists[0], &pictures[0]).expect("warm up");
    let mut times: Vec<f64> = (0..ROUNDS)
        .flat_map(|_| 0..lists.len())
        .map(|i| {
            let start = Instant::now();
            renderer.draw_and_wait(&lists[i], &pictures[i]).expect("render");
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(|a, b| a.total_cmp(b));
    let n = times.len();
    println!("p50 {:.2} ms  p95 {:.2} ms  max {:.2} ms", times[n / 2], times[n * 95 / 100], times[n - 1]);
}
