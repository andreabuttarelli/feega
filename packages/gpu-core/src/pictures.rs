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
