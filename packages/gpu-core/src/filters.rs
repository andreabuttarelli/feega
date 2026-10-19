use std::collections::HashMap;

use serde_json::{Map, Value};

use crate::colour::rgba_of;
use crate::display_list::{CssFunction, Filter, MaskMode, Rgba, SvgNode};
use crate::filter_passes::Op;
use crate::kernel::{gaussian, MAX_TAPS};
use crate::turbulence::{lattice_of, stitched_frequency, CHANNELS, LATTICE};

const MAX_TABLE: usize = 32;
const MAX_MORPH: f64 = 64.0;
const HALF: f64 = 0.5;
const PERLIN: f64 = 4096.0;
const DEG: f64 = std::f64::consts::PI / 180.0;
const SOURCE_GRAPHIC: &str = "SourceGraphic";
const SOURCE_ALPHA: &str = "SourceAlpha";
const IDENTITY_MATRIX: [f32; 20] = [1., 0., 0., 0., 0., 0., 1., 0., 0., 0., 0., 0., 1., 0., 0., 0., 0., 0., 1., 0.];
const LUMINANCE_TO_ALPHA: [f32; 20] = [0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.2125, 0.7154, 0.0721, 0., 0.];
const BLACK: Rgba = [0.0, 0.0, 0.0, 1.0];
const WHITE: Rgba = [1.0, 1.0, 1.0, 1.0];

const COMPOSITE_OPS: [(&str, f32); 6] = [("over", 0.), ("in", 1.), ("out", 2.), ("atop", 3.), ("xor", 4.), ("arithmetic", 5.)];
const BLENDS: [&str; 16] = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
const CHANNEL_INDEX: [(&str, f32); 4] = [("R", 0.), ("G", 1.), ("B", 2.), ("A", 3.)];

pub type Linear = [f64; 4];

fn rows(r: [f64; 3], g: [f64; 3], b: [f64; 3]) -> [f32; 20] {
    let m = [r[0], r[1], r[2], 0., 0., g[0], g[1], g[2], 0., 0., b[0], b[1], b[2], 0., 0., 0., 0., 0., 1., 0.];
    m.map(|v| v as f32)
}

pub fn css_matrix(name: &str, a: f64) -> Option<[f32; 20]> {
    let m = match name {
        "brightness" => rows([a, 0., 0.], [0., a, 0.], [0., 0., a]),
        "contrast" => {
            let o = (0.5 - 0.5 * a) as f32;
            let c = a as f32;
            [c, 0., 0., 0., o, 0., c, 0., 0., o, 0., 0., c, 0., o, 0., 0., 0., 1., 0.]
        }
        "grayscale" => {
            let k = 1.0 - a.min(1.0);
            rows([0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k], [0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k])
        }
        "saturate" => rows([0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a], [0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a], [0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a]),
        "hue-rotate" => {
            let (s, c) = (a * DEG).sin_cos();
            rows(
                [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
                [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
                [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
            )
        }
        _ => return None,
    };
    Some(m)
}

fn text(v: Option<&Value>) -> String {
    match v {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn leading_number(s: &str) -> Option<f64> {
    let s = s.trim();
    let end = s.char_indices().find(|&(i, c)| !(c.is_ascii_digit() || c == '.' || ((c == '-' || c == '+') && i == 0) || c == 'e')).map_or(s.len(), |(i, _)| i);
    s[..end].parse().ok()
}

fn num(v: Option<&Value>, fallback: f64) -> f64 {
    leading_number(&text(v)).filter(|n| n.is_finite()).unwrap_or(fallback)
}

fn pair(v: Option<&Value>) -> (f64, f64) {
    let raw = text(v);
    let raw = if raw.is_empty() { "0".to_string() } else { raw };
    let parts: Vec<f64> = raw.trim().split(|c: char| c.is_whitespace() || c == ',').filter(|p| !p.is_empty()).map(|p| leading_number(p).unwrap_or(0.0)).collect();
    let x = parts.first().copied().unwrap_or(0.0);
    (x, parts.get(1).copied().unwrap_or(x))
}

fn numbers(v: Option<&Value>) -> Vec<f32> {
    text(v).trim().split(|c: char| c.is_whitespace() || c == ',').filter(|p| !p.is_empty()).map(|p| p.parse().unwrap_or(f32::NAN)).collect()
}

fn lookup(table: &[(&str, f32)], key: &str, fallback: f32) -> f32 {
    table.iter().find(|(k, _)| *k == key).map_or(fallback, |(_, v)| *v)
}

pub trait Runner {
    type Tex: Clone;

    fn run(&self, op: Op, inputs: [&Self::Tex; 2], params: &[f32]) -> Self::Tex;
    fn size(tex: &Self::Tex) -> (u32, u32);
}

#[derive(Clone)]
struct Img<T> {
    tex: T,
    region: Option<[f32; 4]>,
}

pub struct Fold {
    pub mode: MaskMode,
    pub level: f32,
    pub invert: bool,
    pub luma: bool,
}

const MODE_CODE: [(MaskMode, f32); 4] = [(MaskMode::Add, 0.), (MaskMode::Subtract, 1.), (MaskMode::Intersect, 2.), (MaskMode::Difference, 3.)];

pub struct Fx<'a, R: Runner> {
    pub runner: &'a R,
}

impl<R: Runner> Fx<'_, R> {
    fn op(&self, op: Op, a: &R::Tex, b: &R::Tex, params: &[f32]) -> Img<R::Tex> {
        Img { tex: self.runner.run(op, [a, b], params), region: None }
    }

    fn size(t: &R::Tex) -> (f64, f64) {
        let (w, h) = R::size(t);
        (w as f64, h as f64)
    }

    fn plain(tex: R::Tex) -> Img<R::Tex> {
        Img { tex, region: None }
    }

    pub fn blurred(&self, tex: R::Tex, sigma: f64) -> R::Tex {
        self.blur(Self::plain(tex), sigma, sigma).tex
    }

    pub fn refracted(&self, content: &R::Tex, lens: &[f32]) -> R::Tex {
        self.op(Op::Lens, content, content, lens).tex
    }

    pub fn masked(&self, body: &R::Tex, mask: &R::Tex) -> R::Tex {
        self.op(Op::Composite, body, mask, &[1.0, 0.0, 0.0, 0.0, 0.0]).tex
    }

    pub fn folded(&self, acc: Option<&R::Tex>, cover: &R::Tex, step: Fold) -> R::Tex {
        let mode = MODE_CODE.iter().find(|(m, _)| *m == step.mode).map_or(0.0, |(_, c)| *c);
        let params = [mode, acc.is_none() as u8 as f32, step.invert as u8 as f32, step.luma as u8 as f32, step.level];
        self.op(Op::Fold, acc.unwrap_or(cover), cover, &params).tex
    }

    fn matrix(&self, src: &Img<R::Tex>, m: &[f32]) -> Img<R::Tex> {
        let mut full = IDENTITY_MATRIX;
        full.iter_mut().zip(m).for_each(|(slot, v)| *slot = *v);
        self.op(Op::Matrix, &src.tex, &src.tex, &full)
    }

    fn blur(&self, src: Img<R::Tex>, sx: f64, sy: f64) -> Img<R::Tex> {
        let along = |img: Img<R::Tex>, sigma: f64, dir: (u32, u32)| {
            if sigma <= 0.0 {
                return img;
            }
            let k = gaussian(sigma);
            let mut params = vec![(dir.0 * k.step) as f32, (dir.1 * k.step) as f32, k.weights.len() as f32];
            params.extend(&k.weights);
            params.resize(3 + MAX_TAPS, 0.0);
            self.op(Op::Blur, &img.tex, &img.tex, &params)
        };
        along(along(src, sx, (1, 0)), sy, (0, 1))
    }

    fn offset(&self, src: &Img<R::Tex>, d: (f64, f64), alpha: bool) -> Img<R::Tex> {
        self.op(Op::Offset, &src.tex, &src.tex, &[d.0 as f32, d.1 as f32, alpha as u8 as f32])
    }

    fn alpha_of(&self, src: &Img<R::Tex>) -> Img<R::Tex> {
        self.offset(src, (0.0, 0.0), true)
    }

    fn flood(&self, like: &Img<R::Tex>, c: Rgba) -> Img<R::Tex> {
        self.op(Op::Flood, &like.tex, &like.tex, &c)
    }

    fn composite(&self, a: &Img<R::Tex>, b: &Img<R::Tex>, op: &str, k: [f32; 4]) -> Img<R::Tex> {
        self.op(Op::Composite, &a.tex, &b.tex, &[lookup(&COMPOSITE_OPS, op, 0.0), k[0], k[1], k[2], k[3]])
    }

    fn shadow(&self, src: &Img<R::Tex>, d: (f64, f64), sigma: f64, c: Rgba) -> Img<R::Tex> {
        let soft = self.blur(self.alpha_of(src), sigma, sigma);
        let ink = self.composite(&self.flood(src, c), &self.offset(&soft, d, false), "in", [0.0; 4]);
        self.composite(src, &ink, "over", [0.0; 4])
    }

    fn morph(&self, src: Img<R::Tex>, r: (f64, f64), dilate: bool) -> Img<R::Tex> {
        let along = |img: Img<R::Tex>, r: f64, dir: (f64, f64)| {
            if r <= 0.0 {
                return img;
            }
            let step = (r / MAX_MORPH).ceil().max(1.0);
            self.op(Op::Morph, &img.tex, &img.tex, &[(dir.0 * step) as f32, (dir.1 * step) as f32, (r / step).round() as f32, dilate as u8 as f32])
        };
        along(along(src, r.0, (1.0, 0.0)), r.1, (0.0, 1.0))
    }

    fn table(&self, src: &Img<R::Tex>, funcs: &[SvgNode]) -> Img<R::Tex> {
        let mut params = vec![0.0f32; 16 + 4 * MAX_TABLE];
        for (ch, tag) in ["feFuncR", "feFuncG", "feFuncB", "feFuncA"].iter().enumerate() {
            let Some(f) = funcs.iter().find(|f| f.tag == *tag) else { continue };
            let kind = text(f.attrs.get("type"));
            let values: Vec<f32> = if kind == "table" { numbers(f.attrs.get("tableValues")).into_iter().take(MAX_TABLE).collect() } else { vec![] };
            params[ch] = match kind.as_str() {
                "table" => 1.0,
                "linear" => 2.0,
                _ => 0.0,
            };
            params[4 + ch] = values.len() as f32;
            params[8 + ch] = num(f.attrs.get("slope"), 1.0) as f32;
            params[12 + ch] = num(f.attrs.get("intercept"), 0.0) as f32;
            params[16 + ch * MAX_TABLE..16 + ch * MAX_TABLE + values.len()].copy_from_slice(&values);
        }
        self.op(Op::Table, &src.tex, &src.tex, &params)
    }

    fn colour_matrix(&self, src: &Img<R::Tex>, attrs: &Map<String, Value>) -> Img<R::Tex> {
        let kind = text(attrs.get("type"));
        let m = match if kind.is_empty() { "matrix" } else { kind.as_str() } {
            "matrix" => numbers(attrs.get("values")),
            "saturate" => css_matrix("saturate", num(attrs.get("values"), 1.0)).map(Vec::from).unwrap_or_default(),
            "hueRotate" => css_matrix("hue-rotate", num(attrs.get("values"), 0.0)).map(Vec::from).unwrap_or_default(),
            "luminanceToAlpha" => LUMINANCE_TO_ALPHA.to_vec(),
            _ => IDENTITY_MATRIX.to_vec(),
        };
        self.matrix(src, &m)
    }

    fn lighting(&self, like: &Img<R::Tex>, node: &SvgNode, s: f64) -> Img<R::Tex> {
        let light = node.children.iter().find(|c| c.tag == "fePointLight");
        let at = |k: &str| (num(light.and_then(|l| l.attrs.get(k)), 0.0) * s) as f32;
        let c = node.attrs.get("lighting-color").and_then(|v| rgba_of(&text(Some(v)))).unwrap_or(WHITE);
        self.op(Op::Light, &like.tex, &like.tex, &[at("x"), at("y"), at("z"), c[0], c[1], c[2], num(node.attrs.get("diffuseConstant"), 1.0) as f32])
    }

    fn blend(&self, a: &Img<R::Tex>, b: &Img<R::Tex>, mode: &str) -> Img<R::Tex> {
        let index = BLENDS.iter().position(|m| *m == mode).unwrap_or(0);
        self.op(Op::Blend, &a.tex, &b.tex, &[index as f32])
    }

    fn turbulence(&self, like: &Img<R::Tex>, n: &SvgNode) -> Img<R::Tex> {
        let (w, h) = Self::size(&like.tex);
        let region = [num(n.attrs.get("x"), 0.0), num(n.attrs.get("y"), 0.0), num(n.attrs.get("width"), w), num(n.attrs.get("height"), h)];
        let stitch = text(n.attrs.get("stitchTiles")) == "stitch";
        let (bx, by) = pair(n.attrs.get("baseFrequency"));
        let fx = if stitch { stitched_frequency(bx, region[2]) } else { bx };
        let fy = if stitch { stitched_frequency(by, region[3]) } else { by };
        let sw = (region[2] * fx + HALF).trunc();
        let sh = (region[3] * fy + HALF).trunc();
        let fractal = text(n.attrs.get("type")) == "fractalNoise";
        let header = [fx, fy, num(n.attrs.get("numOctaves"), 1.0), fractal as u8 as f64, stitch as u8 as f64, region[0], region[1], region[2], region[3], sw, sh, region[0] * fx + PERLIN + sw, region[1] * fy + PERLIN + sh, 0.0, 0.0, 0.0];
        let lattice = lattice_of(num(n.attrs.get("seed"), 0.0));
        let mut params: Vec<f32> = header.iter().map(|v| *v as f32).collect();
        for k in 0..CHANNELS {
            for i in 0..LATTICE {
                let g = (k * LATTICE + i) * 2;
                params.extend([lattice.gradients[g], lattice.gradients[g + 1], lattice.selector[i] as f32, 0.0]);
            }
        }
        let mut out = self.op(Op::Turbulence, &like.tex, &like.tex, &params);
        out.region = Some(region.map(|v| v as f32));
        out
    }

    fn tile(&self, src: &Img<R::Tex>) -> Img<R::Tex> {
        let (w, h) = Self::size(&src.tex);
        let region = src.region.unwrap_or([0.0, 0.0, w as f32, h as f32]);
        self.op(Op::Tile, &src.tex, &src.tex, &region)
    }

    fn displace(&self, src: &Img<R::Tex>, map: &Img<R::Tex>, n: &SvgNode, s: f64) -> Img<R::Tex> {
        let channel = |k: &str| {
            let v = text(n.attrs.get(k));
            lookup(&CHANNEL_INDEX, if v.is_empty() { "A" } else { &v }, 3.0)
        };
        self.op(Op::Displace, &src.tex, &map.tex, &[(num(n.attrs.get("scale"), 0.0) * s) as f32, channel("xChannelSelector"), channel("yChannelSelector")])
    }

    fn svg_graph(&self, source: Img<R::Tex>, filter: &SvgNode, space: Linear) -> Img<R::Tex> {
        let mut results: HashMap<String, Img<R::Tex>> = HashMap::new();
        let mut last = source.clone();
        let s = scale(space);
        let colour_of = |node: &SvgNode| {
            let c = node.attrs.get("flood-color").and_then(|v| rgba_of(&text(Some(v)))).unwrap_or(BLACK);
            [c[0], c[1], c[2], c[3] * num(node.attrs.get("flood-opacity"), 1.0) as f32]
        };
        for node in &filter.children {
            let input = |name: Option<&Value>| match name.map(|v| text(Some(v))) {
                Some(n) if n == SOURCE_GRAPHIC => source.clone(),
                Some(n) if n == SOURCE_ALPHA => self.alpha_of(&source),
                Some(n) => results.get(&n).cloned().unwrap_or_else(|| last.clone()),
                None => last.clone(),
            };
            let a = |k: &str| node.attrs.get(k);
            let out = match node.tag.as_str() {
                "feColorMatrix" => self.colour_matrix(&input(a("in")), &node.attrs),
                "feComponentTransfer" => self.table(&input(a("in")), &node.children),
                "feGaussianBlur" => {
                    let (sx, sy) = pair(a("stdDeviation"));
                    self.blur(input(a("in")), sx * s, sy * s)
                }
                "feOffset" => self.offset(&input(a("in")), vector(space, num(a("dx"), 0.0), num(a("dy"), 0.0)), false),
                "feFlood" => self.flood(&source, colour_of(node)),
                "feComposite" => {
                    let op = text(a("operator"));
                    let k = ["k1", "k2", "k3", "k4"].map(|k| num(a(k), 0.0) as f32);
                    self.composite(&input(a("in")), &input(a("in2")), if op.is_empty() { "over" } else { &op }, k)
                }
                "feMerge" => {
                    let layers: Vec<Img<R::Tex>> = node.children.iter().map(|c| input(c.attrs.get("in"))).collect();
                    let mut merged = layers.first().cloned().unwrap_or_else(|| last.clone());
                    for over in layers.iter().skip(1) {
                        merged = self.composite(over, &merged, "over", [0.0; 4]);
                    }
                    merged
                }
                "feMorphology" => {
                    let (rx, ry) = pair(a("radius"));
                    self.morph(input(a("in")), (rx * s, ry * s), text(a("operator")) == "dilate")
                }
                "feDropShadow" => self.shadow(&input(a("in")), vector(space, num(a("dx"), 0.0), num(a("dy"), 0.0)), num(a("stdDeviation"), 0.0) * s, colour_of(node)),
                "feBlend" => {
                    let mode = text(a("mode"));
                    self.blend(&input(a("in")), &input(a("in2")), if mode.is_empty() { "normal" } else { &mode })
                }
                "feDiffuseLighting" => self.lighting(&source, node, s),
                "feTurbulence" => self.turbulence(&source, node),
                "feTile" => self.tile(&input(a("in"))),
                "feDisplacementMap" => self.displace(&input(a("in")), &input(a("in2")), node, s),
                _ => continue,
            };
            if let Some(name) = a("result") {
                results.insert(text(Some(name)), out.clone());
            }
            last = out;
        }
        last
    }

    fn css_graph(&self, source: Img<R::Tex>, fns: &[CssFunction], space: Linear) -> Img<R::Tex> {
        let s = scale(space);
        let px = |v: Option<&String>| v.and_then(|v| leading_number(v)).unwrap_or(0.0);
        fns.iter().fold(source, |src, f| {
            let amount = f.args.first().and_then(|v| leading_number(v)).unwrap_or(1.0);
            if let Some(m) = css_matrix(&f.name, amount) {
                return self.matrix(&src, &m);
            }
            match f.name.as_str() {
                "blur" => {
                    let r = px(f.args.first()) * s;
                    self.blur(src, r, r)
                }
                "drop-shadow" => {
                    let colour = f.args.get(3..).map(|rest| rest.join(" ")).filter(|c| !c.is_empty()).and_then(|c| rgba_of(&c)).unwrap_or(BLACK);
                    self.shadow(&src, vector(space, px(f.args.first()), px(f.args.get(1))), px(f.args.get(2)) * HALF * s, colour)
                }
                _ => src,
            }
        })
    }

    pub fn apply(&self, src: R::Tex, filters: &[Filter], space: Linear) -> R::Tex {
        let start = Self::plain(src);
        let out = filters.iter().fold(start, |img, f| match f {
            Filter::Css { fns } => self.css_graph(img, fns, space),
            Filter::Svg { nodes } => nodes.iter().fold(img, |i, node| self.svg_graph(i, node, space)),
        });
        out.tex
    }
}

fn scale(space: Linear) -> f64 {
    (space[0] * space[3] - space[1] * space[2]).abs().sqrt()
}

fn vector(space: Linear, dx: f64, dy: f64) -> (f64, f64) {
    (space[0] * dx + space[2] * dy, space[1] * dx + space[3] * dy)
}

const SIGMAS: f64 = 3.0;
const SVG_REGION_SHARE: f64 = 0.1;
const SVG_OWN_REGION: [&str; 5] = ["x", "y", "width", "height", "filterUnits"];
const FRAME_SPACE_PRIMITIVES: [&str; 5] = ["feTurbulence", "feTile", "feImage", "feDiffuseLighting", "feSpecularLighting"];

#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Reach {
    pub share: f64,
    pub px: f64,
}

impl Reach {
    fn plus(self, other: Reach) -> Reach {
        Reach { share: self.share + other.share, px: self.px + other.px }
    }
}

fn css_reach(f: &CssFunction, space: Linear) -> Option<f64> {
    let s = scale(space);
    let px = |i: usize| f.args.get(i).and_then(|v| leading_number(v)).unwrap_or(0.0);
    if css_matrix(&f.name, 1.0).is_some() {
        return Some(0.0);
    }
    match f.name.as_str() {
        "blur" => Some(px(0) * s * SIGMAS),
        "drop-shadow" => {
            let (dx, dy) = vector(space, px(0), px(1));
            Some(dx.abs().max(dy.abs()) + px(2) * HALF * s * SIGMAS)
        }
        _ => None,
    }
}

fn svg_reach(filter: &SvgNode) -> Option<Reach> {
    let own_region = SVG_OWN_REGION.iter().any(|k| filter.attrs.contains_key(*k));
    let frame_space = filter.children.iter().any(|c| FRAME_SPACE_PRIMITIVES.contains(&c.tag.as_str()));
    (!own_region && !frame_space).then_some(Reach { share: SVG_REGION_SHARE, px: 0.0 })
}

pub fn reach(filters: &[Filter], space: Linear) -> Option<Reach> {
    filters.iter().try_fold(Reach::default(), |acc, f| {
        let own = match f {
            Filter::Css { fns } => fns.iter().map(|f| css_reach(f, space)).sum::<Option<f64>>().map(|px| Reach { share: 0.0, px }),
            Filter::Svg { nodes } => nodes.iter().map(svg_reach).try_fold(Reach::default(), |a, r| r.map(|r| a.plus(r))),
        };
        own.map(|r| acc.plus(r))
    })
}
