use vello::kurbo::Rect;

use crate::retained::{Camera, Lookup};

const MARGIN_SHARE: f64 = 0.25;
const HOLD_STRETCH: f64 = 1.189_207_115;
const EDGE_SLACK: f64 = 1e-6;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct OverlayHold {
    planned: Camera,
    size: (u32, u32),
}

impl OverlayHold {
    pub fn around(camera: Camera, (w, h): (u32, u32), max_side: u32) -> OverlayHold {
        let margin = |side: u32| ((side as f64 * MARGIN_SHARE).min(max_side.saturating_sub(side) as f64 / 2.0)).max(0.0).floor();
        let (mx, my) = (margin(w), margin(h));
        let size = ((w + 2 * mx as u32).min(max_side), (h + 2 * my as u32).min(max_side));
        OverlayHold { planned: Camera { x: camera.x + mx, y: camera.y + my, zoom: camera.zoom }, size }
    }

    pub fn planned(&self) -> (Camera, (u32, u32)) {
        (self.planned, self.size)
    }

    pub fn look(&self, now: Camera) -> Lookup {
        let scale = self.planned.zoom / now.zoom;
        Lookup { scale, x: self.planned.x - now.x * scale, y: self.planned.y - now.y * scale }
    }

    pub fn serves(&self, now: Camera, (w, h): (u32, u32)) -> bool {
        let ratio = now.zoom / self.planned.zoom;
        if !(1.0 / HOLD_STRETCH..=HOLD_STRETCH).contains(&ratio) {
            return false;
        }
        let look = self.look(now);
        let seen = Rect::new(look.x, look.y, w as f64 * look.scale + look.x, h as f64 * look.scale + look.y);
        let held = Rect::new(0.0, 0.0, self.size.0 as f64, self.size.1 as f64).inflate(EDGE_SLACK, EDGE_SLACK);
        held.contains(seen.origin()) && held.contains(vello::kurbo::Point::new(seen.x1, seen.y1))
    }
}
