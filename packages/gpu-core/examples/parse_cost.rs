use std::fs;
use std::time::Instant;

use gpu_core::display_list::parse;

const ROUNDS: usize = 30;

fn main() {
    let path = std::env::args().nth(1).expect("display list path");
    let json = fs::read_to_string(path).expect("display list");
    parse(&json).expect("valid display list");

    let mut times: Vec<f64> = (0..ROUNDS)
        .map(|_| {
            let start = Instant::now();
            parse(&json).expect("valid display list");
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(|a, b| a.total_cmp(b));
    println!("{} bytes  median {:.2} ms  min {:.2} ms  max {:.2} ms", json.len(), times[ROUNDS / 2], times[0], times[ROUNDS - 1]);
}
