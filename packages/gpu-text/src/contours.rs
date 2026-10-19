use crate::face::{Command, Op};

pub type Contour = Vec<f64>;

pub type Rect = [f64; 4];

const TOLERANCE_PX: f64 = 0.05;
const MAX_STEPS: f64 = 128.0;
const CUBIC_DEVIATION: f64 = 0.75;
const MIN_POINTS: usize = 6;
const MIN_COSINE: f64 = 0.25;

fn steps(deviation: f64) -> usize {
    (deviation / (4.0 * TOLERANCE_PX)).sqrt().ceil().clamp(1.0, MAX_STEPS) as usize
}

fn off(a: (f64, f64), b: (f64, f64), p: (f64, f64)) -> f64 {
    let length = (b.0 - a.0).hypot(b.1 - a.1);
    let length = if length == 0.0 { 1.0 } else { length };
    ((b.0 - a.0) * (a.1 - p.1) - (a.0 - p.0) * (b.1 - a.1)).abs() / length
}

struct Flattener {
    contours: Vec<Contour>,
    contour: Contour,
    scale: f64,
    skew: f64,
}

impl Flattener {
    fn put(&mut self, ux: f64, uy: f64) {
        let (px, py) = (ux * self.scale, uy * self.scale);
        self.contour.push(px + py * self.skew);
        self.contour.push(-py);
    }

    fn close(&mut self) {
        let contour = std::mem::take(&mut self.contour);
        if contour.len() >= MIN_POINTS {
            self.contours.push(contour);
        }
    }
}

pub fn contours_of(commands: &[Command], scale: f64, skew: f64) -> Vec<Contour> {
    let mut f = Flattener { contours: vec![], contour: vec![], scale, skew };
    let mut at = (0.0, 0.0);
    for command in commands {
        let a: Vec<f64> = command.at.iter().map(|&v| v as f64).collect();
        match command.op {
            Op::Move => {
                f.close();
                at = (a[0], a[1]);
                f.put(at.0, at.1);
            }
            Op::Line => {
                at = (a[0], a[1]);
                f.put(at.0, at.1);
            }
            Op::Quad => {
                let (c, e) = ((a[0], a[1]), (a[2], a[3]));
                let n = steps(off(at, e, c) * scale);
                for i in 1..=n {
                    let t = i as f64 / n as f64;
                    let u = 1.0 - t;
                    f.put(u * u * at.0 + 2.0 * u * t * c.0 + t * t * e.0, u * u * at.1 + 2.0 * u * t * c.1 + t * t * e.1);
                }
                at = e;
            }
            Op::Cubic => {
                let (c1, c2, e) = ((a[0], a[1]), (a[2], a[3]), (a[4], a[5]));
                let n = steps(off(at, e, c1).max(off(at, e, c2)) * scale * CUBIC_DEVIATION);
                for i in 1..=n {
                    let t = i as f64 / n as f64;
                    let u = 1.0 - t;
                    let w = [u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t];
                    f.put(w[0] * at.0 + w[1] * c1.0 + w[2] * c2.0 + w[3] * e.0, w[0] * at.1 + w[1] * c1.1 + w[2] * c2.1 + w[3] * e.1);
                }
                at = e;
            }
            Op::Close => f.close(),
        }
    }
    f.close();
    f.contours
}

pub fn area(c: &[f64]) -> f64 {
    let n = c.len();
    (0..n).step_by(2).map(|i| {
        let j = (i + 2) % n;
        c[i] * c[j + 1] - c[j] * c[i + 1]
    }).sum::<f64>() / 2.0
}

fn unit_or_one(v: f64) -> f64 {
    if v == 0.0 {
        1.0
    } else {
        v
    }
}

fn pushed(c: &[f64], distance: f64) -> Contour {
    let n = c.len() / 2;
    let point = |i: usize| (c[i * 2], c[i * 2 + 1]);
    (0..n)
        .flat_map(|i| {
            let (px, py) = point((i + n - 1) % n);
            let (x, y) = point(i);
            let (nx, ny) = point((i + 1) % n);
            let a = unit_or_one((x - px).hypot(y - py));
            let b = unit_or_one((nx - x).hypot(ny - y));
            let (ax, ay) = ((y - py) / a, -(x - px) / a);
            let (bx, by) = ((ny - y) / b, -(nx - x) / b);
            let (sx, sy) = (ax + bx, ay + by);
            let length = unit_or_one(sx.hypot(sy));
            let (ux, uy) = (sx / length, sy / length);
            let stretch = distance / MIN_COSINE.max(ux * ax + uy * ay);
            [x + ux * stretch, y + uy * stretch]
        })
        .collect()
}

pub fn dilated(contours: &[Contour], by: f64) -> Vec<Contour> {
    let Some(first) = contours.first() else {
        return vec![];
    };
    let outer = contours.iter().fold(first, |best, c| if area(c).abs() > area(best).abs() { c } else { best });
    let side = if area(outer) > 0.0 { by } else { -by };
    contours.iter().map(|c| pushed(c, side)).collect()
}

#[derive(Clone, Copy)]
enum Edge {
    Left(f64),
    Right(f64),
    Top(f64),
    Bottom(f64),
}

impl Edge {
    fn inside(self, x: f64, y: f64) -> bool {
        match self {
            Edge::Left(at) => x - at >= 0.0,
            Edge::Right(at) => at - x >= 0.0,
            Edge::Top(at) => y - at >= 0.0,
            Edge::Bottom(at) => at - y >= 0.0,
        }
    }

    fn cross(self, (ax, ay): (f64, f64), (bx, by): (f64, f64)) -> [f64; 2] {
        match self {
            Edge::Left(at) | Edge::Right(at) => [at, ay + ((by - ay) * (at - ax)) / (bx - ax)],
            Edge::Top(at) | Edge::Bottom(at) => [ax + ((bx - ax) * (at - ay)) / (by - ay), at],
        }
    }
}

fn cut(points: &[f64], edge: Edge) -> Contour {
    let n = points.len() / 2;
    let mut out = vec![];
    for i in 0..n {
        let a = (points[i * 2], points[i * 2 + 1]);
        let j = (i + 1) % n;
        let b = (points[j * 2], points[j * 2 + 1]);
        let (ina, inb) = (edge.inside(a.0, a.1), edge.inside(b.0, b.1));
        if ina {
            out.extend([a.0, a.1]);
        }
        if ina != inb {
            out.extend(edge.cross(a, b));
        }
    }
    out
}

pub fn clipped(contours: &[Contour], [left, top, right, bottom]: Rect) -> Vec<Contour> {
    let edges = [Edge::Left(left), Edge::Right(right), Edge::Top(top), Edge::Bottom(bottom)];
    contours.iter().map(|c| edges.iter().fold(c.clone(), |c, &e| cut(&c, e))).filter(|c| c.len() >= MIN_POINTS).collect()
}
