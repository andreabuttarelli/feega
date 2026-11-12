use serde::Deserialize;

use crate::display_list::{Affine, FillRule, Item, Look, Paint, PathItem, Rgba};

const IDENTITY: Affine = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];
const ARC_STEPS: usize = 8;
const UNITS: [[f64; 2]; 8] = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.5, 0.0], [0.5, 1.0], [0.0, 0.5], [1.0, 0.5]];
const CORNERS: usize = 4;
const CLIP: &str = "marks";

type Pt = [f64; 2];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Part {
    Body = 0,
    Handle = 1,
    Edge = 2,
    Rotate = 3,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hit {
    pub index: usize,
    pub part: Part,
    pub n: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Line {
    Solid,
    Dashed,
    None,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Handles {
    None,
    Corners,
    All,
}

impl Handles {
    fn count(self) -> usize {
        match self {
            Handles::None => 0,
            Handles::Corners => CORNERS,
            Handles::All => UNITS.len(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mark {
    quad: [f64; 8],
    line: Line,
    color: Rgba,
    width: f64,
    offset: f64,
    #[serde(default)]
    radius: f64,
    handles: Handles,
    #[serde(default)]
    handle_radius: f64,
    #[serde(default)]
    on_ring: bool,
    #[serde(default)]
    boosted: bool,
    #[serde(default)]
    body: bool,
    #[serde(default)]
    edges: bool,
    #[serde(default)]
    rotate: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkLook {
    handle: f64,
    border: f64,
    fill: Rgba,
    far: [f64; 3],
    dpr: f64,
    edge: f64,
    reach: f64,
    dash: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Marks {
    marks: Vec<Mark>,
    look: Option<MarkLook>,
}

impl MarkLook {
    fn boost(&self, scale: f64) -> f64 {
        let [far, most, full] = self.far;
        let zoom = scale / self.dpr;
        let reached = ((far / zoom).ln() / (far / full).ln()).clamp(0.0, 1.0);
        1.0 + (most - 1.0) * reached
    }
}

struct Ring {
    offset: f64,
    width: f64,
}

impl Ring {
    fn of(m: &Mark, look: &MarkLook, f: &Frame) -> Ring {
        Ring { offset: m.offset, width: if m.boosted { m.width * look.boost(f.scale) } else { m.width } }
    }

    fn handle_out(&self, m: &Mark) -> f64 {
        if m.on_ring { self.offset + self.width / 2.0 } else { 0.0 }
    }
}

struct Frame {
    origin: Pt,
    u: Pt,
    v: Pt,
    w: f64,
    h: f64,
    scale: f64,
}

impl Frame {
    fn of(m: &Mark, camera: Affine) -> Frame {
        let p = |i: usize| apply(camera, [m.quad[2 * i], m.quad[2 * i + 1]]);
        let (p0, p1, p3) = (p(0), p(1), p(3));
        let (w, h) = (dist(p0, p1), dist(p0, p3));
        Frame { origin: p0, u: unit(sub(p1, p0), w), v: unit(sub(p3, p0), h), w, h, scale: (camera[0] * camera[3] - camera[1] * camera[2]).abs().sqrt() }
    }

    fn at(&self, x: f64, y: f64) -> Pt {
        [self.origin[0] + self.u[0] * x + self.v[0] * y, self.origin[1] + self.u[1] * x + self.v[1] * y]
    }

    fn local(&self, p: Pt) -> Pt {
        let d = sub(p, self.origin);
        [d[0] * self.u[0] + d[1] * self.u[1], d[0] * self.v[0] + d[1] * self.v[1]]
    }

    fn outline(&self, out: f64, radius: f64) -> Vec<f64> {
        let (x0, y0, x1, y1) = (-out, -out, self.w + out, self.h + out);
        let r = radius.min((x1 - x0) / 2.0).min((y1 - y0) / 2.0);
        if r <= 0.0 {
            return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].iter().flat_map(|q| self.at(q[0], q[1])).collect();
        }
        let centres = [([x0 + r, y0 + r], 2.0), ([x1 - r, y0 + r], 3.0), ([x1 - r, y1 - r], 0.0), ([x0 + r, y1 - r], 1.0)];
        centres
            .iter()
            .flat_map(|(c, quarter)| {
                (0..=ARC_STEPS).flat_map(move |s| {
                    let a = (quarter + s as f64 / ARC_STEPS as f64) * std::f64::consts::FRAC_PI_2;
                    self.at(c[0] + r * a.cos(), c[1] + r * a.sin())
                })
            })
            .collect()
    }

    fn unit_at(&self, [a, b]: Pt, out: f64) -> Pt {
        self.at(a * self.w + (2.0 * a - 1.0) * out, b * self.h + (2.0 * b - 1.0) * out)
    }
}

impl Marks {
    pub fn parse(json: &str) -> Result<Marks, serde_json::Error> {
        serde_json::from_str(json)
    }

    pub fn is_empty(&self) -> bool {
        self.marks.is_empty()
    }

    pub fn items(&self, camera: Affine) -> Vec<Item> {
        let Some(look) = &self.look else { return Vec::new() };
        self.marks.iter().flat_map(|m| drawn(m, look, &Frame::of(m, camera))).collect()
    }

    pub fn hit(&self, camera: Affine, x: f64, y: f64) -> Option<Hit> {
        let look = self.look.as_ref()?;
        self.marks.iter().enumerate().rev().find_map(|(index, m)| hit_in(m, look, &Frame::of(m, camera), [x, y]).map(|(part, n)| Hit { index, part, n }))
    }

    pub fn rect_of(&self, camera: Affine, index: usize) -> Option<[f64; 4]> {
        let m = self.marks.get(index)?;
        let points: Vec<Pt> = (0..CORNERS).map(|i| apply(camera, [m.quad[2 * i], m.quad[2 * i + 1]])).collect();
        let (x0, x1) = points.iter().fold((f64::MAX, f64::MIN), |(a, b), p| (a.min(p[0]), b.max(p[0])));
        let (y0, y1) = points.iter().fold((f64::MAX, f64::MIN), |(a, b), p| (a.min(p[1]), b.max(p[1])));
        Some([x0, y0, x1 - x0, y1 - y0])
    }
}

fn drawn(m: &Mark, look: &MarkLook, f: &Frame) -> Vec<Item> {
    let ring = Ring::of(m, look, f);
    let out = ring.handle_out(m);
    let handles = (0..m.handles.count()).flat_map(|i| {
        let c = f.unit_at(UNITS[i], out);
        let half = look.handle / 2.0;
        [square(c, half, m.handle_radius, m.color), square(c, half - look.border, (m.handle_radius - look.border).max(0.0), look.fill)]
    });
    ring_of(m, &ring, look, f).into_iter().chain(handles).collect()
}

fn ring_of(m: &Mark, ring: &Ring, look: &MarkLook, f: &Frame) -> Option<Item> {
    let rounded = |d: f64| if m.radius > 0.0 { (m.radius * f.scale + d).max(0.0) } else { 0.0 };
    let (outer, inner) = (ring.offset + ring.width, ring.offset);
    let contours = match m.line {
        Line::None => return None,
        Line::Solid => vec![f.outline(outer, rounded(outer)), reversed(&f.outline(inner, rounded(inner)))],
        Line::Dashed => dashes(f, (outer + inner) / 2.0, m.width, look.dash),
    };
    Some(path(contours, m.color))
}

fn dashes(f: &Frame, mid: f64, width: f64, dash: f64) -> Vec<Vec<f64>> {
    let (x0, y0, x1, y1) = (-mid, -mid, f.w + mid, f.h + mid);
    let sides = [([x0, y0], [x1, y0]), ([x1, y0], [x1, y1]), ([x1, y1], [x0, y1]), ([x0, y1], [x0, y0])];
    let half = width / 2.0;
    sides
        .iter()
        .flat_map(|(a, b)| {
            let len = dist(*a, *b);
            let dir = unit(sub(*b, *a), len);
            let normal = [-dir[1] * half, dir[0] * half];
            let count = (len / (2.0 * dash)).ceil() as usize;
            (0..count).map(move |k| {
                let s = k as f64 * 2.0 * dash;
                let e = (s + dash).min(len);
                let p = |t: f64, n: f64| [a[0] + dir[0] * t + normal[0] * n, a[1] + dir[1] * t + normal[1] * n];
                [p(s, -1.0), p(e, -1.0), p(e, 1.0), p(s, 1.0)].iter().flat_map(|q| f.at(q[0], q[1])).collect()
            })
        })
        .collect()
}

fn hit_in(m: &Mark, look: &MarkLook, f: &Frame, p: Pt) -> Option<(Part, usize)> {
    let [lx, ly] = f.local(p);
    let half = look.handle / 2.0;
    let out = Ring::of(m, look, f).handle_out(m);
    let handle = (0..m.handles.count()).find(|&i| {
        let [cx, cy] = f.local(f.unit_at(UNITS[i], out));
        (lx - cx).abs() <= half && (ly - cy).abs() <= half
    });
    if let Some(n) = handle {
        return Some((Part::Handle, n));
    }
    let band = look.edge / 2.0;
    let inside_x = (0.0..=f.w).contains(&lx);
    let inside_y = (0.0..=f.h).contains(&ly);
    let edge = [(ly.abs() <= band && inside_x, 4), ((ly - f.h).abs() <= band && inside_x, 5), (lx.abs() <= band && inside_y, 6), ((lx - f.w).abs() <= band && inside_y, 7)];
    if let Some((_, n)) = edge.iter().find(|(on, _)| m.edges && *on) {
        return Some((Part::Edge, *n));
    }
    let rotate = (0..CORNERS).find(|&i| {
        let [a, b] = UNITS[i];
        let (dx, dy) = (lx - a * f.w, ly - b * f.h);
        let outward = dx * (2.0 * a - 1.0) >= 0.0 && dy * (2.0 * b - 1.0) >= 0.0;
        outward && dx.hypot(dy) <= look.reach
    });
    if let Some(n) = rotate.filter(|_| m.rotate) {
        return Some((Part::Rotate, n));
    }
    (m.body && inside_x && inside_y).then_some((Part::Body, 0))
}

fn square(c: Pt, half: f64, radius: f64, color: Rgba) -> Item {
    let f = Frame { origin: [c[0] - half, c[1] - half], u: [1.0, 0.0], v: [0.0, 1.0], w: 2.0 * half, h: 2.0 * half, scale: 1.0 };
    path(vec![f.outline(0.0, radius)], color)
}

fn path(contours: Vec<Vec<f64>>, color: Rgba) -> Item {
    Item::Path(PathItem {
        clip: CLIP.to_string(),
        contours,
        rule: FillRule::NonZero,
        paint: Paint::Solid { color },
        within: None,
        look: Look { opacity: 1.0, matrix: IDENTITY, blur: 0.0, blend: "normal".to_string(), scissor: None, masks: None, matte: None, filters: None, space: None, origin: None, backdrop: None },
    })
}

fn reversed(contour: &[f64]) -> Vec<f64> {
    contour.chunks(2).rev().flatten().copied().collect()
}

fn apply(m: Affine, [x, y]: Pt) -> Pt {
    [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

fn sub(a: Pt, b: Pt) -> Pt {
    [a[0] - b[0], a[1] - b[1]]
}

fn dist(a: Pt, b: Pt) -> f64 {
    (a[0] - b[0]).hypot(a[1] - b[1])
}

fn unit(d: Pt, len: f64) -> Pt {
    if len == 0.0 {
        return [0.0, 0.0];
    }
    [d[0] / len, d[1] / len]
}
