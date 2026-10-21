use vello::kurbo::{Affine, BezPath, Point, Rect};
use vello::peniko::{color::AlphaColor, BlendMode, Brush, Color, ColorStop, Compose, Fill, Gradient, ImageBrush, ImageData, ImageQuality, Mix};
use vello::Scene;

use crate::display_list::{Paint, Rgba, Size, Stop};

pub trait Canvas {
    type Picture: Clone;

    fn size(picture: &Self::Picture) -> Size;
    fn fill(&mut self, rule: Fill, transform: Affine, paint: &Paint, shape: &BezPath);
    fn picture(&mut self, transform: Affine, picture: &Self::Picture, texels: Affine, region: Rect);
    fn push_layer(&mut self, blend: Mix, opacity: f32, frame: Rect);
    fn push_clip(&mut self, rule: Fill, transform: Affine, shape: &BezPath);
    fn pop(&mut self);

    fn fragment(&mut self, _encoded: &Scene, _transform: Affine) -> bool {
        false
    }
}

pub fn colour(c: &Rgba) -> Color {
    AlphaColor::new(*c)
}

fn stops(list: &[Stop]) -> Vec<ColorStop> {
    list.iter().map(|s| ColorStop::from((s.at, colour(&s.color)))).collect()
}

pub fn brush<I>(paint: &Paint) -> Brush<I> {
    match paint {
        Paint::Solid { color } => Brush::Solid(colour(color)),
        Paint::Linear { from, to, stops: s } => Brush::Gradient(Gradient::new_linear(Point::new(from[0], from[1]), Point::new(to[0], to[1])).with_stops(stops(s).as_slice())),
        Paint::Radial { center, radius, stops: s } => Brush::Gradient(Gradient::new_radial(Point::new(center[0], center[1]), *radius as f32).with_stops(stops(s).as_slice())),
    }
}

pub fn mix(name: &str) -> Mix {
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

impl Canvas for Scene {
    type Picture = ImageData;

    fn size(picture: &ImageData) -> Size {
        Size { width: picture.width as f64, height: picture.height as f64 }
    }

    fn fill(&mut self, rule: Fill, transform: Affine, paint: &Paint, shape: &BezPath) {
        Scene::fill(self, rule, transform, &brush::<ImageBrush>(paint), None, shape);
    }

    fn picture(&mut self, transform: Affine, picture: &ImageData, texels: Affine, region: Rect) {
        let brush = ImageBrush::new(picture.clone()).with_quality(ImageQuality::Medium);
        Scene::fill(self, Fill::NonZero, transform, &brush, Some(texels), &region);
    }

    fn push_layer(&mut self, blend: Mix, opacity: f32, frame: Rect) {
        Scene::push_layer(self, Fill::NonZero, BlendMode::new(blend, Compose::SrcOver), opacity, Affine::IDENTITY, &frame);
    }

    fn push_clip(&mut self, rule: Fill, transform: Affine, shape: &BezPath) {
        self.push_clip_layer(rule, transform, shape);
    }

    fn pop(&mut self) {
        self.pop_layer();
    }

    fn fragment(&mut self, encoded: &Scene, transform: Affine) -> bool {
        self.append(encoded, Some(transform));
        true
    }
}
