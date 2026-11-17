use crate::display_list::Look;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Detail {
    Skip,
    Bar,
    Full,
}

const LADDER: [(f64, Detail); 2] = [(0.5, Detail::Skip), (1.5, Detail::Bar)];

pub const BLUR_FLOOR_PX: f64 = 0.5;
pub const BACKDROP_FLOOR_PX: f64 = 2.0;
pub const RUN_ITEMS: usize = 16;
pub const SPLIT_DESCENDANTS: usize = 64;
pub const TIER_LOG2_STEP: f64 = 2.0;
pub const BAR_MIN_COVERAGE: f64 = 0.3;
pub const INK_SHARE: f64 = 0.55;
pub const VIEW_SLACK_PX: f64 = 1.0;
pub const BLUR_REACH: f64 = 3.0;

#[derive(Clone, Copy)]
pub struct Floors {
    pub text: f64,
    pub effects: f64,
}

const NATIVE: Floors = Floors { text: 1.0, effects: 1.0 };

thread_local! {
    static FLOORS: std::cell::Cell<Floors> = const { std::cell::Cell::new(NATIVE) };
}

pub fn coarser<R>(floors: Floors, draw: impl FnOnce() -> R) -> R {
    let was = FLOORS.replace(floors);
    let drawn = draw();
    FLOORS.set(was);
    drawn
}

fn floor(px: f64) -> f64 {
    px * FLOORS.get().text
}

fn effect_floor(px: f64) -> f64 {
    px * FLOORS.get().effects
}

pub fn detail(extent_px: f64, inked: bool) -> Detail {
    let found = LADDER.iter().find(|(below, _)| extent_px < floor(*below)).map(|(_, d)| *d);
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

pub fn backdrop_px(backdrop: Option<f64>) -> Option<f64> {
    backdrop.filter(|sigma| *sigma >= BACKDROP_FLOOR_PX)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Effect {
    Backdrop,
    Mask,
    Matte,
    Filter,
    Blur,
}

pub const PLAIN_BELOW_PX: [(Effect, f64); 5] = [(Effect::Backdrop, 16.0), (Effect::Mask, 4.0), (Effect::Matte, 4.0), (Effect::Filter, 4.0), (Effect::Blur, 4.0)];

fn shown(effect: Effect, extent_px: f64) -> bool {
    PLAIN_BELOW_PX.iter().find(|(e, _)| *e == effect).is_none_or(|(_, below)| extent_px >= effect_floor(*below))
}

pub fn plain_when_tiny(look: &Look, extent_px: f64) -> Look {
    let keep = |effect: Effect| shown(effect, extent_px);
    Look {
        backdrop: look.backdrop.filter(|_| keep(Effect::Backdrop)),
        masks: look.masks.clone().filter(|_| keep(Effect::Mask)),
        matte: look.matte.clone().filter(|_| keep(Effect::Matte)),
        filters: look.filters.clone().filter(|_| keep(Effect::Filter)),
        blur: if keep(Effect::Blur) { look.blur } else { 0.0 },
        ..look.clone()
    }
}
