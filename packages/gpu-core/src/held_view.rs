use vello::kurbo::{Affine, Rect};

use crate::retained::Camera;

pub const ZOOM_IN_ROOM: f64 = std::f64::consts::SQRT_2;
pub const ZOOM_OUT_ROOM: f64 = 0.7;
const MARGIN_SHARE: f64 = 0.25;
const EDGE_SLACK: f64 = 1e-6;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct HeldView {
    camera: Camera,
    margin: (f64, f64),
    size: (u32, u32),
}

impl HeldView {
    pub fn around(camera: Camera, (w, h): (u32, u32)) -> HeldView {
        let margin = ((w as f64 * MARGIN_SHARE).round(), (h as f64 * MARGIN_SHARE).round());
        let size = (w + 2 * margin.0 as u32, h + 2 * margin.1 as u32);
        HeldView { camera, margin, size }
    }

    pub fn planned(&self) -> (Camera, (u32, u32)) {
        let c = self.camera;
        (Camera { x: c.x + self.margin.0, y: c.y + self.margin.1, zoom: c.zoom }, self.size)
    }

    pub fn transform(&self, now: Camera) -> Affine {
        let (planned, _) = self.planned();
        Affine::new(now.matrix()) * Affine::new(planned.matrix()).inverse()
    }

    pub fn holds(&self, now: Camera, (w, h): (u32, u32)) -> bool {
        let ratio = now.zoom / self.camera.zoom;
        if !(ZOOM_OUT_ROOM..=ZOOM_IN_ROOM).contains(&ratio) {
            return false;
        }
        let seen = self.transform(now).inverse().transform_rect_bbox(Rect::new(0.0, 0.0, w as f64, h as f64));
        let held = Rect::new(0.0, 0.0, self.size.0 as f64, self.size.1 as f64).inflate(EDGE_SLACK, EDGE_SLACK);
        held.contains(seen.origin()) && held.contains(vello::kurbo::Point::new(seen.x1, seen.y1))
    }
}
