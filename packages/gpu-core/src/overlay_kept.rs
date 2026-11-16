use crate::retained::Camera;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OverlayKey {
    pub camera: Camera,
    pub size: (u32, u32),
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
