#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Detail {
    Skip,
    Bar,
    Full,
}

const LADDER: [(f64, Detail); 2] = [(0.5, Detail::Skip), (1.5, Detail::Bar)];

pub const BLUR_FLOOR_PX: f64 = 0.5;
pub const RUN_ITEMS: usize = 16;
pub const TIER_LOG2_STEP: f64 = 2.0;
pub const BAR_MIN_COVERAGE: f64 = 0.3;
pub const INK_SHARE: f64 = 0.55;
pub const VIEW_SLACK_PX: f64 = 1.0;
pub const BLUR_REACH: f64 = 3.0;

pub fn detail(extent_px: f64, inked: bool) -> Detail {
    let found = LADDER.iter().find(|(below, _)| extent_px < *below).map(|(_, d)| *d);
    match found {
        Some(Detail::Bar) if !inked => Detail::Full,
        Some(d) => d,
        None => Detail::Full,
    }
}

pub fn tier(extent: f64) -> i32 {
    (extent.max(1.0).log2() / TIER_LOG2_STEP).floor() as i32
}

pub fn blur_px(blur: f64) -> f64 {
    if blur < BLUR_FLOOR_PX {
        0.0
    } else {
        blur
    }
}
