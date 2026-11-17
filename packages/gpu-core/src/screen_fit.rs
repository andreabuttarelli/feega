use crate::display_list::{DisplayList, Item, UseItem};
use crate::groups::Library;
use crate::held_view::HeldView;
use crate::retained::{Camera, Retained};

const ORIGIN: Camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
const FITTED_GROUP: &str = "fitted-frame";

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

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Piece {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

pub fn pieces((width, height): (u32, u32), (side_w, side_h): (u32, u32)) -> Vec<Piece> {
    let starts = |total: u32, step: u32| (0..total).step_by(step.max(1) as usize).map(move |at| (at, step.min(total - at)));
    starts(height, side_h).flat_map(|(y, h)| starts(width, side_w).map(move |(x, w)| Piece { x, y, w, h })).collect()
}

pub fn fitted_list(library: &mut Library, list: DisplayList, fit: Fit, (x, y): (f64, f64)) -> DisplayList {
    if fit.scale == 1.0 && x == 0.0 && y == 0.0 && fit.size == (list.width, list.height) {
        return list;
    }
    library.put_group(FITTED_GROUP, &list);
    let whole = UseItem { clip: FITTED_GROUP.into(), group: FITTED_GROUP.into(), matrix: [fit.scale, 0.0, 0.0, fit.scale, -x * fit.scale, -y * fit.scale], cache: false, hold: false, reach: None };
    DisplayList { width: fit.size.0, height: fit.size.1, background: list.background, items: vec![Item::Use(whole)], faces: list.faces, fragments: Default::default() }
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
