use wasm_bindgen::prelude::*;

use crate::face::{Ligatures, Op, Source};
use crate::layout::{lay_out, Flow, Fonts, Spaces, Type};

#[wasm_bindgen]
pub enum WebLigatures {
    On,
    Off,
}

#[wasm_bindgen]
pub enum WebSpaces {
    Collapse,
    Keep,
}

#[wasm_bindgen]
pub enum WebWrap {
    Wrap,
    NoWrap,
}

const OPS: [(Op, f32); 5] = [(Op::Move, 0.0), (Op::Line, 1.0), (Op::Quad, 2.0), (Op::Cubic, 3.0), (Op::Close, 4.0)];

#[wasm_bindgen]
pub struct TextCore {
    fonts: Fonts,
}

fn coords(tags: &str, values: &[f32]) -> Vec<(String, f32)> {
    tags.split(',').filter(|t| !t.is_empty()).map(String::from).zip(values.iter().copied()).collect()
}

#[wasm_bindgen]
impl TextCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> TextCore {
        TextCore { fonts: Fonts::new() }
    }

    #[wasm_bindgen(js_name = addFont)]
    pub fn add_font(&mut self, family: &str, bytes: &[u8]) -> Result<usize, JsValue> {
        let source = Source::from_bytes(bytes).map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
        Ok(self.fonts.register(family, &source))
    }

    pub fn covers(&self, font: usize, code_point: u32) -> bool {
        self.fonts.source(font).covers(code_point)
    }

    #[wasm_bindgen(js_name = axisTags)]
    pub fn axis_tags(&self, font: usize) -> String {
        self.fonts.source(font).axes().keys().cloned().collect::<Vec<_>>().join(",")
    }

    #[wasm_bindgen(js_name = axisRanges)]
    pub fn axis_ranges(&self, font: usize) -> Vec<f32> {
        self.fonts.source(font).axes().values().flat_map(|(min, max, fallback)| [*min, *max, *fallback]).collect()
    }

    pub fn metrics(&self, font: usize, tags: &str, values: &[f32]) -> Vec<f32> {
        let face = self.fonts.source(font).at(&coords(tags, values));
        vec![face.units_per_em() as f32, face.ascent(), face.descent()]
    }

    pub fn shape(&self, font: usize, tags: &str, values: &[f32], text: &str, ligatures: WebLigatures) -> Vec<f32> {
        let face = self.fonts.source(font).at(&coords(tags, values));
        let mode = match ligatures {
            WebLigatures::On => Ligatures::On,
            WebLigatures::Off => Ligatures::Off,
        };
        face.shape(text, mode).iter().flat_map(|g| [g.glyph as f32, g.advance, g.dx, g.dy, g.chars as f32]).collect()
    }

    pub fn outline(&self, font: usize, tags: &str, values: &[f32], glyph: u32) -> Vec<f32> {
        let face = self.fonts.source(font).at(&coords(tags, values));
        face.outline(glyph)
            .iter()
            .flat_map(|c| {
                let op = OPS.iter().find(|(o, _)| *o == c.op).map(|(_, code)| *code).unwrap_or(0.0);
                [op, c.at.len() as f32].into_iter().chain(c.at.iter().copied())
            })
            .collect()
    }

    #[allow(clippy::too_many_arguments)]
    #[wasm_bindgen(js_name = layOut)]
    pub fn lay_out(&mut self, text: &str, family: &str, weight: f32, size: f32, tracking: f32, leading: f32, spaces: WebSpaces, wrap: WebWrap, room: f32) -> Vec<f32> {
        let spaces = match spaces {
            WebSpaces::Collapse => Spaces::Collapse,
            WebSpaces::Keep => Spaces::Keep,
        };
        let flow = Flow { spaces, wraps: matches!(wrap, WebWrap::Wrap) };
        let type_ = Type { family: family.into(), weight, italic: false, axes: vec![], size, tracking, leading };
        let paragraphs: Vec<&str> = text.split('\n').collect();
        let laid = lay_out(&paragraphs, &type_, flow, room, &mut self.fonts);
        let mut out = vec![laid.width, laid.height, laid.lines.len() as f32];
        for line in &laid.lines {
            out.extend([line.baseline, line.width, line.glyphs.len() as f32]);
            out.extend(line.glyphs.iter().flat_map(|g| [g.font as f32, g.glyph as f32, g.x, g.dy, g.skew]));
        }
        out
    }
}

impl Default for TextCore {
    fn default() -> Self {
        TextCore::new()
    }
}
