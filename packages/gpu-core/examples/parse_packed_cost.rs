use std::fs;
use std::time::Instant;

use gpu_core::display_list::parse_packed;

const ROUNDS: usize = 30;

fn main() {
    let base = std::env::args().nth(1).expect("packed list base path");
    let json = fs::read_to_string(format!("{base}.json")).expect("skeleton");
    let floats: Vec<f64> = fs::read(format!("{base}.f64")).expect("floats").chunks_exact(8).map(|b| f64::from_le_bytes(b.try_into().unwrap())).collect();
    let ends: Vec<u32> = fs::read(format!("{base}.u32")).expect("ends").chunks_exact(4).map(|b| u32::from_le_bytes(b.try_into().unwrap())).collect();

    let mut times: Vec<f64> = (0..ROUNDS)
        .map(|_| {
            let (f, e) = (floats.clone(), ends.clone());
            let start = Instant::now();
            parse_packed(&json, f, e).expect("valid packed list");
            start.elapsed().as_secs_f64() * 1000.0
        })
        .collect();
    times.sort_by(|a, b| a.total_cmp(b));
    println!("{} + {} bytes  median {:.2} ms  min {:.2} ms  max {:.2} ms", json.len(), floats.len() * 8, times[ROUNDS / 2], times[0], times[ROUNDS - 1]);
}
