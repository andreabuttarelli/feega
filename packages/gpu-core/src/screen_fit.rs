use crate::held_view::HeldView;
use crate::retained::{Camera, Retained};

const ORIGIN: Camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Fit {
    pub size: (u32, u32),
    pub scale: f64,
}

pub fn fit((width, height): (u32, u32), side: u32) -> Fit {
    let longest = width.max(height);
    if longest <= side {
        return Fit { size: (width, height), scale: 1.0 };
    }
    let scale = f64::from(side) / f64::from(longest);
    let scaled = |v: u32| ((f64::from(v) * scale).round() as u32).clamp(1, side);
    Fit { size: (scaled(width), scaled(height)), scale }
}

pub fn screen_targets(size: (u32, u32)) -> [(u32, u32); 3] {
    [size, Retained::new(size.0, size.1).size(), HeldView::around(ORIGIN, size).planned().1]
}

fn fits(side: u32, limit: u32) -> bool {
    screen_targets((side, side)).iter().all(|&(w, h)| w <= limit && h <= limit)
}

pub fn screen_side(limit: u32) -> u32 {
    let (mut low, mut high) = (1, limit);
    while low < high {
        let mid = (low + high + 1) / 2;
        if fits(mid, limit) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    low
}
