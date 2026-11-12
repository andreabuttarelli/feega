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
    pub len: usize,
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
    pub tail: usize,
}

const CUT_MIX: u64 = 0x9E37_79B9_7F4A_7C15;

fn cuts_after(r: Rect) -> bool {
    let mixed = [r.x0, r.y0, r.x1, r.y1].iter().fold(0u64, |h, v| (h.rotate_left(23) ^ v.to_bits()).wrapping_mul(CUT_MIX));
    (mixed >> 32) as usize % RUN_ITEMS == 0
}

struct Measure<'a, B: Fn(&Item) -> Option<Rect>> {
    items: &'a [Item],
    frame: Rect,
    bounds: B,
    known: Vec<Option<Rect>>,
}

impl<B: Fn(&Item) -> Option<Rect>> Measure<'_, B> {
    fn at(&mut self, i: usize) -> Rect {
        if let Some(r) = self.known[i] {
            return r;
        }
        let r = (self.bounds)(&self.items[i]).unwrap_or(self.frame);
        self.known[i] = Some(r);
        r
    }

    fn run_end(&mut self, start: usize) -> usize {
        let level = tier(extent_of(self.at(start)));
        let mut end = start + 1;
        while end < self.items.len() && end - start < RUN_ITEMS && !cuts_after(self.at(end - 1)) && tier(extent_of(self.at(end))) == level {
            end += 1;
        }
        end
    }
}

struct Resume<'a> {
    runs: &'a [Arc<Run>],
    starts: Vec<usize>,
    from: usize,
    shift: isize,
}

impl<'a> Resume<'a> {
    fn of(kept: &Kept<'a>, len: usize) -> Resume<'a> {
        let runs = &kept.before.runs;
        let mut starts = Vec::with_capacity(runs.len());
        let mut at = 0;
        for r in runs {
            starts.push(at);
            at += r.len;
        }
        let tail = kept.tail.min(len).min(at);
        Resume { runs, starts, from: len - tail, shift: at as isize - len as isize }
    }

    fn rest(&self, start: usize) -> Option<&'a [Arc<Run>]> {
        if start < self.from {
            return None;
        }
        let old = (start as isize + self.shift) as usize;
        self.starts.binary_search(&old).ok().map(|i| &self.runs[i..])
    }
}

impl Encoded {
    pub fn of(items: &[Item], frame: Rect, bounds: impl Fn(&Item) -> Option<Rect>, paint: impl Fn(&[Item]) -> Scene) -> Encoded {
        Encoded::reusing(None, items, frame, bounds, paint)
    }

    pub fn reusing(kept: Option<Kept>, items: &[Item], frame: Rect, bounds: impl Fn(&Item) -> Option<Rect>, paint: impl Fn(&[Item]) -> Scene) -> Encoded {
        let mut runs: Vec<Arc<Run>> = kept.as_ref().map(|k| k.before.prefix(k.stable.min(items.len()))).unwrap_or_default();
        let resume = kept.as_ref().map(|k| Resume::of(k, items.len()));
        let mut measure = Measure { items, frame, bounds, known: vec![None; items.len()] };
        let mut start = runs.iter().map(|r| r.len).sum();
        while start < items.len() {
            if let Some(rest) = resume.as_ref().and_then(|r| r.rest(start)) {
                runs.extend(rest.iter().cloned());
                break;
            }
            let end = measure.run_end(start);
            let members: Vec<Rect> = (start..end).map(|i| measure.at(i)).collect();
            let whole = members.iter().skip(1).fold(members[0], |acc, r| acc.union(*r));
            let extent = members.iter().map(|r| extent_of(*r)).fold(0.0, f64::max);
            let run = &items[start..end];
            runs.push(Arc::new(Run { len: end - start, bounds: whole, extent, ink: ink_of(run, &members, whole), scene: paint(run) }));
            start = end;
        }
        Encoded { runs }
    }

    fn prefix(&self, below: usize) -> Vec<Arc<Run>> {
        let mut at = 0;
        self.runs.iter().take_while(|r| {
            at += r.len;
            at < below
        }).cloned().collect()
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
