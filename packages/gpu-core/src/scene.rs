use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{color::AlphaColor, BlendMode, Brush, Color, ColorStop, Compose, Fill, Gradient, ImageBrush, ImageData, ImageQuality, Mix};
use vello::Scene;

use crate::display_list::{DisplayList, FillRule, ImageItem, Item, Look, Paint, PathItem, Rgba, Size, Stop};
use crate::pictures::{image_rect, Pictures};
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


fn unsupported(look: &Look) -> Option<&'static str> {
    let rules: [(bool, &'static str); 5] = [
        (look.blur > 0.0, "blur"),
        (look.scissor.is_some(), "wipe"),
        (look.masks.is_some() || look.matte.is_some(), "mask"),
        (look.filters.is_some(), "effect"),
        (look.backdrop.is_some(), "backdrop"),
    ];
    rules.iter().find(|(hit, _)| *hit).map(|(_, what)| *what)
}

fn layered(scene: &mut Scene, look: &Look, frame: Rect, paint: impl FnOnce(&mut Scene)) {
    let layer = look.opacity < 1.0 || look.blend != "normal";
    if layer {
        scene.push_layer(Fill::NonZero, BlendMode::new(mix(&look.blend), Compose::SrcOver), look.opacity, Affine::IDENTITY, &frame);
    }
    paint(scene);
    if layer {
        scene.pop_layer();
    }
}

fn draw(scene: &mut Scene, item: &PathItem, frame: Rect) {
    let transform = Affine::new(item.look.matrix);
    let brush = brush(&item.paint);
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
}

fn draw_image(scene: &mut Scene, item: &ImageItem, image: &ImageData) {
    let natural = Size { width: image.width as f64, height: image.height as f64 };
    let fitted = image_rect(item.size, natural, &item.fit, item.focus, item.zoom);
    let [k, _, _, _, tx, ty] = item.inner;
    let placed = Rect::new(fitted.x * k + tx, fitted.y * k + ty, (fitted.x + fitted.width) * k + tx, (fitted.y + fitted.height) * k + ty);
    let region = if item.clipped { placed.intersect(Rect::new(0.0, 0.0, item.size.width, item.size.height)) } else { placed };
    if region.is_zero_area() {
        return;
    }
    let texels = Affine::translate((placed.x0, placed.y0)) * Affine::scale_non_uniform(placed.width() / natural.width, placed.height() / natural.height);
    let brush = ImageBrush::new(image.clone()).with_quality(ImageQuality::Medium);
    scene.fill(Fill::NonZero, Affine::new(item.look.matrix), &brush, Some(texels), &region);
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

fn skip(skipped: &mut Vec<Skipped>, clip: &str, what: &str) {
    skipped.push(Skipped { clip: clip.into(), what: what.into() });
}

pub fn build(list: &DisplayList, pictures: &Pictures) -> (Scene, Vec<Skipped>) {
    let mut scene = Scene::new();
    let mut skipped = Vec::new();
    let frame = Rect::new(0.0, 0.0, list.width as f64, list.height as f64);
    for item in &list.items {
        match item {
            Item::Path(path) => match unsupported(&path.look) {
                Some(what) => skip(&mut skipped, &path.clip, what),
                None => layered(&mut scene, &path.look, frame, |s| draw(s, path, frame)),
            },
            Item::Image(image) => match (unsupported(&image.look), pictures.get(&image.clip)) {
                (Some(what), _) => skip(&mut skipped, &image.clip, what),
                (None, None) => skip(&mut skipped, &image.clip, "image"),
                (None, Some(data)) => layered(&mut scene, &image.look, frame, |s| draw_image(s, image, data)),
            },
            Item::Other { clip, kind } => skip(&mut skipped, clip, kind),
        }
    }
    (scene, skipped)
}
