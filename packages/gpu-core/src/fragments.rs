use std::collections::HashMap;
use std::sync::Arc;

use vello::kurbo::{Affine, Point, Rect, Shape};
use vello::peniko::Fill;
use vello::Scene;

use crate::canvas::Canvas;
use crate::display_list::{Item, Paint, Rgba};
use crate::lod::{detail, tier, Detail, BAR_MIN_COVERAGE, INK_SHARE, RUN_ITEMS, VIEW_SLACK_PX};

pub struct Ink {
    pub color: Rgba,
    pub coverage: f64,
}

pub struct Run {
    pub end: usize,
    pub bounds: Rect,
    pub extent: f64,
    pub ink: Option<Ink>,
    pub scene: Scene,
}

pub struct Encoded {
    pub runs: Vec<Arc<Run>>,
}

#[derive(Clone, Default)]
pub struct Fragments(Arc<HashMap<String, Arc<Encoded>>>);

impl Fragments {
    pub fn new(encoded: HashMap<String, Arc<Encoded>>) -> Self {
        Fragments(Arc::new(encoded))
    }

    pub fn get(&self, group: &str) -> Option<&Encoded> {
        self.0.get(group).map(|s| s.as_ref())
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl std::fmt::Debug for Fragments {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Fragments({})", self.0.len())
    }
}

fn extent_of(r: Rect) -> f64 {
    r.width().max(r.height())
}

fn solid(item: &Item) -> Option<Rgba> {
    match item {
        Item::Path(p) if p.look.opacity == 1.0 && p.look.blend == "normal" => match p.paint {
            Paint::Solid { color } => Some(color),
            _ => None,
        },
        _ => None,
    }
}

fn ink_of(items: &[Item], bounds: &[Rect], whole: Rect) -> Option<Ink> {
    let color = solid(items.first()?)?;
    let coverage = bounds.iter().map(|b| b.area()).sum::<f64>() / whole.area();
    let uniform = items.iter().all(|i| solid(i) == Some(color));
    (uniform && coverage >= BAR_MIN_COVERAGE).then_some(Ink { color, coverage: coverage.min(1.0) })
}

pub struct Kept<'a> {
    pub before: &'a Encoded,
    pub stable: usize,
}

impl Encoded {
    pub fn of(items: &[Item], frame: Rect, bounds: impl Fn(&Item) -> Option<Rect>, paint: impl Fn(&[Item]) -> Scene) -> Encoded {
        Encoded::reusing(None, items, frame, bounds, paint)
    }

    pub fn reusing(kept: Option<Kept>, items: &[Item], frame: Rect, bounds: impl Fn(&Item) -> Option<Rect>, paint: impl Fn(&[Item]) -> Scene) -> Encoded {
        let mut runs: Vec<Arc<Run>> = kept.map(|k| k.before.runs.iter().take_while(|r| r.end < k.stable.min(items.len())).cloned().collect()).unwrap_or_default();
        let first = runs.last().map_or(0, |r| r.end);
        let measured: Vec<Rect> = items[first..].iter().map(|i| bounds(i).unwrap_or(frame)).collect();
        let tiers: Vec<i32> = measured.iter().map(|b| tier(extent_of(*b))).collect();
        let mut start = 0;
        while start < measured.len() {
            let mut end = start + 1;
            while end < measured.len() && end - start < RUN_ITEMS && tiers[end] == tiers[start] {
                end += 1;
            }
            let members = &measured[start..end];
            let whole = members.iter().skip(1).fold(members[0], |acc, r| acc.union(*r));
            let extent = members.iter().map(|r| extent_of(*r)).fold(0.0, f64::max);
            let run = &items[first + start..first + end];
            runs.push(Arc::new(Run { end: first + end, bounds: whole, extent, ink: ink_of(run, members, whole), scene: paint(run) }));
            start = end;
        }
        Encoded { runs }
    }
}

fn screen_hull(m: Affine, r: Rect) -> Rect {
    let corners = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)].map(|(x, y)| m * Point::new(x, y));
    corners.iter().skip(1).fold(Rect::from_points(corners[0], corners[0]), |acc, p| acc.union_pt(*p))
}

fn bar<C: Canvas>(canvas: &mut C, run: &Run, ink: &Ink, matrix: Affine) {
    let [r, g, b, a] = ink.color;
    let color = [r, g, b, a * (ink.coverage * INK_SHARE) as f32];
    canvas.fill(Fill::NonZero, matrix, &Paint::Solid { color }, &run.bounds.to_path(0.1));
}

pub fn compose<C: Canvas>(canvas: &mut C, encoded: &Encoded, matrix: Affine, frame: Rect) -> bool {
    let scale = matrix.determinant().abs().sqrt();
    let view = frame.inflate(VIEW_SLACK_PX, VIEW_SLACK_PX);
    let mut drawn = true;
    for run in &encoded.runs {
        if !screen_hull(matrix, run.bounds).overlaps(view) {
            continue;
        }
        match (detail(run.extent * scale, run.ink.is_some()), &run.ink) {
            (Detail::Skip, _) => {}
            (Detail::Bar, Some(ink)) => bar(canvas, run, ink, matrix),
            _ => drawn &= canvas.fragment(&run.scene, matrix),
        }
    }
    drawn
}
