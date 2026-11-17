use crate::retained::Camera;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OverlayKey {
    pub camera: Camera,
    pub size: (u32, u32),
    pub quality: OverlayQuality,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Moving {
    Still,
    Camera,
    Lift,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlayQuality {
    Sharp,
    Rough,
}

const ROUGH_SCALE: f64 = 0.5;

impl OverlayQuality {
    pub fn of(moving: Moving) -> OverlayQuality {
        match moving {
            Moving::Camera => OverlayQuality::Rough,
            Moving::Still | Moving::Lift => OverlayQuality::Sharp,
        }
    }

    pub fn scale(self) -> f64 {
        match self {
            OverlayQuality::Sharp => 1.0,
            OverlayQuality::Rough => ROUGH_SCALE,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OverlayDrawn {
    Settled,
    Pending,
}

#[derive(Default)]
pub struct OverlayKept {
    key: Option<OverlayKey>,
}

impl OverlayKept {
    pub fn stale(&self, key: &OverlayKey) -> bool {
        self.key.as_ref() != Some(key)
    }

    pub fn forget(&mut self) {
        self.key = None;
    }

    pub fn drew(&mut self, key: OverlayKey, drawn: OverlayDrawn) {
        self.key = (drawn == OverlayDrawn::Settled).then_some(key);
    }
}
