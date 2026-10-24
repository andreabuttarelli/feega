use std::collections::HashMap;
use std::sync::Arc;

use vello::peniko::{Blob, ImageAlphaType, ImageData, ImageFormat};

use crate::display_list::Size;

pub type Pictures = HashMap<String, ImageData>;

pub fn picture(width: u32, height: u32, rgba: Vec<u8>) -> ImageData {
    ImageData { data: Blob::new(Arc::new(rgba)), format: ImageFormat::Rgba8, alpha_type: ImageAlphaType::Alpha, width, height }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Placed {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn fit_scale(fit: &str, a: f64, b: f64) -> (f64, f64) {
    match fit {
        "contain" => (a.min(b), a.min(b)),
        "width" => (a, a),
        "fill" => (a, b),
        _ => (a.max(b), a.max(b)),
    }
}

pub fn image_rect(boxed: Size, natural: Size, fit: &str, focus: [f64; 2], zoom: f64) -> Placed {
    let (sx, sy) = fit_scale(fit, boxed.width / natural.width, boxed.height / natural.height);
    let (width, height) = (natural.width * sx, natural.height * sy);
    let (px, py) = (focus[0] * boxed.width, focus[1] * boxed.height);
    let x = (boxed.width - width) * focus[0];
    let y = (boxed.height - height) * focus[1];
    Placed { x: px + (x - px) * zoom, y: py + (y - py) * zoom, width: width * zoom, height: height * zoom }
}

pub const MAX_TILES: usize = 2500;
const TILE_SHARE: f64 = 0.25;

pub fn crop_rect(boxed: Size, [x, y, w, h]: [f64; 4]) -> Placed {
    Placed { x: -x / w * boxed.width, y: -y / h * boxed.height, width: boxed.width / w, height: boxed.height / h }
}

fn reach(boxed: Size, rotation: f64) -> (f64, f64, f64, f64) {
    let (cx, cy) = (boxed.width / 2.0, boxed.height / 2.0);
    let (sin, cos) = (-rotation).to_radians().sin_cos();
    let corners = [(0.0, 0.0), (boxed.width, 0.0), (0.0, boxed.height), (boxed.width, boxed.height)]
        .map(|(x, y)| (cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos));
    let low = |f: fn(&(f64, f64)) -> f64| corners.iter().map(f).fold(f64::INFINITY, f64::min);
    let high = |f: fn(&(f64, f64)) -> f64| corners.iter().map(f).fold(f64::NEG_INFINITY, f64::max);
    (low(|c| c.0), high(|c| c.0), low(|c| c.1), high(|c| c.1))
}

pub fn tile_cells(boxed: Size, natural: Size, scale: f64, rotation: f64, focus: [f64; 2]) -> Vec<Placed> {
    let width = boxed.width * scale * TILE_SHARE;
    let height = width * natural.height / natural.width;
    let origin = ((boxed.width - width) * focus[0], (boxed.height - height) * focus[1]);
    let (min_x, max_x, min_y, max_y) = reach(boxed, rotation);
    let start = (origin.0 + ((min_x - origin.0) / width).floor() * width, origin.1 + ((min_y - origin.1) / height).floor() * height);
    let mut cells = Vec::new();
    let mut y = start.1;
    while y < max_y {
        let mut x = start.0;
        while x < max_x {
            if cells.len() == MAX_TILES {
                return cells;
            }
            cells.push(Placed { x, y, width, height });
            x += width;
        }
        y += height;
    }
    cells
}
