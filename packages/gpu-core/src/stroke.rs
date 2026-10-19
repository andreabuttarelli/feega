type Pt = (f64, f64);

const MITER_LIMIT: f64 = 4.0;
const EPSILON: f64 = 1e-9;

fn points_of(flat: &[f64]) -> Vec<Pt> {
    let mut out: Vec<Pt> = vec![];
    for p in flat.chunks_exact(2).map(|p| (p[0], p[1])) {
        if out.last().is_none_or(|q| (p.0 - q.0).hypot(p.1 - q.1) > EPSILON) {
            out.push(p);
        }
    }
    out
}

fn normal(a: Pt, b: Pt) -> Pt {
    let len = (b.0 - a.0).hypot(b.1 - a.1);
    let len = if len == 0.0 { 1.0 } else { len };
    (-(b.1 - a.1) / len, (b.0 - a.0) / len)
}

fn band(a: Pt, b: Pt, hw: f64) -> Vec<f64> {
    let (nx, ny) = normal(a, b);
    vec![a.0 + nx * hw, a.1 + ny * hw, b.0 + nx * hw, b.1 + ny * hw, b.0 - nx * hw, b.1 - ny * hw, a.0 - nx * hw, a.1 - ny * hw]
}

fn mitre(prev: Pt, at: Pt, next: Pt, hw: f64) -> [Vec<f64>; 2] {
    let n0 = normal(prev, at);
    let n1 = normal(at, next);
    [1.0, -1.0].map(|side| {
        let a = (at.0 + side * n0.0 * hw, at.1 + side * n0.1 * hw);
        let b = (at.0 + side * n1.0 * hw, at.1 + side * n1.1 * hw);
        let (mx, my) = (n0.0 + n1.0, n0.1 + n1.1);
        let mlen = mx.hypot(my);
        let cos = mlen / 2.0;
        if mlen > EPSILON && 1.0 / cos <= MITER_LIMIT {
            vec![at.0, at.1, a.0, a.1, at.0 + (side * mx * hw) / (mlen * cos), at.1 + (side * my * hw) / (mlen * cos), b.0, b.1]
        } else {
            vec![at.0, at.1, a.0, a.1, b.0, b.1]
        }
    })
}

pub fn closed_band(flat: &[f64], width: f64) -> Vec<Vec<f64>> {
    let pts = points_of(flat);
    let hw = width / 2.0;
    if pts.len() < 2 || hw <= 0.0 {
        return vec![];
    }
    let looped = pts.len() > 2;
    let ring: Vec<Pt> = if looped { pts.iter().copied().chain([pts[0]]).collect() } else { pts };
    let edges = ring.len() - 1;
    let mut polys: Vec<Vec<f64>> = ring.windows(2).map(|w| band(w[0], w[1], hw)).collect();
    let corners: Vec<usize> = if looped { (0..edges).collect() } else { (1..edges).collect() };
    for i in corners {
        let prev = ring[(i + edges - 1) % edges];
        let next = ring.get(i + 1).copied().unwrap_or(ring[1]);
        polys.extend(mitre(prev, ring[i], next, hw));
    }
    polys
}
