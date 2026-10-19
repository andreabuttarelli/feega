use std::collections::HashMap;

use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{color::AlphaColor, BlendMode, Brush, Color, ColorStop, Compose, Fill, Gradient, ImageBrush, ImageData, ImageQuality, Mix};
use vello::Scene;

use crate::display_list::{Cover, DisplayList, FillRule, ImageItem, Item, Look, Paint, PathItem, Ramp, Rgba, Size, Stop};
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

pub fn needs_layer(look: &Look) -> bool {
    look.blur > 0.0 || look.masks.is_some() || look.matte.is_some() || look.filters.is_some()
}

pub fn layer_worthy(item: &Item) -> bool {
    item.look().is_some_and(needs_layer)
}

fn layered(scene: &mut Scene, blend: &str, opacity: f32, frame: Rect, paint: impl FnOnce(&mut Scene)) {
    let layer = opacity < 1.0 || blend != "normal";
    if layer {
        scene.push_layer(Fill::NonZero, BlendMode::new(mix(blend), Compose::SrcOver), opacity, Affine::IDENTITY, &frame);
    }
    paint(scene);
    if layer {
        scene.pop_layer();
    }
}

fn scissored(scene: &mut Scene, look: &Look, paint: impl FnOnce(&mut Scene)) {
    let Some([x0, y0, x1, y1]) = look.scissor else {
        paint(scene);
        return;
    };
    scene.push_clip_layer(Fill::NonZero, Affine::IDENTITY, &Rect::new(x0, y0, x1, y1));
    paint(scene);
    scene.pop_layer();
}

fn content(scene: &mut Scene, item: &Item, pictures: &Pictures, frame: Rect) {
    match item {
        Item::Path(path) => draw(scene, path, frame),
        Item::Image(image) => {
            if let Some(data) = pictures.get(&image.clip) {
                draw_image(scene, image, data);
            }
        }
        Item::Other { .. } => {}
    }
}

const WHITE: Rgba = [1.0, 1.0, 1.0, 1.0];
const CLEAR: Rgba = [1.0, 1.0, 1.0, 0.0];

fn ramp(kind: Ramp) -> Brush {
    let stops = [ColorStop::from((0.0, colour(&WHITE))), ColorStop::from((1.0, colour(&CLEAR)))];
    let gradient = match kind {
        Ramp::Linear => Gradient::new_linear(Point::new(0.0, 0.5), Point::new(1.0, 0.5)),
        Ramp::Radial => Gradient::new_radial(Point::new(0.5, 0.5), 0.5),
    };
    Brush::Gradient(gradient.with_stops(stops.as_slice()))
}

pub fn alone(item: &Item, pictures: &Pictures, frame: Rect) -> Scene {
    let mut scene = Scene::new();
    content(&mut scene, item, pictures, frame);
    scene
}

pub fn cover(cover: &Cover, pictures: &Pictures) -> Scene {
    let mut scene = Scene::new();
    match cover {
        Cover::Path { contours, matrix } => scene.fill(Fill::NonZero, Affine::new(*matrix), &Brush::Solid(colour(&WHITE)), None, &joined(contours)),
        Cover::Ramp { ramp: kind, contours, matrix } => scene.fill(Fill::NonZero, Affine::new(*matrix), &ramp(*kind), None, &joined(contours)),
        Cover::Picture { src, matrix, .. } => {
            if let Some(image) = pictures.get(src) {
                let texels = Affine::scale_non_uniform(1.0 / image.width as f64, 1.0 / image.height as f64);
                let brush = ImageBrush::new(image.clone()).with_quality(ImageQuality::Medium);
                scene.fill(Fill::NonZero, Affine::new(*matrix), &brush, Some(texels), &Rect::new(0.0, 0.0, 1.0, 1.0));
            }
        }
    }
    scene
}

pub fn plain(items: &[Item], pictures: &Pictures, frame: Rect) -> Scene {
    let mut scene = Scene::new();
    for item in items {
        let opacity = item.look().map_or(1.0, |l| l.opacity);
        layered(&mut scene, "normal", opacity, frame, |s| content(s, item, pictures, frame));
    }
    scene
}

#[derive(Default)]
pub struct Layers {
    pub bodies: HashMap<usize, ImageData>,
    pub behind: HashMap<usize, ImageData>,
}

impl Layers {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn into_images(self) -> impl Iterator<Item = ImageData> {
        self.bodies.into_values().chain(self.behind.into_values())
    }
}

fn full_frame(scene: &mut Scene, image: &ImageData) {
    scene.draw_image(&ImageBrush::new(image.clone()), Affine::IDENTITY);
}

pub fn silhouette(item: &Item, pictures: &Pictures, frame: Rect) -> Scene {
    let white = match item {
        Item::Path(path) => Item::Path(PathItem { paint: Paint::Solid { color: WHITE }, ..path.clone() }),
        other => other.clone(),
    };
    alone(&white, pictures, frame)
}

pub fn build(list: &DisplayList, pictures: &Pictures, layers: &Layers) -> (Scene, Vec<Skipped>) {
    let mut scene = Scene::new();
    let mut skipped = Vec::new();
    let frame = Rect::new(0.0, 0.0, list.width as f64, list.height as f64);
    for (i, item) in list.items.iter().enumerate() {
        let Some(look) = item.look() else {
            skip(&mut skipped, item.clip(), item.kind());
            continue;
        };
        if look.backdrop.is_some() {
            match layers.behind.get(&i) {
                Some(image) => scissored(&mut scene, look, |s| full_frame(s, image)),
                None => skip(&mut skipped, item.clip(), "backdrop"),
            }
        }
        if needs_layer(look) {
            match layers.bodies.get(&i) {
                Some(image) => scissored(&mut scene, look, |s| layered(s, &look.blend, look.opacity, frame, |s| full_frame(s, image))),
                None => skip(&mut skipped, item.clip(), "layer"),
            }
            continue;
        }
        if let Item::Image(image) = item {
            if !pictures.contains_key(&image.clip) {
                skip(&mut skipped, item.clip(), "image");
                continue;
            }
        }
        scissored(&mut scene, look, |s| layered(s, &look.blend, look.opacity, frame, |s| content(s, item, pictures, frame)));
    }
    (scene, skipped)
}
