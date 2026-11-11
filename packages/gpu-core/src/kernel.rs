pub const MAX_TAPS: usize = 64;
const REACH: f64 = 3.0;
const UNIT_TAPS: usize = 2 * MAX_TAPS - 1;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Tap {
    pub offset: f32,
    pub weight: f32,
}

pub fn gaussian(sigma: f64) -> Vec<Tap> {
    let reach = (sigma * REACH).ceil() as usize;
    let step = (reach + 1).div_ceil(UNIT_TAPS).max(1);
    let units = reach / step + 1;
    let at = |i: usize| if i < units { (-((i * step) as f64).powi(2) / (2.0 * sigma * sigma)).exp() } else { 0.0 };

    let mut taps = vec![(0.0, at(0))];
    for i in (1..units).step_by(2) {
        let (near, far) = (at(i), at(i + 1));
        let offset = (i as f64 * near + (i + 1) as f64 * far) / (near + far);
        taps.push((offset * step as f64, near + far));
    }

    let total = taps[0].1 + 2.0 * taps[1..].iter().map(|t| t.1).sum::<f64>();
    taps.iter().map(|&(offset, w)| Tap { offset: offset as f32, weight: (w / total) as f32 }).collect()
}
