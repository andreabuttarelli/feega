use std::collections::HashMap;

use gpu_text::{Command, Op, Source};
use vello::kurbo::{flatten, Affine, BezPath, PathEl, Point};

use crate::display_list::{DisplayList, FillRule, GlyphsItem, Item, PathItem};

const TOLERANCE_PX: f64 = 0.05;

#[derive(Default)]
pub struct Fonts {
    sources: HashMap<String, Source>,
}

impl Fonts {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn put(&mut self, key: &str, source: Source) {
        self.sources.insert(key.into(), source);
    }

    pub fn sources(&self) -> &HashMap<String, Source> {
        &self.sources
    }
}

fn path_of(commands: &[Command], to: Affine) -> BezPath {
    let mut path = BezPath::new();
    let p = |at: &[f32], i: usize| to * Point::new(at[i] as f64, at[i + 1] as f64);
    for c in commands {
        match c.op {
            Op::Move => path.move_to(p(&c.at, 0)),
            Op::Line => path.line_to(p(&c.at, 0)),
            Op::Quad => path.quad_to(p(&c.at, 0), p(&c.at, 2)),
            Op::Cubic => path.curve_to(p(&c.at, 0), p(&c.at, 2), p(&c.at, 4)),
            Op::Close => path.close_path(),
        }
    }
    path
}

fn polylines(path: &BezPath, tolerance: f64) -> Vec<Vec<f64>> {
    let mut contours: Vec<Vec<f64>> = vec![];
    flatten(path, tolerance, |el| match el {
        PathEl::MoveTo(p) => contours.push(vec![p.x, p.y]),
        PathEl::LineTo(p) => {
            if let Some(c) = contours.last_mut() {
                c.extend([p.x, p.y]);
            }
        }
        _ => {}
    });
    contours.retain(|c| c.len() >= 6);
    contours
}

fn scale_of(m: [f64; 6]) -> f64 {
    m[0].hypot(m[1]).max(m[2].hypot(m[3])).max(f64::EPSILON)
}

fn outlined(run: &GlyphsItem, source: &Source) -> Item {
    let face = source.at(&run.coords);
    let em = run.size / face.units_per_em() as f64;
    let tolerance = TOLERANCE_PX / scale_of(run.look.matrix);
    let contours = run
        .glyphs
        .iter()
        .flat_map(|[glyph, x, y]| {
            let to = Affine::translate((*x, *y)) * Affine::scale_non_uniform(em, -em);
            polylines(&path_of(&face.outline(*glyph as u32), to), tolerance)
        })
        .collect();
    Item::Path(PathItem { clip: run.clip.clone(), contours, rule: FillRule::NonZero, paint: run.paint.clone(), within: None, look: run.look.clone() })
}

pub fn outline(list: &DisplayList, fonts: &Fonts) -> (DisplayList, Vec<String>) {
    let mut missing = vec![];
    let items = list
        .items
        .iter()
        .map(|item| match item {
            Item::Glyphs(run) => match fonts.sources.get(&run.font) {
                Some(source) => outlined(run, source),
                None => {
                    missing.push(run.font.clone());
                    Item::Other { clip: run.clip.clone(), kind: "glyphs".into() }
                }
            },
            other => other.clone(),
        })
        .collect();
    (DisplayList { items, ..list.clone_empty() }, missing)
}
