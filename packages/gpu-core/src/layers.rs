use vello::kurbo::Rect;

use crate::canvas::Canvas;
use crate::display_list::{Cover, DisplayList, Item, Look, MaskMode, Rgba};
use crate::filters::{Fold, Fx, Runner};
use crate::scene::{alone, bounds, build_into, cover, layer_worthy, plain, silhouette, Layers, Placed, Shelf};

const UNIT_SPACE: [f64; 4] = [1.0, 0.0, 0.0, 1.0];
const REACH: f64 = 3.0;
const SLACK: f64 = 2.0;

pub type Tex<S> = <<S as Surface>::Runner as Runner>::Tex;
pub type Pic<S> = <<S as Surface>::Canvas as Canvas>::Picture;

pub trait Surface {
    type Canvas: Canvas;
    type Runner: Runner;
    type Error;

    fn frame(&self) -> Rect;
    fn paint(&mut self, region: Rect, base: Option<Rgba>, draw: &dyn Fn(&mut Self::Canvas)) -> Result<Tex<Self>, Self::Error>;
    fn runner(&self) -> &Self::Runner;
    fn place(&mut self, texture: Tex<Self>, region: Rect) -> Placed<Pic<Self>>;
}

fn reach(sigma: f64) -> f64 {
    if sigma > 0.0 {
        sigma * REACH + SLACK
    } else {
        SLACK
    }
}

fn snapped(r: Rect, frame: Rect) -> Rect {
    let r = r.intersect(frame);
    Rect::new(r.x0.floor(), r.y0.floor(), r.x1.ceil().max(r.x0.floor() + 1.0), r.y1.ceil().max(r.y0.floor() + 1.0))
}

pub fn prepare<S: Surface>(surface: &mut S, list: &DisplayList, pictures: &Shelf<Pic<S>>) -> Result<Layers<Pic<S>>, S::Error> {
    let mut layers = Layers::new();
    for (i, item) in list.items.iter().enumerate() {
        if let Some(sigma) = item.look().and_then(|l| l.backdrop) {
            let layer = behind(surface, list, i, &layers, pictures, sigma)?;
            layers.behind.insert(i, layer);
        }
        if layer_worthy(item) {
            let layer = body(surface, item, pictures)?;
            layers.bodies.insert(i, layer);
        }
    }
    Ok(layers)
}

fn behind<S: Surface>(surface: &mut S, list: &DisplayList, at: usize, layers: &Layers<Pic<S>>, pictures: &Shelf<Pic<S>>, sigma: f64) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let item = &list.items[at];
    let margin = reach(sigma);
    let region = snapped(bounds::<S::Canvas>(item, pictures).unwrap_or(frame).inflate(margin, margin), frame);
    let under = DisplayList { items: list.items[..at].to_vec(), ..list.clone_empty() };
    let below = surface.paint(region, list.background, &|c| {
        build_into(c, &under, pictures, layers);
    })?;
    let shape = surface.paint(region, None, &|c| silhouette(c, item, pictures, frame))?;
    let fx = Fx { runner: surface.runner() };
    let texture = fx.masked(&fx.blurred(below, sigma), &shape);
    Ok(surface.place(texture, region))
}

fn region<S: Surface>(surface: &S, item: &Item, look: &Look, pictures: &Shelf<Pic<S>>) -> Rect {
    let frame = surface.frame();
    if look.filters.is_some() {
        return frame;
    }
    let feather = look.masks.iter().flatten().map(|m| m.feather).fold(0.0, f64::max);
    let margin = reach(look.blur) + reach(feather);
    snapped(bounds::<S::Canvas>(item, pictures).unwrap_or(frame).inflate(margin, margin), frame)
}

fn body<S: Surface>(surface: &mut S, item: &Item, pictures: &Shelf<Pic<S>>) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let look = item.look().expect("a drawable item");
    let region = region(surface, item, look, pictures);
    let drawn = surface.paint(region, None, &|c| alone(c, item, pictures, frame))?;
    let mask = mask(surface, look, pictures, region)?;
    let fx = Fx { runner: surface.runner() };
    let filtered = match &look.filters {
        Some(filters) => fx.apply(drawn, filters, look.space.unwrap_or(UNIT_SPACE)),
        None => drawn,
    };
    let blurred = fx.blurred(filtered, look.blur);
    let texture = match mask {
        Some(mask) => fx.masked(&blurred, &mask),
        None => blurred,
    };
    Ok(surface.place(texture, region))
}

fn mask<S: Surface>(surface: &mut S, look: &Look, pictures: &Shelf<Pic<S>>, region: Rect) -> Result<Option<Tex<S>>, S::Error> {
    let frame = surface.frame();
    let mut acc: Option<Tex<S>> = None;
    for layer in look.masks.iter().flatten() {
        let covered = surface.paint(region, None, &|c| cover(c, &layer.cover, pictures))?;
        let fx = Fx { runner: surface.runner() };
        let luma = matches!(layer.cover, Cover::Picture { luma: true, .. });
        acc = Some(fx.folded(acc.as_ref(), &fx.blurred(covered, layer.feather), Fold { mode: layer.mode, level: layer.level, invert: layer.invert, luma }));
    }
    if let Some(matte) = &look.matte {
        let covered = surface.paint(region, None, &|c| plain(c, &matte.items, pictures, frame))?;
        let fx = Fx { runner: surface.runner() };
        acc = Some(fx.folded(acc.as_ref(), &covered, Fold { mode: MaskMode::Intersect, level: 1.0, invert: matte.invert, luma: matte.luma }));
    }
    Ok(acc)
}
