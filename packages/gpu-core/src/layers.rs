use vello::kurbo::Rect;

use crate::canvas::Canvas;
use crate::display_list::{Cover, DisplayList, Item, Lens, Look, MaskMode, Rgba};
use crate::fragments::Fragments;
use crate::filters::{reach as filter_reach, Fold, Fx, Reach, Runner};
use crate::canvas::shader_only;
use crate::scene::{alone, bounds, build_items, cover, layer_worthy, plain, silhouette, unblended, Layers, Placed, Shelf};

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

    fn recall(&mut self, _item: &Item) -> Option<Placed<Pic<Self>>> {
        None
    }

    fn remember(&mut self, _item: &Item, _placed: &Placed<Pic<Self>>) {}
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Blending {
    #[default]
    Native,
    Composited,
}

pub fn prepare<S: Surface>(surface: &mut S, list: &DisplayList, pictures: &Shelf<Pic<S>>, blending: Blending) -> Result<Layers<Pic<S>>, S::Error> {
    prepare_items(surface, &list.items, list.background, pictures, blending, &list.fragments)
}

fn composited_blend(item: &Item, blending: Blending) -> bool {
    item.look().is_some_and(|l| l.blend != "normal" && (blending == Blending::Composited || shader_only(&l.blend)))
}

fn prepare_items<S: Surface>(surface: &mut S, items: &[Item], background: Option<Rgba>, pictures: &Shelf<Pic<S>>, blending: Blending, fragments: &Fragments) -> Result<Layers<Pic<S>>, S::Error> {
    let mut layers = Layers::new();
    layers.fragments = fragments.clone();
    for (i, item) in items.iter().enumerate() {
        if let Item::Lens(lens) = item {
            let layer = refracted(surface, &items[lens.under.min(i)..i], &layers, pictures, &lens.lens)?;
            layers.behind.insert(i, layer);
            continue;
        }
        if let Some(sigma) = item.look().and_then(|l| l.backdrop) {
            let layer = behind(surface, items, i, background, &layers, pictures, sigma)?;
            layers.behind.insert(i, layer);
        }
        if layer_worthy(item) && !composited_blend(item, blending) && off_frame(surface, item, pictures) {
            layers.culled.insert(i);
            continue;
        }
        let recalled = if layer_worthy(item) { surface.recall(item) } else { None };
        if let (Item::Group(group), None) = (item, &recalled) {
            let inner = prepare_items(surface, &group.items, None, pictures, blending, fragments)?;
            layers.groups.insert(i, inner);
        }
        if layer_worthy(item) {
            let layer = match recalled {
                Some(layer) => layer,
                None => {
                    let made = body(surface, item, pictures, layers.groups.get(&i))?;
                    surface.remember(item, &made);
                    made
                }
            };
            layers.bodies.insert(i, layer);
        }
        if composited_blend(item, blending) {
            let layer = composited(surface, items, i, background, &layers, pictures)?;
            layers.blended.insert(i, layer);
        }
    }
    Ok(layers)
}

fn composited<S: Surface>(surface: &mut S, items: &[Item], at: usize, background: Option<Rgba>, layers: &Layers<Pic<S>>, pictures: &Shelf<Pic<S>>) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let look = items[at].look().expect("a drawable item");
    let region = region(surface, &items[at], look, pictures);
    let below = surface.paint(region, background, &|c| {
        build_items(c, &items[..at], frame, pictures, layers);
    })?;
    let top = surface.paint(region, None, &|c| unblended(c, items, at, frame, pictures, layers))?;
    let fx = Fx { runner: surface.runner() };
    let texture = fx.blended(top, &below, &look.blend, look.opacity);
    Ok(surface.place(texture, region))
}

fn behind<S: Surface>(surface: &mut S, items: &[Item], at: usize, background: Option<Rgba>, layers: &Layers<Pic<S>>, pictures: &Shelf<Pic<S>>, sigma: f64) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let item = &items[at];
    let margin = reach(sigma);
    let region = snapped(bounds::<S::Canvas>(item, pictures).unwrap_or(frame).inflate(margin, margin), frame);
    let below = surface.paint(region, background, &|c| {
        build_items(c, &items[..at], frame, pictures, layers);
    })?;
    let shape = surface.paint(region, None, &|c| silhouette(c, item, pictures, frame))?;
    let fx = Fx { runner: surface.runner() };
    let texture = fx.masked(&fx.blurred(below, sigma), &shape);
    Ok(surface.place(texture, region))
}

fn refracted<S: Surface>(surface: &mut S, under: &[Item], layers: &Layers<Pic<S>>, pictures: &Shelf<Pic<S>>, lens: &Lens) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let content = surface.paint(frame, None, &|c| {
        build_items(c, under, frame, pictures, layers);
    })?;
    let fx = Fx { runner: surface.runner() };
    Ok(surface.place(fx.refracted(&content, &lens.params()), frame))
}

fn inflated<C: Canvas>(item: &Item, look: &Look, pictures: &Shelf<C::Picture>) -> Option<Rect> {
    let filtered = match &look.filters {
        Some(filters) => filter_reach(filters, look.space.unwrap_or(UNIT_SPACE)),
        None => Some(Reach::default()),
    }?;
    let own = bounds::<C>(item, pictures)?;
    let feather = look.masks.iter().flatten().map(|m| m.feather).fold(0.0, f64::max);
    let margin = reach(look.blur) + reach(feather) + filtered.px;
    Some(own.inflate(margin + own.width() * filtered.share, margin + own.height() * filtered.share))
}

fn region<S: Surface>(surface: &S, item: &Item, look: &Look, pictures: &Shelf<Pic<S>>) -> Rect {
    let frame = surface.frame();
    inflated::<S::Canvas>(item, look, pictures).map_or(frame, |r| snapped(r, frame))
}

fn off_frame<S: Surface>(surface: &S, item: &Item, pictures: &Shelf<Pic<S>>) -> bool {
    let Some(look) = item.look() else { return false };
    look.backdrop.is_none() && inflated::<S::Canvas>(item, look, pictures).is_some_and(|r| !r.overlaps(surface.frame()))
}

fn body<S: Surface>(surface: &mut S, item: &Item, pictures: &Shelf<Pic<S>>, inner: Option<&Layers<Pic<S>>>) -> Result<Placed<Pic<S>>, S::Error> {
    let frame = surface.frame();
    let look = item.look().expect("a drawable item");
    let region = region(surface, item, look, pictures);
    let drawn = surface.paint(region, None, &|c| match (item, inner) {
        (Item::Group(group), Some(inner)) => {
            build_items(c, &group.items, frame, pictures, inner);
        }
        _ => alone(c, item, pictures, frame),
    })?;
    let mask = mask(surface, look, pictures, region)?;
    let fx = Fx { runner: surface.runner() };
    let filtered = match &look.filters {
        Some(filters) => {
            let [ox, oy] = look.origin.unwrap_or([0.0, 0.0]);
            fx.apply(drawn, filters, look.space.unwrap_or(UNIT_SPACE), [ox - region.x0, oy - region.y0])
        }
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
