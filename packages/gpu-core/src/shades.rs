use std::f64::consts::SQRT_2;

use vello::kurbo::{Affine, Rect, Shape, Vec2};

use crate::colour::rgba_of;
use crate::display_list::{CssFunction, FillRule, Filter, Item, Paint, PathItem, Rgba};
use crate::scene::clip_covers;

const BLUR: &str = "blur";
const DROP_SHADOW: &str = "drop-shadow";
const PX: &str = "px";
const UNIT_SPACE: [f64; 4] = [1.0, 0.0, 0.0, 1.0];
const BLACK: Rgba = [0.0, 0.0, 0.0, 1.0];
const CSS_BLUR_TO_SIGMA: f64 = 0.5;
const FIT_PX: f64 = 0.05;
const FIT_SHARE: f64 = 1e-3;
const ON_EDGE: f64 = 1e-3;
const ANISOTROPY: f64 = 0.02;
const AREA_SHARE: f64 = 1e-2;
const OUTER_REACH: f64 = 3.0;
const MIN_SIDE_SIGMAS: f64 = 5.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Outer,
    Inner,
    Behind,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Shade {
    pub side: Side,
    pub rect: Rect,
    pub radius: f64,
    pub sigma: f64,
    pub color: Rgba,
    pub extent: Rect,
}

impl Shade {
    pub fn erf_width(&self) -> f64 {
        self.sigma * SQRT_2
    }

    fn wide_enough(&self) -> bool {
        self.rect.width().min(self.rect.height()) >= MIN_SIDE_SIGMAS * self.sigma
    }

    fn outer(side: Side, rect: Rect, radius: f64, sigma: f64, color: Rgba) -> Shade {
        Shade { side, rect, radius, sigma, color, extent: rect.inflate(sigma * OUTER_REACH, sigma * OUTER_REACH) }
    }
}

pub fn shade_of(item: &Item) -> Option<Shade> {
    let Item::Path(path) = item else {
        return None;
    };
    let Paint::Solid { color } = path.paint else {
        return None;
    };
    let look = &path.look;
    if path.within.is_some() || look.blur > 0.0 || look.matte.is_some() || look.backdrop.is_some() || (look.masks.is_some() && clip_covers(look).is_none()) {
        return None;
    }
    let [Filter::Css { fns }] = look.filters.as_deref()? else {
        return None;
    };
    let [f] = fns.as_slice() else {
        return None;
    };
    let own = conformal_scale(&look.matrix)?;
    let space = look.space.unwrap_or(UNIT_SPACE);
    let shade = match f.name.as_str() {
        BLUR => blurred(path, color, local_sigma(px(f.args.first())?, space, own)?),
        DROP_SHADOW if color[3] >= 1.0 => dropped(path, f, space, own),
        _ => None,
    }?;
    shade.wide_enough().then_some(shade)
}

fn blurred(path: &PathItem, color: Rgba, sigma: f64) -> Option<Shade> {
    match path.contours.as_slice() {
        [outline] => {
            let (rect, radius) = rounded_rect(outline)?;
            Some(Shade::outer(Side::Outer, rect, radius, sigma, color))
        }
        [around, hole] if path.rule == FillRule::EvenOdd && path.look.masks.is_some() => {
            let (extent, corner) = rounded_rect(around)?;
            let (rect, radius) = rounded_rect(hole)?;
            (corner == 0.0 && extent.contains_rect(rect)).then_some(Shade { side: Side::Inner, rect, radius, sigma, color, extent })
        }
        _ => None,
    }
}

fn dropped(path: &PathItem, f: &CssFunction, space: [f64; 4], own: f64) -> Option<Shade> {
    let [outline] = path.contours.as_slice() else {
        return None;
    };
    let (body, radius) = rounded_rect(outline)?;
    let (dx, dy) = (px(f.args.first())?, px(f.args.get(1))?);
    let sigma = local_sigma(px(f.args.get(2))? * CSS_BLUR_TO_SIGMA, space, own)?;
    let color = f.args.get(3..).map(|rest| rest.join(" ")).filter(|c| !c.is_empty()).map_or(Some(BLACK), |c| rgba_of(&c))?;
    let device = Vec2::new(space[0] * dx + space[2] * dy, space[1] * dx + space[3] * dy);
    let m = path.look.matrix;
    let local = Affine::new([m[0], m[1], m[2], m[3], 0.0, 0.0]).inverse() * device.to_point();
    Some(Shade::outer(Side::Behind, body + local.to_vec2(), radius, sigma, color))
}

fn px(arg: Option<&String>) -> Option<f64> {
    let raw = arg?.trim();
    raw.strip_suffix(PX).unwrap_or(raw).trim().parse().ok()
}

fn local_sigma(css_px: f64, space: [f64; 4], own: f64) -> Option<f64> {
    let device = css_px * (space[0] * space[3] - space[1] * space[2]).abs().sqrt();
    (device > 0.0).then_some(device / own)
}

fn conformal_scale(m: &[f64]) -> Option<f64> {
    let [a, b, c, d] = [m[0], m[1], m[2], m[3]];
    let scale = (a * d - b * c).abs().sqrt();
    let near = |x: f64, y: f64| (x - y).abs() <= ANISOTROPY * scale;
    let rotation = near(a, d) && near(b, -c);
    let reflection = near(a, -d) && near(b, c);
    (scale > 0.0 && (rotation || reflection)).then_some(scale)
}

fn rounded_rect(points: &[f64]) -> Option<(Rect, f64)> {
    let xy: Vec<(f64, f64)> = points.chunks_exact(2).map(|p| (p[0], p[1])).collect();
    if xy.len() < 4 {
        return None;
    }
    let bounds = xy.iter().fold(Rect::new(f64::MAX, f64::MAX, f64::MIN, f64::MIN), |r, &(x, y)| Rect::new(r.x0.min(x), r.y0.min(y), r.x1.max(x), r.y1.max(y)));
    let tolerance = FIT_PX + FIT_SHARE * bounds.width().max(bounds.height());
    let first_on_top = xy.iter().filter(|(_, y)| (y - bounds.y0).abs() <= ON_EDGE).map(|(x, _)| x - bounds.x0).fold(f64::MAX, f64::min);
    let radius = if first_on_top <= tolerance { 0.0 } else { first_on_top };
    if radius > bounds.width().min(bounds.height()) / 2.0 + tolerance || !xy.iter().all(|&p| distance(bounds, radius, p).abs() <= tolerance) {
        return None;
    }
    let drawn = polygon_area(&xy).abs();
    let expected = bounds.to_rounded_rect(radius).area();
    ((drawn - expected).abs() <= AREA_SHARE * expected).then_some((bounds, radius))
}

fn distance(r: Rect, radius: f64, (x, y): (f64, f64)) -> f64 {
    let c = r.center();
    let qx = (x - c.x).abs() - (r.width() / 2.0 - radius);
    let qy = (y - c.y).abs() - (r.height() / 2.0 - radius);
    qx.max(0.0).hypot(qy.max(0.0)) + qx.max(qy).min(0.0) - radius
}

fn polygon_area(xy: &[(f64, f64)]) -> f64 {
    xy.iter().zip(xy.iter().cycle().skip(1)).map(|(a, b)| a.0 * b.1 - b.0 * a.1).sum::<f64>() / 2.0
}
