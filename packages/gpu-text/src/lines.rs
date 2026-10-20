use crate::book::{FaceBook, Request};
use crate::face::{Face, Ligatures};
use crate::layout::{Flow, Spaces};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shaping {
    Runs,
    Chars,
}

#[derive(Clone, Debug)]
pub struct Style {
    pub family: String,
    pub weight: f32,
    pub italic: bool,
    pub axes: Vec<(String, f32)>,
    pub size: f64,
    pub tracking: f64,
    pub leading: f64,
    pub inset: f64,
    pub shaping: Shaping,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Glyph {
    pub face: usize,
    pub glyph: u32,
    pub skew: f64,
    pub x: f64,
    pub dy: f64,
    pub char: usize,
    pub pen: f64,
    pub advance: f64,
    pub word: Option<usize>,
    pub letter: usize,
}

#[derive(Clone, Debug)]
pub struct Row {
    pub glyphs: Vec<Glyph>,
    pub width: f64,
    pub baseline: f64,
}

#[derive(Clone, Debug)]
pub struct Block {
    pub lines: Vec<Row>,
    pub top: f64,
    pub height: f64,
}

pub struct Set {
    pub blocks: Vec<Block>,
    pub width: f64,
    pub height: f64,
    pub ascent: f64,
    pub descent: f64,
    pub line_height: f64,
    pub missing: bool,
    pub faces: Vec<Face>,
}

struct Token {
    glyphs: Vec<Glyph>,
    width: f64,
    space: bool,
    missing: bool,
}

struct Run {
    text: String,
    face: usize,
    skew: f64,
    at: usize,
}

const SPACE: char = ' ';
const SLACK: f64 = 1e-6;
const LAYOUT_UNIT: f64 = 64.0;

pub fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

fn collapsed(text: &str, spaces: Spaces) -> String {
    match spaces {
        Spaces::Collapse => text.split([' ', '\t', '\n']).filter(|w| !w.is_empty()).collect::<Vec<_>>().join(" ").trim().to_string(),
        Spaces::Keep => text.to_string(),
    }
}

fn tokens(text: &str) -> Vec<&str> {
    let mut out = vec![];
    let mut start = 0;
    let mut kind: Option<bool> = None;
    for (at, c) in text.char_indices() {
        let space = c == SPACE;
        if kind.is_some_and(|k| k != space) {
            out.push(&text[start..at]);
            start = at;
        }
        kind = Some(space);
    }
    if start < text.len() {
        out.push(&text[start..]);
    }
    out
}

struct Setter<'a> {
    style: &'a Style,
    book: &'a FaceBook,
    faces: Vec<Face>,
}

impl Setter<'_> {
    fn request(&self) -> Request {
        Request { family: self.style.family.clone(), weight: self.style.weight, italic: self.style.italic, size: self.style.size as f32, axes: self.style.axes.clone() }
    }

    fn face_index(&mut self, face: Face) -> usize {
        if let Some(i) = self.faces.iter().position(|f| f.same(&face)) {
            return i;
        }
        self.faces.push(face);
        self.faces.len() - 1
    }

    fn runs(&mut self, text: &str) -> (Vec<Run>, bool) {
        let request = self.request();
        let mut runs: Vec<Run> = vec![];
        let mut missing = false;
        for (at, c) in text.chars().enumerate() {
            let Some(resolved) = self.book.resolve(&request, c as u32) else {
                missing |= c != SPACE;
                continue;
            };
            let face = self.face_index(resolved.face);
            let skew = resolved.skew as f64;
            match runs.last_mut() {
                Some(last) if last.face == face && last.skew == skew && last.at + last.text.chars().count() == at => last.text.push(c),
                _ => runs.push(Run { text: c.to_string(), face, skew, at }),
            }
        }
        (runs, missing)
    }

    fn shaped(&mut self, text: &str, first: usize) -> Token {
        let ligatures = if self.style.tracking == 0.0 { Ligatures::On } else { Ligatures::Off };
        let tracking = self.style.tracking * self.style.size;
        let (runs, missing) = self.runs(text);
        let mut glyphs = vec![];
        let mut x = 0.0;
        for run in runs {
            let face = &self.faces[run.face];
            let scale = self.style.size / face.units_per_em() as f64;
            let mut char = first + run.at;
            for g in face.shape(&run.text, ligatures) {
                let advance = g.advance as f64 * scale + tracking * g.chars as f64;
                glyphs.push(Glyph { face: run.face, glyph: g.glyph, skew: run.skew, x: x + g.dx as f64 * scale, dy: g.dy as f64 * scale, char, pen: x, advance, word: None, letter: char - first });
                x += advance;
                char += g.chars as usize;
            }
        }
        Token { glyphs, width: x, space: text.starts_with(SPACE), missing }
    }

    fn token(&mut self, text: &str, first: usize, word: usize) -> Token {
        let pieces: Vec<String> = match self.style.shaping {
            Shaping::Chars => text.chars().map(String::from).collect(),
            Shaping::Runs => vec![text.to_string()],
        };
        let space = text.starts_with(SPACE);
        let mut token = Token { glyphs: vec![], width: 0.0, space, missing: false };
        for (i, piece) in pieces.iter().enumerate() {
            let shaped = self.shaped(piece, first + i);
            let by = token.width;
            token.glyphs.extend(shaped.glyphs.into_iter().map(|g| Glyph { x: g.x + by, pen: g.pen + by, word: if space { None } else { Some(word) }, letter: g.char - first, ..g }));
            token.width += shaped.width;
            token.missing |= shaped.missing;
        }
        token
    }

    fn primary(&self, text: &str) -> Option<Face> {
        let request = self.request();
        self.book.resolve(&request, SPACE as u32).or_else(|| text.chars().next().and_then(|c| self.book.resolve(&request, c as u32))).map(|r| r.face)
    }
}

fn shift(glyphs: &[Glyph], by: f64) -> impl Iterator<Item = Glyph> + '_ {
    glyphs.iter().map(move |g| Glyph { x: g.x + by, pen: g.pen + by, ..*g })
}

fn wrapped(tokens: &[Token], flow: Flow, room: f64, inset: f64) -> Vec<(Vec<Glyph>, f64)> {
    let mut lines: Vec<(Vec<Glyph>, f64)> = vec![];
    let mut glyphs: Vec<Glyph> = vec![];
    let mut pen = inset;
    let mut inked = inset;
    let mut words = 0;
    let mut kept = 0;
    let keep = flow.spaces == Spaces::Keep;
    for token in tokens {
        if token.space {
            if words == 0 && !lines.is_empty() && flow.spaces == Spaces::Collapse {
                continue;
            }
            glyphs.extend(shift(&token.glyphs, pen));
            pen += token.width;
            if keep && words == 0 {
                inked = pen;
                kept = glyphs.len();
            }
            continue;
        }
        if flow.wraps && words > 0 && pen + token.width > room + SLACK {
            glyphs.truncate(kept);
            lines.push((std::mem::take(&mut glyphs), inked));
            pen = 0.0;
            words = 0;
        }
        glyphs.extend(shift(&token.glyphs, pen));
        pen += token.width;
        inked = pen;
        kept = glyphs.len();
        words += 1;
    }
    glyphs.truncate(kept);
    lines.push((glyphs, inked));
    if let Some(last) = lines.last_mut() {
        last.1 += inset;
    }
    lines
}

pub fn set_lines(paragraphs: &[String], style: &Style, flow: Flow, room: f64, book: &FaceBook) -> Set {
    let mut setter = Setter { style, book, faces: vec![] };
    let face = setter.primary(&paragraphs.concat());
    let scale = face.as_ref().map_or(0.0, |f| style.size / f.units_per_em() as f64);
    let ascent = js_round(face.as_ref().map_or(0.0, |f| f.ascent() as f64) * scale);
    let descent = js_round(face.as_ref().map_or(0.0, |f| f.descent() as f64) * scale);
    let line_height = ((js_round(style.size * LAYOUT_UNIT) / LAYOUT_UNIT) * style.leading * LAYOUT_UNIT).floor() / LAYOUT_UNIT;
    let baseline = ((line_height - ascent - descent) / 2.0).floor() + ascent;
    let mut missing = false;
    let mut top = 0.0;
    let mut blocks = vec![];
    for paragraph in paragraphs {
        let text = collapsed(paragraph, flow.spaces);
        let mut first = 0;
        let mut words = 0;
        let mut set: Vec<Token> = vec![];
        for piece in tokens(&text) {
            let token = setter.token(piece, first, words);
            words += usize::from(!token.space);
            first += piece.chars().count();
            missing |= token.missing;
            set.push(token);
        }
        let lines: Vec<Row> = wrapped(&set, flow, room, style.inset).into_iter().enumerate().map(|(i, (glyphs, width))| Row { glyphs, width, baseline: i as f64 * line_height + baseline }).collect();
        let height = lines.len() as f64 * line_height;
        blocks.push(Block { lines, top, height });
        top += height;
    }
    let width = blocks.iter().flat_map(|b| b.lines.iter().map(|l| l.width)).fold(0.0, f64::max);
    Set { blocks, width, height: top, ascent, descent, line_height, missing, faces: setter.faces }
}
