const SIZE: usize = 0x100;
pub const LATTICE: usize = SIZE + SIZE + 2;
pub const CHANNELS: usize = 4;
const RAND_M: i64 = 2147483647;
const RAND_A: i64 = 16807;
const RAND_Q: i64 = 127773;
const RAND_R: i64 = 2836;

pub struct Lattice {
    pub selector: Vec<i32>,
    pub gradients: Vec<f32>,
}

fn seeded(seed: i64) -> i64 {
    let s = if seed <= 0 { -(seed % (RAND_M - 1)) + 1 } else { seed };
    s.min(RAND_M - 1)
}

fn next(seed: i64) -> i64 {
    let r = RAND_A * (seed % RAND_Q) - RAND_R * (seed / RAND_Q);
    if r <= 0 {
        r + RAND_M
    } else {
        r
    }
}

pub fn lattice_of(seed: f64) -> Lattice {
    let mut s = seeded(seed.trunc() as i64);
    let mut selector = vec![0i32; LATTICE];
    let mut gradients = vec![0f32; CHANNELS * LATTICE * 2];
    let g = |k: usize, i: usize, j: usize| (k * LATTICE + i) * 2 + j;
    for k in 0..CHANNELS {
        for i in 0..SIZE {
            selector[i] = i as i32;
            for j in 0..2 {
                s = next(s);
                gradients[g(k, i, j)] = ((s % (SIZE + SIZE) as i64) - SIZE as i64) as f32 / SIZE as f32;
            }
            let len = gradients[g(k, i, 0)].hypot(gradients[g(k, i, 1)]);
            gradients[g(k, i, 0)] /= len;
            gradients[g(k, i, 1)] /= len;
        }
    }
    for i in (1..SIZE).rev() {
        let kept = selector[i];
        s = next(s);
        let j = (s % SIZE as i64) as usize;
        selector[i] = selector[j];
        selector[j] = kept;
    }
    for i in 0..SIZE + 2 {
        selector[SIZE + i] = selector[i];
        for k in 0..CHANNELS {
            for j in 0..2 {
                gradients[g(k, SIZE + i, j)] = gradients[g(k, i, j)];
            }
        }
    }
    Lattice { selector, gradients }
}

pub fn stitched_frequency(base: f64, tile: f64) -> f64 {
    if base == 0.0 {
        return 0.0;
    }
    let lo = (tile * base).floor() / tile;
    let hi = (tile * base).ceil() / tile;
    if base / lo < hi / base {
        lo
    } else {
        hi
    }
}
