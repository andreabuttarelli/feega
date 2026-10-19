use std::collections::HashMap;

use gpu_text::{clipped, contours_of, dilated, js_round, set_lines, Contour, FaceBook, FaceRule, Flow, Glyph, Rect, Row, Set, Shaping as Setting, Source, Spaces, Style};

use crate::display_list::{Affine, Anchor, Area, DisplayList, FillPlan, FillRule, Item, Look, Paint, PathItem, Rgba, Shaping, Smoothing, Spacing, TextItem, TextPlan, Tinted, Unit};
use crate::stroke::closed_band;
use crate::Skipped;

pub type FontShelf = HashMap<String, Source>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextGap {
    Font,
    Glyph,
}

impl TextGap {
    fn what(self) -> &'static str {
        match self {
            TextGap::Font => "font",
            TextGap::Glyph => "glyph",
        }
    }
}

pub struct Ink {
    pub contours: Vec<Contour>,
    pub paint: Paint,
    pub rule: FillRule,
    pub opacity: f32,
    pub matrix: Affine,
    pub blur: f64,
}

pub struct Painted {
    pub inks: Vec<Ink>,
    pub frame: Rect,
}

struct Smooth {
    darken: f64,
    rise: f64,
}

const STEM_DARKENING: f64 = 0.0121;
const MAX_DARKENING_PX: f64 = 0.3;
const DILATED_RISE_PX: f64 = 0.95;

fn smooth(smoothing: Smoothing, size: f64) -> Smooth {
    match smoothing {
        Smoothing::Dilated => Smooth { darken: MAX_DARKENING_PX.min(size * STEM_DARKENING), rise: DILATED_RISE_PX },
        Smoothing::Plain => Smooth { darken: 0.0, rise: 0.0 },
    }
}

const FIT_SHRINK: f64 = 0.95;
const FIT_MIN_PX: f64 = 6.0;
const FIT_SLACK: f64 = 0.5;
const HUNDREDTHS: f64 = 100.0;
const RISE_SHARE: f64 = 1.05;
const FADE_RISE_PX: f64 = 16.0;
const DESCENDER_EM: f64 = 0.08;
const CAPTION_PAD_EM: f64 = 0.25;
const CSS_TURN: f64 = 90.0;
const HALF: f64 = 0.5;
const IDENTITY: Affine = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0];

fn times(a: Affine, b: Affine) -> Affine {
    [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
}

fn scale_of(m: Affine) -> f64 {
    (m[0] * m[3] - m[1] * m[2]).abs().sqrt()
}

fn style(plan: &TextPlan, size: f64) -> Style {
    let shaping = match plan.shaping {
        Shaping::Runs => Setting::Runs,
        Shaping::Chars => Setting::Chars,
    };
    let request = &plan.request;
    Style { family: request.family.clone(), weight: request.weight, italic: request.italic, axes: request.axes.iter().map(|(k, v)| (k.clone(), *v)).collect(), size, tracking: plan.tracking, leading: plan.leading, inset: plan.inset * size, shaping }
}

fn flow(plan: &TextPlan) -> Flow {
    let spaces = match plan.flow.spaces {
        Spacing::Collapse => Spaces::Collapse,
        Spacing::Keep => Spaces::Keep,
    };
    Flow { spaces, wraps: plan.flow.wraps }
}

fn place(plan: &TextPlan, book: &FaceBook) -> (Set, f64, f64) {
    let lay = |size: f64| set_lines(&plan.paragraphs, &style(plan, size), flow(plan), plan.frame.width, book);
    let mut size = plan.size;
    let mut set = lay(size);
    while plan.fits && size > FIT_MIN_PX && (set.width > plan.frame.width + FIT_SLACK || set.height > plan.frame.height + FIT_SLACK) {
        size = js_round(size * FIT_SHRINK * HUNDREDTHS) / HUNDREDTHS;
        set = lay(size);
    }
    let room = if plan.frame.hugs { set.width } else { plan.frame.width };
    (set, size, room)
}

fn is_word(c: char) -> bool {
    !c.is_whitespace()
}

fn word_lengths(line: &str) -> Vec<usize> {
    line.split(|c: char| !is_word(c)).filter(|w| !w.is_empty()).map(|w| w.chars().count()).collect()
}

struct Slots {
    words: Vec<(usize, usize)>,
    chars_before: Vec<usize>,
    words_before: Vec<usize>,
    finest: Unit,
}

impl Slots {
    fn new(text: &str, paragraphs: &[String], finest: Unit) -> Slots {
        let words: Vec<(usize, usize)> = text.split('\n').enumerate().flat_map(|(l, line)| word_lengths(line).into_iter().map(move |n| (l, n))).collect();
        let chars_before = words.iter().scan(0, |n, w| {
            let before = *n;
            *n += w.1;
            Some(before)
        }).collect();
        let words_before = paragraphs.iter().scan(0, |n, p| {
            let before = *n;
            *n += word_lengths(p).len();
            Some(before)
        }).collect();
        Slots { words, chars_before, words_before, finest }
    }

    fn of(&self, paragraph: usize, word: usize, letter: usize) -> (usize, usize) {
        let word = self.words_before[paragraph] + word;
        let char = self.chars_before.get(word).copied().unwrap_or(0) + letter;
        let key = match self.finest {
            Unit::Char => char,
            Unit::Word => word,
            Unit::Line => self.words.get(word).map_or(0, |w| w.0),
        };
        (key, char)
    }
}

struct Shade {
    paint: Paint,
    squash: f64,
}

fn shade(fill: &FillPlan, [l, t, r, b]: Rect) -> Shade {
    match fill {
        FillPlan::Solid { color } => Shade { paint: Paint::Solid { color: *color }, squash: 1.0 },
        FillPlan::Linear { angle, stops } => {
            let turn = (angle + CSS_TURN).to_radians();
            let (dx, dy) = (turn.sin(), -turn.cos());
            let reach = (((r - l) * dx).abs() + ((b - t) * dy).abs()) * HALF;
            let (cx, cy) = ((l + r) * HALF, (t + b) * HALF);
            Shade { paint: Paint::Linear { from: [cx - dx * reach, cy - dy * reach], to: [cx + dx * reach, cy + dy * reach], stops: stops.clone() }, squash: 1.0 }
        }
        FillPlan::Radial { center, radius, stops } => {
            let (rx, ry) = (radius * HALF * (r - l), radius * HALF * (b - t));
            let squash = if ry > 0.0 { rx / ry } else { 1.0 };
            Shade { paint: Paint::Radial { center: [l + center[0] * (r - l), (t + center[1] * (b - t)) * squash], radius: rx, stops: stops.clone() }, squash }
        }
    }
}

fn mixed(base: Rgba, tint: Rgba, amount: f32) -> Rgba {
    let alpha = tint[3] * amount + base[3] * (1.0 - amount);
    let channel = |k: usize| if alpha == 0.0 { 0.0 } else { (tint[k] * tint[3] * amount + base[k] * base[3] * (1.0 - amount)) / alpha };
    [channel(0), channel(1), channel(2), alpha]
}

fn tinted(paint: Paint, look: &Tinted) -> Paint {
    match (&look.tint, paint) {
        (Some(tint), Paint::Solid { color }) => Paint::Solid { color: mixed(color, tint.color, tint.amount) },
        (_, paint) => paint,
    }
}

fn visible(paint: &Paint) -> bool {
    !matches!(paint, Paint::Solid { color } if color[3] <= 0.0)
}

fn moved(contours: &[Contour], dx: f64, dy: f64) -> impl Iterator<Item = Contour> + '_ {
    contours.iter().map(move |c| c.chunks_exact(2).flat_map(|p| [p[0] + dx, p[1] + dy]).collect())
}

fn transformed(contours: Vec<Contour>, m: Affine) -> Vec<Contour> {
    contours.into_iter().map(|c| c.chunks_exact(2).flat_map(|p| [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]).collect()).collect()
}

fn squashed(contours: Vec<Contour>, squash: f64) -> Vec<Contour> {
    if squash == 1.0 {
        return contours;
    }
    contours.into_iter().map(|c| c.iter().enumerate().map(|(i, v)| if i % 2 == 0 { *v } else { v * squash }).collect()).collect()
}

fn about([l, t, r, b]: Rect, turn: Affine, em: f64) -> Affine {
    let (cx, cy) = ((l + r) / 2.0, (t + b) / 2.0);
    let scaled = [turn[0], turn[1], turn[2], turn[3], turn[4] * em, turn[5] * em];
    times(times([1.0, 0.0, 0.0, 1.0, cx, cy], scaled), [1.0, 0.0, 0.0, 1.0, -cx, -cy])
}

fn inked_width(line: &Row) -> f64 {
    match (line.glyphs.first(), line.glyphs.last()) {
        (Some(first), Some(last)) => last.pen + last.advance - first.pen,
        _ => 0.0,
    }
}

fn rect([l, t, r, b]: Rect) -> Contour {
    vec![l, t, r, t, r, b, l, b]
}

struct Outlines<'a> {
    set: &'a Set,
    size: f64,
    cache: HashMap<(usize, u32, u64, u64), Vec<Contour>>,
}

impl Outlines<'_> {
    fn of(&mut self, g: &Glyph, darken: f64) -> &Vec<Contour> {
        let (set, size) = (self.set, self.size);
        self.cache.entry((g.face, g.glyph, g.skew.to_bits(), darken.to_bits())).or_insert_with(|| {
            let face = &set.faces[g.face];
            let outline = contours_of(&face.outline(g.glyph), size / face.units_per_em() as f64, g.skew);
            if darken > 0.0 {
                dilated(&outline, darken)
            } else {
                outline
            }
        })
    }
}

struct Group<'a> {
    key: (Option<usize>, usize),
    look: &'a Tinted,
    contours: Vec<Contour>,
    outlines: Vec<Contour>,
    bounds: Rect,
    area: Rect,
}

fn still() -> Tinted {
    Tinted { opacity: 1.0, blur: 0.0, turn: IDENTITY, tint: None }
}

pub fn paint(plan: &TextPlan, book: &FaceBook) -> Result<Painted, TextGap> {
    let (set, size, room) = place(plan, book);
    if !set.blocks.iter().any(|b| !b.lines.is_empty()) || set.ascent + set.descent == 0.0 {
        return Err(TextGap::Font);
    }
    if set.missing {
        return Err(TextGap::Glyph);
    }
    let unmoved = still();
    let slots = plan.animation.as_ref().map(|a| Slots::new(&plan.text, &plan.paragraphs, a.finest));
    let smoothing = smooth(plan.smoothing, size);
    let left = plan.frame.left;
    let top = plan.frame.top + if plan.frame.anchor == Anchor::Centre { (plan.frame.height - set.height) / 2.0 } else { 0.0 };
    let matrix: Affine = [1.0, 0.0, 0.0, 1.0, left, top + FADE_RISE_PX * (1.0 - plan.fade as f64)];
    let strip_width: f64 = set.blocks.iter().flat_map(|b| b.lines.iter().map(inked_width)).sum();
    let mut outlines = Outlines { set: &set, size, cache: HashMap::new() };
    let mut inks = vec![];
    let mut strip = 0.0;
    for (i, block) in set.blocks.iter().enumerate() {
        let rise = plan.rises.as_ref().map_or(0.0, |r| RISE_SHARE * block.height * (1.0 - r[i]));
        let mask: Option<Rect> = plan.rises.as_ref().map(|_| [0.0, block.top, room, block.top + block.height + DESCENDER_EM * size]);
        let mut backdrop = vec![];
        let mut groups: Vec<Group> = vec![];
        for (l, line) in block.lines.iter().enumerate() {
            let x = (room - line.width) * plan.align;
            let line_top = block.top + l as f64 * set.line_height + rise;
            let baseline = block.top + line.baseline + rise - smoothing.rise;
            let start = x + line.glyphs.first().map_or(0.0, |g| g.pen);
            let area = match plan.area {
                Area::Line => [start - strip, block.top + line.baseline + rise - set.ascent, start - strip + strip_width, block.top + line.baseline + rise + set.descent],
                Area::Block => [0.0, block.top + rise, room, block.top + rise + block.height],
                Area::Whole => [0.0, 0.0, room, set.height],
            };
            strip += inked_width(line);
            if plan.backdrop.is_some() {
                backdrop.push(rect([x, baseline - set.ascent - CAPTION_PAD_EM * size, x + line.width, baseline + set.descent + CAPTION_PAD_EM * size]));
            }
            for g in &line.glyphs {
                let slot = slots.as_ref().zip(g.word).map(|(s, w)| s.of(i, w, g.letter));
                let key = (slot.map(|s| s.0), if plan.area == Area::Line { l } else { 0 });
                let at = match groups.iter().position(|u| u.key == key) {
                    Some(at) => at,
                    None => {
                        let look = slot.zip(plan.animation.as_ref()).and_then(|(s, a)| a.looks.get(s.1)).unwrap_or(&unmoved);
                        groups.push(Group { key, look, contours: vec![], outlines: vec![], bounds: [f64::INFINITY, f64::INFINITY, f64::NEG_INFINITY, f64::NEG_INFINITY], area });
                        groups.len() - 1
                    }
                };
                let fill = moved(outlines.of(g, smoothing.darken), x + g.x, baseline - g.dy).collect::<Vec<_>>();
                let edge = if plan.outline.is_some() { moved(outlines.of(g, 0.0), x + g.x, baseline - g.dy + smoothing.rise).collect() } else { vec![] };
                let group = &mut groups[at];
                group.contours.extend(fill);
                group.outlines.extend(edge);
                let b = group.bounds;
                group.bounds = [b[0].min(x + g.pen), b[1].min(line_top), b[2].max(x + g.pen + g.advance), b[3].max(line_top + set.line_height)];
            }
        }
        if let Some(colour) = plan.backdrop {
            inks.push(Ink { contours: backdrop, paint: Paint::Solid { color: colour }, rule: FillRule::NonZero, opacity: plan.fade, matrix, blur: 0.0 });
        }
        for group in groups {
            let look = group.look;
            let turn = about(group.bounds, look.turn, size);
            let still_look = std::ptr::eq(look, &unmoved);
            let placed = |contours: Vec<Contour>| {
                let turned = if still_look { contours } else { transformed(contours, turn) };
                match mask {
                    Some(m) => clipped(&turned, m),
                    None => turned,
                }
            };
            let ink = |contours: Vec<Contour>, paint: Paint, rule: FillRule, squash: f64| Ink { contours: squashed(contours, squash), paint, rule, opacity: plan.fade * look.opacity, matrix: if squash == 1.0 { matrix } else { times(matrix, [1.0, 0.0, 0.0, 1.0 / squash, 0.0, 0.0]) }, blur: look.blur * scale_of(look.turn) };
            let shown = placed(group.contours);
            let filled: Vec<Ink> = plan.fills.iter().map(|f| shade(f, group.area)).map(|s| ink(shown.clone(), tinted(s.paint, look), FillRule::NonZero, s.squash)).collect();
            let stroked: Vec<Ink> = plan.outline.iter().map(|o| ink(placed(group.outlines.iter().flat_map(|c| closed_band(c, o.width)).collect()), tinted(Paint::Solid { color: o.colour }, look), FillRule::Union, 1.0)).collect();
            let under = plan.outline.as_ref().is_some_and(|o| o.under);
            let ordered = if under { stroked.into_iter().chain(filled).collect::<Vec<_>>() } else { filled.into_iter().chain(stroked).collect() };
            inks.extend(ordered.into_iter().filter(|i| !i.contours.is_empty() && visible(&i.paint)));
        }
    }
    inks.retain(|i| i.opacity > 0.0);
    let width = if plan.frame.hugs { set.width } else { plan.frame.width };
    let height = if plan.frame.anchor == Anchor::Top { set.height } else { plan.frame.height };
    Ok(Painted { inks, frame: [left, plan.frame.top, width, height] })
}

fn turned_about([left, top, width, height]: Rect, rotation: f64, scale: f64) -> Affine {
    let (cx, cy) = (left + width / 2.0, top + height / 2.0);
    let c = rotation.to_radians().cos() * scale;
    let s = rotation.to_radians().sin() * scale;
    [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]
}

fn paths(item: &TextItem, painted: Painted) -> Vec<Item> {
    let turn = turned_about(painted.frame, item.turn.rotation, item.turn.scale);
    let placed = scale_of(item.look.matrix);
    painted
        .inks
        .into_iter()
        .map(|ink| {
            let look = Look { opacity: item.look.opacity * ink.opacity, matrix: times(item.look.matrix, times(turn, ink.matrix)), blur: item.look.blur + ink.blur * item.turn.scale * placed, ..item.look.clone() };
            Item::Path(PathItem { clip: item.clip.clone(), contours: ink.contours, rule: ink.rule, paint: ink.paint, within: None, look })
        })
        .collect()
}

fn book(list: &DisplayList, fonts: &FontShelf) -> FaceBook {
    let rules = list.faces.iter().map(|f| FaceRule { family: f.family.clone(), italic: f.italic, weight: (f.weight[0], f.weight[1]), source: f.url.clone(), ranges: f.ranges.iter().map(|r| (r[0], r[1])).collect() }).collect();
    let sources = list.faces.iter().filter_map(|f| fonts.get(&f.url).map(|s| (f.url.clone(), s.clone()))).collect();
    FaceBook::new(rules, sources)
}

fn set_items(items: &[Item], book: &FaceBook, skipped: &mut Vec<Skipped>) -> Vec<Item> {
    items
        .iter()
        .flat_map(|item| match item {
            Item::Text(text) => match paint(&text.plan, book) {
                Ok(painted) => paths(text, painted),
                Err(gap) => {
                    skipped.push(Skipped { clip: text.clip.clone(), what: gap.what().into() });
                    vec![]
                }
            },
            Item::Path(p) => vec![Item::Path(PathItem { look: matte_set(&p.look, book, skipped), ..p.clone() })],
            Item::Image(i) => vec![Item::Image(crate::display_list::ImageItem { look: matte_set(&i.look, book, skipped), ..i.clone() })],
            Item::Layer(l) => vec![Item::Layer(crate::display_list::LayerItem { look: matte_set(&l.look, book, skipped), ..l.clone() })],
            Item::Group(g) => vec![Item::Group(Box::new(crate::display_list::GroupItem { clip: g.clip.clone(), items: set_items(&g.items, book, skipped), look: matte_set(&g.look, book, skipped) }))],
            other => vec![other.clone()],
        })
        .collect()
}

fn matte_set(look: &Look, book: &FaceBook, skipped: &mut Vec<Skipped>) -> Look {
    let matte = look.matte.clone().map(|mut m| {
        m.items = set_items(&m.items, book, skipped);
        m
    });
    Look { matte, ..look.clone() }
}

pub fn typeset(list: &DisplayList, fonts: &FontShelf) -> (DisplayList, Vec<Skipped>) {
    let book = book(list, fonts);
    let mut skipped = vec![];
    let items = set_items(&list.items, &book, &mut skipped);
    (DisplayList { items, ..list.clone_empty() }, skipped)
}

pub fn wanted_fonts(list: &DisplayList) -> impl Iterator<Item = &str> {
    list.faces.iter().map(|f| f.url.as_str())
}
