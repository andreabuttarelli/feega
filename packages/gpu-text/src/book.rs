use std::collections::{BTreeMap, HashMap};

use crate::face::{Face, Source};

pub struct FaceRule {
    pub family: String,
    pub italic: bool,
    pub weight: (f32, f32),
    pub source: String,
    pub ranges: Vec<(u32, u32)>,
}

pub struct Request {
    pub family: String,
    pub weight: f32,
    pub italic: bool,
    pub size: f32,
    pub axes: Vec<(String, f32)>,
}

pub struct Resolved {
    pub face: Face,
    pub skew: f32,
    pub rule: usize,
}

const SYNTHETIC_OBLIQUE: f32 = 0.25;
const MIDDLE: (f32, f32) = (400.0, 500.0);

pub struct FaceBook {
    rules: Vec<FaceRule>,
    sources: HashMap<String, Source>,
}

fn nearest(groups: &[(f32, f32)], desired: f32) -> Option<(f32, f32)> {
    if let Some(inside) = groups.iter().find(|(lo, hi)| *lo <= desired && desired <= *hi) {
        return Some(*inside);
    }
    let mut below: Vec<(f32, f32)> = groups.iter().copied().filter(|(_, hi)| *hi < desired).collect();
    below.sort_by(|a, b| b.1.total_cmp(&a.1));
    let mut above: Vec<(f32, f32)> = groups.iter().copied().filter(|(lo, _)| *lo > desired).collect();
    above.sort_by(|a, b| a.0.total_cmp(&b.0));
    let order: Vec<(f32, f32)> = if (MIDDLE.0..=MIDDLE.1).contains(&desired) {
        above.iter().filter(|(lo, _)| *lo <= MIDDLE.1).chain(&below).chain(above.iter().filter(|(lo, _)| *lo > MIDDLE.1)).copied().collect()
    } else if desired < MIDDLE.0 {
        below.into_iter().chain(above).collect()
    } else {
        above.into_iter().chain(below).collect()
    };
    order.first().copied()
}

impl FaceBook {
    pub fn new(rules: Vec<FaceRule>, sources: HashMap<String, Source>) -> FaceBook {
        FaceBook { rules, sources }
    }

    pub fn resolve(&self, request: &Request, code_point: u32) -> Option<Resolved> {
        let own: Vec<(usize, &FaceRule)> = self.rules.iter().enumerate().filter(|(_, r)| r.family == request.family && self.sources.contains_key(&r.source)).collect();
        let styled: Vec<(usize, &FaceRule)> = own.iter().copied().filter(|(_, r)| r.italic == request.italic).collect();
        let pool = if styled.is_empty() { &own } else { &styled };
        let skew = if request.italic && styled.is_empty() { SYNTHETIC_OBLIQUE } else { 0.0 };
        let mut groups: Vec<(f32, f32)> = vec![];
        for (_, r) in pool {
            if !groups.contains(&r.weight) {
                groups.push(r.weight);
            }
        }
        let group = nearest(&groups, request.weight)?;
        let (rule, found) = pool.iter().copied().find(|(_, r)| r.weight == group && r.ranges.iter().any(|(lo, hi)| *lo <= code_point && code_point <= *hi) && self.sources[&r.source].covers(code_point))?;
        let source = &self.sources[&found.source];
        let coords = coords_for(source, request.weight.clamp(group.0, group.1), request);
        Some(Resolved { face: source.at(&coords), skew, rule })
    }
}

fn coords_for(source: &Source, weight: f32, request: &Request) -> Vec<(String, f32)> {
    let axes = source.axes();
    let mut coords: BTreeMap<String, f32> = BTreeMap::new();
    if axes.contains_key("wght") {
        coords.insert("wght".into(), weight);
    }
    if axes.contains_key("opsz") {
        coords.insert("opsz".into(), request.size);
    }
    for (tag, v) in request.axes.iter().filter(|(tag, _)| axes.contains_key(tag)) {
        coords.insert(tag.clone(), *v);
    }
    coords.into_iter().collect()
}
