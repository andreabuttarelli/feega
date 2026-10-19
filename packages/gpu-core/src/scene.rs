use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{color::AlphaColor, BlendMode, Brush, Color, ColorStop, Compose, Fill, Gradient, Mix};
use vello::Scene;

use crate::display_list::{DisplayList, FillRule, Item, Paint, PathItem, Rgba, Stop};
use crate::Skipped;

fn colour(c: &Rgba) -> Color {
    AlphaColor::new(*c)
}

fn stops(list: &[Stop]) -> Vec<ColorStop> {
    list.iter().map(|s| ColorStop::from((s.at, colour(&s.color)))).collect()
}

fn brush(paint: &Paint) -> Brush {
    match paint {
        Paint::Solid { color } => Brush::Solid(colour(color)),
        Paint::Linear { from, to, stops: s } => Brush::Gradient(Gradient::new_linear(Point::new(from[0], from[1]), Point::new(to[0], to[1])).with_stops(stops(s).as_slice())),
        Paint::Radial { center, radius, stops: s } => Brush::Gradient(Gradient::new_radial(Point::new(center[0], center[1]), *radius as f32).with_stops(stops(s).as_slice())),
    }
}

fn polygon(points: &[f64]) -> BezPath {
    let mut path = BezPath::new();
    for (i, xy) in points.chunks_exact(2).enumerate() {
        let p = Point::new(xy[0], xy[1]);
        if i == 0 {
            path.move_to(p);
        } else {
            path.line_to(p);
        }
    }
    path.close_path();
    path
}

fn mix(name: &str) -> Mix {
    match name {
        "multiply" => Mix::Multiply,
        "screen" => Mix::Screen,
        "overlay" => Mix::Overlay,
        "darken" => Mix::Darken,
        "lighten" => Mix::Lighten,
        "color-dodge" => Mix::ColorDodge,
        "color-burn" => Mix::ColorBurn,
        "hard-light" => Mix::HardLight,
        "soft-light" => Mix::SoftLight,
        "difference" => Mix::Difference,
        "exclusion" => Mix::Exclusion,
        "hue" => Mix::Hue,
        "saturation" => Mix::Saturation,
        "color" => Mix::Color,
        "luminosity" => Mix::Luminosity,
        _ => Mix::Normal,
    }
}

fn unsupported(item: &PathItem) -> Option<&'static str> {
    let rules: [(bool, &'static str); 5] = [
        (item.blur > 0.0, "blur"),
        (item.scissor.is_some(), "wipe"),
        (item.masks.is_some() || item.matte.is_some(), "mask"),
        (item.filters.is_some(), "effect"),
        (item.backdrop.is_some(), "backdrop"),
    ];
    rules.iter().find(|(hit, _)| *hit).map(|(_, what)| *what)
}

fn draw(scene: &mut Scene, item: &PathItem, frame: Rect) {
    let m = item.matrix;
    let transform = Affine::new(m);
    let brush = brush(&item.paint);
    let layered = item.opacity < 1.0 || item.blend != "normal";
    if layered {
        scene.push_layer(Fill::NonZero, BlendMode::new(mix(&item.blend), Compose::SrcOver), item.opacity, Affine::IDENTITY, &frame);
    }
    if let Some(within) = &item.within {
        let mut region = joined(&within.contours);
        if within.outside {
            region.extend(frame_in(transform, frame));
        }
        let rule = if within.outside { Fill::EvenOdd } else { Fill::NonZero };
        scene.push_clip_layer(rule, transform, &region);
    }
    if item.rule == FillRule::Union {
        for contour in &item.contours {
            scene.fill(Fill::NonZero, transform, &brush, None, &polygon(contour));
        }
    } else {
        let rule = if item.rule == FillRule::EvenOdd { Fill::EvenOdd } else { Fill::NonZero };
        scene.fill(rule, transform, &brush, None, &joined(&item.contours));
    }
    if item.within.is_some() {
        scene.pop_layer();
    }
    if layered {
        scene.pop_layer();
    }
}

fn joined(contours: &[Vec<f64>]) -> BezPath {
    let mut path = BezPath::new();
    for contour in contours {
        path.extend(polygon(contour));
    }
    path
}

fn frame_in(transform: Affine, frame: Rect) -> BezPath {
    let inverse = transform.inverse();
    let corners = [(frame.x0, frame.y0), (frame.x1, frame.y0), (frame.x1, frame.y1), (frame.x0, frame.y1)].map(|(x, y)| inverse * Point::new(x, y));
    polygon(&corners.iter().flat_map(|p| [p.x, p.y]).collect::<Vec<_>>())
}

pub fn build(list: &DisplayList) -> (Scene, Vec<Skipped>) {
    let mut scene = Scene::new();
    let mut skipped = Vec::new();
    let frame = Rect::new(0.0, 0.0, list.width as f64, list.height as f64);
    for item in &list.items {
        match item {
            Item::Path(path) => match unsupported(path) {
                Some(what) => skipped.push(Skipped { clip: path.clip.clone(), what: what.into() }),
                None => draw(&mut scene, path, frame),
            },
            Item::Other { clip, kind } => skipped.push(Skipped { clip: clip.clone(), what: kind.clone() }),
        }
    }
    (scene, skipped)
}
