use std::collections::HashMap;

use vello::kurbo::{Affine, BezPath, Point, Rect, Shape};
use vello::peniko::{Fill, ImageData};
use vello::Scene;

use crate::canvas::{mix, Canvas};
use crate::display_list::{Cover, DisplayList, FillRule, GroupItem, ImageItem, Item, LayerItem, Look, Paint, PathItem, Ramp, Rgba, Size, Stop};
use crate::pictures::{image_rect, Pictures};
use crate::Skipped;

pub type Shelf<P> = HashMap<String, P>;

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

fn draw<C: Canvas>(scene: &mut C, item: &PathItem, frame: Rect) {
    let transform = Affine::new(item.look.matrix);
    if let Some(within) = &item.within {
        let mut region = joined(&within.contours);
        if within.outside {
            region.extend(frame_in(transform, frame));
        }
        let rule = if within.outside { Fill::EvenOdd } else { Fill::NonZero };
        scene.push_clip(rule, transform, &region);
    }
    if item.rule == FillRule::Union {
        for contour in &item.contours {
            scene.fill(Fill::NonZero, transform, &item.paint, &polygon(contour));
        }
    } else {
        let rule = if item.rule == FillRule::EvenOdd { Fill::EvenOdd } else { Fill::NonZero };
        scene.fill(rule, transform, &item.paint, &joined(&item.contours));
    }
    if item.within.is_some() {
        scene.pop();
    }
}

fn image_region(item: &ImageItem, natural: Size) -> (Rect, Rect) {
    let fitted = image_rect(item.size, natural, &item.fit, item.focus, item.zoom);
    let [k, _, _, _, tx, ty] = item.inner;
    let placed = Rect::new(fitted.x * k + tx, fitted.y * k + ty, (fitted.x + fitted.width) * k + tx, (fitted.y + fitted.height) * k + ty);
    let region = if item.clipped { placed.intersect(Rect::new(0.0, 0.0, item.size.width, item.size.height)) } else { placed };
    (placed, region)
}

fn draw_image<C: Canvas>(scene: &mut C, item: &ImageItem, image: &C::Picture) {
    let natural = C::size(image);
    let (placed, region) = image_region(item, natural);
    if region.is_zero_area() {
        return;
    }
    let texels = Affine::translate((placed.x0, placed.y0)) * Affine::scale_non_uniform(placed.width() / natural.width, placed.height() / natural.height);
    scene.picture(Affine::new(item.look.matrix), image, texels, region);
}

fn draw_layer<C: Canvas>(scene: &mut C, item: &LayerItem, image: &C::Picture) {
    let natural = C::size(image);
    let texels = Affine::scale_non_uniform(item.size.width / natural.width, item.size.height / natural.height);
    scene.picture(Affine::new(item.look.matrix), image, texels, Rect::new(0.0, 0.0, item.size.width, item.size.height));
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

fn layered<C: Canvas>(scene: &mut C, blend: &str, opacity: f32, frame: Rect, paint: impl FnOnce(&mut C)) {
    let layer = opacity < 1.0 || blend != "normal";
    if layer {
        scene.push_layer(mix(blend), opacity, frame);
    }
    paint(scene);
    if layer {
        scene.pop();
    }
}

fn scissored<C: Canvas>(scene: &mut C, look: &Look, paint: impl FnOnce(&mut C)) {
    let Some([x0, y0, x1, y1]) = look.scissor else {
        paint(scene);
        return;
    };
    scene.push_clip(Fill::NonZero, Affine::IDENTITY, &Rect::new(x0, y0, x1, y1).to_path(0.1));
    paint(scene);
    scene.pop();
}

fn content<C: Canvas>(scene: &mut C, item: &Item, pictures: &Shelf<C::Picture>, frame: Rect) {
    match item {
        Item::Path(path) => draw(scene, path, frame),
        Item::Image(image) => {
            if let Some(data) = pictures.get(&image.clip) {
                draw_image(scene, image, data);
            }
        }
        Item::Layer(layer) => {
            if let Some(data) = pictures.get(&layer.source) {
                draw_layer(scene, layer, data);
            }
        }
        Item::Group(group) => plain(scene, &group.items, pictures, frame),
        Item::Use(_) | Item::Glyphs(_) | Item::Text(_) | Item::Lens(_) | Item::Other { .. } => {}
    }
}

const WHITE: Rgba = [1.0, 1.0, 1.0, 1.0];
const CLEAR: Rgba = [1.0, 1.0, 1.0, 0.0];

fn ramp(kind: Ramp) -> Paint {
    let stops = vec![Stop { at: 0.0, color: WHITE }, Stop { at: 1.0, color: CLEAR }];
    match kind {
        Ramp::Linear => Paint::Linear { from: [0.0, 0.5], to: [1.0, 0.5], stops },
        Ramp::Radial => Paint::Radial { center: [0.5, 0.5], radius: 0.5, stops },
    }
}

pub fn alone<C: Canvas>(scene: &mut C, item: &Item, pictures: &Shelf<C::Picture>, frame: Rect) {
    content(scene, item, pictures, frame);
}

pub fn cover<C: Canvas>(scene: &mut C, cover: &Cover, pictures: &Shelf<C::Picture>) {
    match cover {
        Cover::Path { contours, matrix } => scene.fill(Fill::NonZero, Affine::new(*matrix), &Paint::Solid { color: WHITE }, &joined(contours)),
        Cover::Ramp { ramp: kind, contours, matrix } => scene.fill(Fill::NonZero, Affine::new(*matrix), &ramp(*kind), &joined(contours)),
        Cover::Picture { src, matrix, .. } => {
            if let Some(image) = pictures.get(src) {
                let size = C::size(image);
                let texels = Affine::scale_non_uniform(1.0 / size.width, 1.0 / size.height);
                scene.picture(Affine::new(*matrix), image, texels, Rect::new(0.0, 0.0, 1.0, 1.0));
            }
        }
    }
}

pub fn plain<C: Canvas>(scene: &mut C, items: &[Item], pictures: &Shelf<C::Picture>, frame: Rect) {
    for item in items {
        let opacity = item.look().map_or(1.0, |l| l.opacity);
        layered(scene, "normal", opacity, frame, |s| content(s, item, pictures, frame));
    }
}

pub struct Placed<P = ImageData> {
    pub image: P,
    pub origin: Point,
}

pub struct Layers<P = ImageData> {
    pub bodies: HashMap<usize, Placed<P>>,
    pub behind: HashMap<usize, Placed<P>>,
    pub groups: HashMap<usize, Layers<P>>,
}

impl<P> Default for Layers<P> {
    fn default() -> Self {
        Self { bodies: HashMap::new(), behind: HashMap::new(), groups: HashMap::new() }
    }
}

impl<P> Layers<P> {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn into_images(self) -> Vec<P> {
        let nested = self.groups.into_values().flat_map(Layers::into_images);
        self.bodies.into_values().chain(self.behind.into_values()).map(|p| p.image).chain(nested).collect()
    }
}

fn placed<C: Canvas>(scene: &mut C, layer: &Placed<C::Picture>) {
    let size = C::size(&layer.image);
    scene.picture(Affine::translate(layer.origin.to_vec2()), &layer.image, Affine::IDENTITY, Rect::new(0.0, 0.0, size.width, size.height));
}

fn corners(m: Affine, r: Rect) -> impl Iterator<Item = Point> {
    [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)].into_iter().map(move |(x, y)| m * Point::new(x, y))
}

fn hull(points: impl Iterator<Item = Point>) -> Option<Rect> {
    points.fold(None, |acc: Option<Rect>, p| Some(acc.map_or(Rect::from_points(p, p), |r| r.union_pt(p))))
}

pub fn bounds<C: Canvas>(item: &Item, pictures: &Shelf<C::Picture>) -> Option<Rect> {
    match item {
        Item::Path(path) => {
            let m = Affine::new(path.look.matrix);
            hull(path.contours.iter().flat_map(|c| c.chunks_exact(2).map(move |xy| m * Point::new(xy[0], xy[1]))))
        }
        Item::Image(image) => {
            let (_, region) = image_region(image, C::size(pictures.get(&image.clip)?));
            hull(corners(Affine::new(image.look.matrix), region))
        }
        Item::Layer(layer) => hull(corners(Affine::new(layer.look.matrix), Rect::new(0.0, 0.0, layer.size.width, layer.size.height))),
        Item::Group(group) => group.items.iter().filter_map(|i| bounds::<C>(i, pictures)).reduce(|a, b| a.union(b)),
        Item::Use(_) | Item::Glyphs(_) | Item::Text(_) | Item::Lens(_) | Item::Other { .. } => None,
    }
}

fn whitened(item: &Item) -> Item {
    match item {
        Item::Path(path) => Item::Path(PathItem { paint: Paint::Solid { color: WHITE }, ..path.clone() }),
        Item::Group(group) => Item::Group(Box::new(GroupItem { items: group.items.iter().map(whitened).collect(), ..(**group).clone() })),
        other => other.clone(),
    }
}

pub fn silhouette<C: Canvas>(scene: &mut C, item: &Item, pictures: &Shelf<C::Picture>, frame: Rect) {
    alone(scene, &whitened(item), pictures, frame);
}

pub fn build(list: &DisplayList, pictures: &Pictures, layers: &Layers) -> (Scene, Vec<Skipped>) {
    let mut scene = Scene::new();
    let skipped = build_into(&mut scene, list, pictures, layers);
    (scene, skipped)
}

pub fn build_into<C: Canvas>(scene: &mut C, list: &DisplayList, pictures: &Shelf<C::Picture>, layers: &Layers<C::Picture>) -> Vec<Skipped> {
    build_items(scene, &list.items, Rect::new(0.0, 0.0, list.width as f64, list.height as f64), pictures, layers)
}

fn missing_picture<P>(item: &Item, pictures: &Shelf<P>) -> bool {
    match item {
        Item::Image(image) => !pictures.contains_key(&image.clip),
        Item::Layer(layer) => !pictures.contains_key(&layer.source),
        _ => false,
    }
}

pub fn build_items<C: Canvas>(scene: &mut C, items: &[Item], frame: Rect, pictures: &Shelf<C::Picture>, layers: &Layers<C::Picture>) -> Vec<Skipped> {
    let mut skipped = Vec::new();
    for (i, item) in items.iter().enumerate() {
        if let Item::Lens(_) = item {
            match layers.behind.get(&i) {
                Some(layer) => placed(scene, layer),
                None => skip(&mut skipped, item.clip(), "lens"),
            }
            continue;
        }
        let Some(look) = item.look() else {
            skip(&mut skipped, item.clip(), item.kind());
            continue;
        };
        if look.backdrop.is_some() {
            match layers.behind.get(&i) {
                Some(layer) => scissored(scene, look, |s| placed(s, layer)),
                None => skip(&mut skipped, item.clip(), "backdrop"),
            }
        }
        if needs_layer(look) {
            match layers.bodies.get(&i) {
                Some(layer) => scissored(scene, look, |s| layered(s, &look.blend, look.opacity, frame, |s| placed(s, layer))),
                None => skip(&mut skipped, item.clip(), "layer"),
            }
            continue;
        }
        if let Item::Group(group) = item {
            let empty = Layers::new();
            let inner = layers.groups.get(&i).unwrap_or(&empty);
            scissored(scene, look, |s| layered(s, &look.blend, look.opacity, frame, |s| skipped.extend(build_items(s, &group.items, frame, pictures, inner))));
            continue;
        }
        if missing_picture(item, pictures) {
            skip(&mut skipped, item.clip(), item.kind());
            continue;
        }
        scissored(scene, look, |s| layered(s, &look.blend, look.opacity, frame, |s| content(s, item, pictures, frame)));
    }
    skipped
}
