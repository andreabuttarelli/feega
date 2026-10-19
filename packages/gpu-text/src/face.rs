use std::collections::BTreeMap;
use std::sync::Arc;

use harfrust::{Feature, ShapeOptions, ShaperData, ShaperInstance, UnicodeBuffer, Variation};
use skrifa::instance::{Location, Size};
use skrifa::outline::{DrawSettings, OutlinePen};
use skrifa::{FontRef, GlyphId, MetadataProvider, Tag};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Op {
    Move,
    Line,
    Quad,
    Cubic,
    Close,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Command {
    pub op: Op,
    pub at: Vec<f32>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shaped {
    pub glyph: u32,
    pub advance: f32,
    pub dx: f32,
    pub dy: f32,
    pub chars: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ligatures {
    On,
    Off,
}

pub type Axes = BTreeMap<String, (f32, f32, f32)>;

pub type Coords = [(String, f32)];

const SUBUNITS: i32 = 64;

const OPTIONAL_LIGATURES: [&[u8; 4]; 5] = [b"liga", b"clig", b"dlig", b"hlig", b"calt"];

#[derive(Debug)]
pub enum FontError {
    Woff2,
    Parse,
}

#[derive(Clone)]
pub struct Source {
    data: Arc<Vec<u8>>,
}

impl Source {
    pub fn from_bytes(bytes: &[u8]) -> Result<Source, FontError> {
        let data = if bytes.starts_with(b"wOF2") { wuff::decompress_woff2(bytes).map_err(|_| FontError::Woff2)? } else { bytes.to_vec() };
        FontRef::new(&data).map_err(|_| FontError::Parse)?;
        Ok(Source { data: Arc::new(data) })
    }

    fn font(&self) -> FontRef<'_> {
        FontRef::new(&self.data).expect("checked when the source was read")
    }

    pub(crate) fn bytes(&self) -> Arc<Vec<u8>> {
        self.data.clone()
    }

    pub fn axes(&self) -> Axes {
        self.font().axes().iter().map(|a| (a.tag().to_string(), (a.min_value(), a.max_value(), a.default_value()))).collect()
    }

    pub fn covers(&self, code_point: u32) -> bool {
        self.font().charmap().map(code_point).is_some()
    }

    pub fn at(&self, coords: &Coords) -> Face {
        let font = self.font();
        let location = font.axes().location(coords.iter().map(|(tag, v)| (tag.as_str(), *v)));
        let metrics = font.metrics(Size::unscaled(), &location);
        Face { data: self.data.clone(), coords: coords.to_vec(), location, units_per_em: metrics.units_per_em, ascent: metrics.ascent, descent: -metrics.descent }
    }
}

#[derive(Clone)]
pub struct Face {
    data: Arc<Vec<u8>>,
    coords: Vec<(String, f32)>,
    location: Location,
    units_per_em: u16,
    ascent: f32,
    descent: f32,
}

impl Face {
    fn font(&self) -> FontRef<'_> {
        FontRef::new(&self.data).expect("checked when the source was read")
    }

    pub fn units_per_em(&self) -> u16 {
        self.units_per_em
    }

    pub fn ascent(&self) -> f32 {
        self.ascent
    }

    pub fn descent(&self) -> f32 {
        self.descent
    }

    pub fn coords(&self) -> &Coords {
        &self.coords
    }

    pub fn same(&self, other: &Face) -> bool {
        Arc::ptr_eq(&self.data, &other.data) && self.coords == other.coords
    }

    pub fn shape(&self, text: &str, ligatures: Ligatures) -> Vec<Shaped> {
        let font = self.font();
        let data = ShaperData::new(&font);
        let variations: Vec<Variation> = self.coords.iter().map(|(tag, v)| (tag.as_str(), *v).into()).collect();
        let instance = ShaperInstance::from_variations(&font, variations);
        let shaper = data.shaper(&font).instance(Some(&instance)).build();
        let features: Vec<Feature> = match ligatures {
            Ligatures::On => vec![],
            Ligatures::Off => OPTIONAL_LIGATURES.iter().map(|t| Feature::new(Tag::new(t), 0, ..)).collect(),
        };
        let mut buffer = UnicodeBuffer::new();
        buffer.push_str(text);
        buffer.guess_segment_properties();
        let shaped = shaper.shape(buffer, ShapeOptions::new().features(&features).scale(Some(self.units_per_em as i32 * SUBUNITS)));
        let clusters: Vec<u32> = shaped.glyph_infos().iter().map(|i| i.cluster).collect();
        let starts: Vec<usize> = text.char_indices().map(|(at, _)| at).collect();
        let chars_from = |cluster: u32| starts.iter().position(|&s| s as u32 >= cluster).unwrap_or(starts.len());
        shaped
            .glyph_infos()
            .iter()
            .zip(shaped.glyph_positions())
            .enumerate()
            .map(|(i, (info, pos))| {
                let end = clusters.iter().skip(i + 1).find(|&&c| c != info.cluster).map_or(starts.len(), |&c| chars_from(c));
                let first = clusters.iter().position(|&c| c == info.cluster) == Some(i);
                Shaped { glyph: info.glyph_id, advance: pos.x_advance as f32 / SUBUNITS as f32, dx: pos.x_offset as f32 / SUBUNITS as f32, dy: pos.y_offset as f32 / SUBUNITS as f32, chars: if first { (end - chars_from(info.cluster)).max(1) as u32 } else { 0 } }
            })
            .collect()
    }

    pub fn outline(&self, glyph: u32) -> Vec<Command> {
        let font = self.font();
        let Some(outline) = font.outline_glyphs().get(GlyphId::new(glyph)) else {
            return vec![];
        };
        let mut pen = Commands(vec![]);
        if outline.draw(DrawSettings::unhinted(Size::unscaled(), &self.location), &mut pen).is_err() {
            return vec![];
        }
        pen.0
    }
}

struct Commands(Vec<Command>);

impl OutlinePen for Commands {
    fn move_to(&mut self, x: f32, y: f32) {
        self.0.push(Command { op: Op::Move, at: vec![x, y] });
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.0.push(Command { op: Op::Line, at: vec![x, y] });
    }

    fn quad_to(&mut self, cx: f32, cy: f32, x: f32, y: f32) {
        self.0.push(Command { op: Op::Quad, at: vec![cx, cy, x, y] });
    }

    fn curve_to(&mut self, ax: f32, ay: f32, bx: f32, by: f32, x: f32, y: f32) {
        self.0.push(Command { op: Op::Cubic, at: vec![ax, ay, bx, by, x, y] });
    }

    fn close(&mut self) {
        self.0.push(Command { op: Op::Close, at: vec![] });
    }
}
