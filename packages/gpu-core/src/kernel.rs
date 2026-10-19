pub const MAX_TAPS: usize = 64;
const REACH: f64 = 3.0;

#[derive(Debug, Clone, PartialEq)]
pub struct Kernel {
    pub weights: Vec<f32>,
    pub step: u32,
}

pub fn gaussian(sigma: f64) -> Kernel {
    let reach = (sigma * REACH).ceil() as usize;
    let step = ((reach + 1).div_ceil(MAX_TAPS)).max(1);
    let taps = reach / step + 1;
    let raw: Vec<f64> = (0..taps).map(|i| (-((i * step) as f64).powi(2) / (2.0 * sigma * sigma)).exp()).collect();
    let total = raw[0] + 2.0 * raw[1..].iter().sum::<f64>();
    Kernel { weights: raw.iter().map(|w| (w / total) as f32).collect(), step: step as u32 }
}
