use vello::kurbo::{Point, Rect};

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

    fn recall_body(&mut self, _key: &str, _origin: Point, _scale: f64) -> Option<Placed<Pic<Self>>> {
        None
    }

    fn stepped(&self) -> bool {
        false
    }

    fn remember_body(&mut self, _key: &str, _placed: &Placed<Pic<Self>>) {}
}

const BODY_MAX_PX: f64 = 2048.0;

fn pictures_ready<P>(item: &Item, pictures: &Shelf<P>) -> bool {
    match item {
        Item::Image(image) => pictures.contains_key(&image.src),
        Item::Group(group) => group.items.iter().all(|i| pictures_ready(i, pictures)),
        _ => true,
    }
}

struct Step {
    key: String,
    region: Rect,
    factor: f64,
}

fn step_of<S: Surface>(item: &Item, pictures: &Shelf<Pic<S>>) -> Option<Step> {
    let look = item.look()?;
    let content = look.key?;
    if look.backdrop.is_some() || !pictures_ready(item, pictures) {
        return None;
    }
    let [a, b, c, d, _, _] = look.matrix;
    let scale = (a * d - b * c).abs().sqrt();
    if scale <= 0.0 {
        return None;
    }
    let factor = crate::groups::rung(scale) / scale;
    let spread = inflated::<S::Canvas>(item, look, pictures)?;
    if (factor - 1.0).abs() < STEP_SLACK || spread.width() * factor > BODY_MAX_PX || spread.height() * factor > BODY_MAX_PX {
        return None;
    }
    let region = Rect::new(spread.x0.floor(), spread.y0.floor(), spread.x1.ceil().max(spread.x0.floor() + 1.0), spread.y1.ceil().max(spread.y0.floor() + 1.0));
    let key = format!("{content:x} step {:.6} {:.4} {:.4} {:.4} {:.4}", scale * factor, a / scale, b / scale, c / scale, d / scale);
    Some(Step { key, region, factor })
}

fn stepped_body<S: Surface>(surface: &mut S, item: &Item, step: &Step, pictures: &Shelf<Pic<S>>, blending: Blending, fragments: &Fragments) -> Result<Option<Placed<Pic<S>>>, S::Error> {
    let at_step = crate::groups::scaled_about(item, step.factor, (step.region.x0, step.region.y0));
    let inner = match &at_step {
        Item::Group(group) => Some(prepare_items(surface, &group.items, None, pictures, blending, fragments)?),
        _ => None,
    };
    if inner.as_ref().is_some_and(|l| !l.plain()) {
        return Ok(None);
    }
    let r = step.region;
    let region = Rect::new(r.x0, r.y0, r.x0 + (r.width() * step.factor).ceil(), r.y0 + (r.height() * step.factor).ceil());
    let made = body(surface, &at_step, pictures, inner.as_ref(), Some(region))?;
    surface.remember_body(&step.key, &made);
    Ok(Some(Placed { scale: 1.0 / step.factor, ..made }))
}

const STEP_SLACK: f64 = 1e-6;

fn body_key<S: Surface>(item: &Item, pictures: &Shelf<Pic<S>>) -> Option<(String, Rect)> {
    let look = item.look()?;
    let content = look.key?;
    if look.backdrop.is_some() || !pictures_ready(item, pictures) {
        return None;
    }
    let spread = inflated::<S::Canvas>(item, look, pictures)?;
    if spread.width() > BODY_MAX_PX || spread.height() > BODY_MAX_PX {
        return None;
    }
    let region = Rect::new(spread.x0.floor(), spread.y0.floor(), spread.x1.ceil().max(spread.x0.floor() + 1.0), spread.y1.ceil().max(spread.y0.floor() + 1.0));
    let [a, b, c, d, _, _] = look.matrix;
    let key = format!("{content:x} {a:.6} {b:.6} {c:.6} {d:.6} {:.3} {:.3} {}x{}", spread.x0 - region.x0, spread.y0 - region.y0, region.width(), region.height());
    Some((key, region))
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
        let step = if layer_worthy(item) && surface.stepped() { step_of::<S>(item, pictures) } else { None };
        let stepped = match &step {
            Some(step) => match surface.recall_body(&step.key, step.region.origin(), 1.0 / step.factor) {
                Some(layer) => Some(layer),
                None => stepped_body(surface, item, step, pictures, blending, fragments)?,
            },
            None => None,
        };
        let keyed = if layer_worthy(item) && stepped.is_none() { body_key::<S>(item, pictures) } else { None };
        let recalled = match &keyed {
            _ if stepped.is_some() => stepped,
            Some((key, region)) => surface.recall_body(key, region.origin(), 1.0),
            None if layer_worthy(item) => surface.recall(item),
            None => None,
        };
        if let (Item::Group(group), None) = (item, &recalled) {
            let inner = prepare_items(surface, &group.items, None, pictures, blending, fragments)?;
            layers.groups.insert(i, inner);
        }
        if layer_worthy(item) {
            let whole = keyed.filter(|_| layers.groups.get(&i).is_none_or(Layers::plain));
            let layer = match recalled {
                Some(layer) => layer,
                None => {
                    let made = body(surface, item, pictures, layers.groups.get(&i), whole.as_ref().map(|(_, region)| *region))?;
                    match &whole {
                        Some((key, _)) => surface.remember_body(key, &made),
                        None => surface.remember(item, &made),
                    }
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
    let Some(spread) = inflated::<S::Canvas>(item, look, pictures) else { return frame };
    let own = bounds::<S::Canvas>(item, pictures).unwrap_or(spread);
    let cast = frame.inflate((spread.width() - own.width()) / 2.0, (spread.height() - own.height()) / 2.0);
    snapped(spread, cast)
}

fn off_frame<S: Surface>(surface: &S, item: &Item, pictures: &Shelf<Pic<S>>) -> bool {
    let Some(look) = item.look() else { return false };
    look.backdrop.is_none() && inflated::<S::Canvas>(item, look, pictures).is_some_and(|r| !r.overlaps(surface.frame()))
}

fn body<S: Surface>(surface: &mut S, item: &Item, pictures: &Shelf<Pic<S>>, inner: Option<&Layers<Pic<S>>>, whole: Option<Rect>) -> Result<Placed<Pic<S>>, S::Error> {
    let look = item.look().expect("a drawable item");
    let region = whole.unwrap_or_else(|| region(surface, item, look, pictures));
    let frame = whole.unwrap_or_else(|| surface.frame());
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
