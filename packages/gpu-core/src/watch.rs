use crate::tiles::TileKey;
use vello::kurbo::Rect;

const FULL_COVER: f64 = 0.999;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LossKind {
    Coarser,
    Uncovered,
    EvictedOnScreen
}

impl LossKind {
    pub fn code(self) -> f64 {
        match self {
            LossKind::Coarser => 1.0,
            LossKind::Uncovered => 2.0,
            LossKind::EvictedOnScreen => 3.0
        }
    }
}

pub const WATCH_LOG_CAP: usize = 512;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Loss {
    pub key: TileKey,
    pub kind: LossKind
}

pub fn visible_losses(was: &[TileKey], now: &[TileKey], needed: i32, visible: Rect) -> Vec<Loss> {
    was.iter().filter_map(|key| loss_of(*key, now, needed, visible)).collect()
}

fn loss_of(key: TileKey, now: &[TileKey], needed: i32, visible: Rect) -> Option<Loss> {
    let area = key.world().intersect(visible);
    if area.area() <= 0.0 {
        return None;
    }
    let over: Vec<&TileKey> = now.iter().filter(|other| area.intersect(other.world()).area() > 0.0).collect();
    let covered: f64 = over.iter().map(|other| area.intersect(other.world()).area()).sum();

    if covered < area.area() * FULL_COVER {
        return Some(Loss { key, kind: LossKind::Uncovered });
    }

    let enough = key.step.min(needed);
    let sharp_cover: f64 = over.iter().filter(|other| other.step >= enough).map(|other| area.intersect(other.world()).area()).sum();
    if sharp_cover < area.area() * FULL_COVER {
        return Some(Loss { key, kind: LossKind::Coarser });
    }

    None
}
