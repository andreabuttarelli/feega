use std::collections::HashMap;
use std::sync::Arc;

use parley::fontique::{Blob, FontInfoOverride};
use parley::{FontContext, FontFamily, FontStyle, FontVariation, FontWeight, Layout, LayoutContext, LineHeight, PositionedLayoutItem, StyleProperty, TextWrapMode, WhiteSpaceCollapse};
use parley::setting::Tag;

use crate::face::Source;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Spaces {
    Collapse,
    Keep,
}

#[derive(Clone, Copy, Debug)]
pub struct Flow {
    pub spaces: Spaces,
    pub wraps: bool,
}

pub struct Type {
    pub family: String,
    pub weight: f32,
    pub italic: bool,
    pub axes: Vec<(String, f32)>,
    pub size: f32,
    pub tracking: f32,
    pub leading: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LaidGlyph {
    pub font: usize,
    pub glyph: u32,
    pub x: f32,
    pub dy: f32,
    pub skew: f32,
}

#[derive(Clone, Debug)]
pub struct Line {
    pub glyphs: Vec<LaidGlyph>,
    pub width: f32,
    pub baseline: f32,
}

#[derive(Clone, Debug)]
pub struct Laid {
    pub lines: Vec<Line>,
    pub width: f32,
    pub height: f32,
}

const DISPLAY_SCALE: f32 = 1.0;

pub struct Fonts {
    context: FontContext,
    scratch: LayoutContext<()>,
    blobs: HashMap<u64, usize>,
    sources: Vec<Source>,
}

impl Default for Fonts {
    fn default() -> Self {
        Fonts { context: FontContext { collection: parley::fontique::Collection::new(parley::fontique::CollectionOptions { shared: false, system_fonts: false }), source_cache: Default::default() }, scratch: LayoutContext::new(), blobs: HashMap::new(), sources: vec![] }
    }
}

impl Fonts {
    pub fn new() -> Fonts {
        Fonts::default()
    }

    pub fn register(&mut self, family: &str, source: &Source) -> usize {
        let data: Arc<dyn AsRef<[u8]> + Send + Sync> = source.bytes();
        let blob = Blob::new(data);
        let index = self.sources.len();
        self.blobs.insert(blob.id(), index);
        self.sources.push(source.clone());
        self.context.collection.register_fonts(blob, Some(FontInfoOverride { family_name: Some(family), ..Default::default() }));
        index
    }

    pub fn source(&self, font: usize) -> &Source {
        &self.sources[font]
    }
}

fn collapsed(paragraph: &str, spaces: Spaces) -> String {
    match spaces {
        Spaces::Collapse => paragraph.split([' ', '\t', '\n']).filter(|w| !w.is_empty()).collect::<Vec<_>>().join(" "),
        Spaces::Keep => paragraph.to_string(),
    }
}

pub fn lay_out(paragraphs: &[&str], type_: &Type, flow: Flow, room: f32, fonts: &mut Fonts) -> Laid {
    let text = paragraphs.iter().map(|p| collapsed(p, flow.spaces)).collect::<Vec<_>>().join("\n");
    let text = text.as_str();
    let variations: Vec<FontVariation> = type_.axes.iter().filter_map(|(tag, v)| Tag::parse(tag).map(|t| FontVariation::new(t, *v))).collect();
    let mut builder = fonts.scratch.ranged_builder(&mut fonts.context, text, DISPLAY_SCALE, false);
    builder.push_default(StyleProperty::FontFamily(FontFamily::named(&type_.family)));
    builder.push_default(StyleProperty::FontSize(type_.size));
    builder.push_default(StyleProperty::FontWeight(FontWeight::new(type_.weight)));
    builder.push_default(StyleProperty::FontStyle(if type_.italic { FontStyle::Italic } else { FontStyle::Normal }));
    builder.push_default(StyleProperty::FontVariations(parley::FontVariations::List(variations.into())));
    builder.push_default(StyleProperty::LetterSpacing(type_.tracking * type_.size));
    builder.push_default(StyleProperty::LineHeight(LineHeight::FontSizeRelative(type_.leading)));
    builder.push_default(StyleProperty::WhiteSpaceCollapse(WhiteSpaceCollapse::Preserve));
    builder.push_default(StyleProperty::TextWrapMode(if flow.wraps { TextWrapMode::Wrap } else { TextWrapMode::NoWrap }));
    let mut layout: Layout<()> = builder.build(text);
    layout.break_all_lines(Some(room));
    let lines = layout
        .lines()
        .map(|line| {
            let metrics = line.metrics();
            let glyphs = line
                .items()
                .filter_map(|item| match item {
                    PositionedLayoutItem::GlyphRun(run) => Some(run),
                    PositionedLayoutItem::InlineBox(_) => None,
                })
                .flat_map(|run| {
                    let font = fonts.blobs.get(&run.run().font().data.id()).copied().unwrap_or(0);
                    let skew = run.run().synthesis().skew().unwrap_or(0.0).to_radians().tan();
                    let baseline = run.baseline();
                    run.positioned_glyphs().map(|g| LaidGlyph { font, glyph: g.id, x: g.x, dy: g.y - baseline, skew }).collect::<Vec<_>>()
                })
                .collect();
            Line { glyphs, width: metrics.advance, baseline: metrics.baseline }
        })
        .collect();
    Laid { lines, width: layout.width(), height: layout.height() }
}
