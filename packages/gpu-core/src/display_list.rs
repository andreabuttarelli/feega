use serde::Deserialize;

pub type Rgba = [f32; 4];
pub type Affine = [f64; 6];

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum FillRule {
    NonZero,
    EvenOdd,
    Union,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Stop {
    pub at: f32,
    pub color: Rgba,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Paint {
    Solid { color: Rgba },
    Linear { from: [f64; 2], to: [f64; 2], stops: Vec<Stop> },
    Radial { center: [f64; 2], radius: f64, stops: Vec<Stop> },
}

#[derive(Debug, Clone, Deserialize)]
pub struct Within {
    pub contours: Vec<Vec<f64>>,
    pub outside: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MaskMode {
    Add,
    Subtract,
    Intersect,
    Difference,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Ramp {
    Linear,
    Radial,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Cover {
    Path { contours: Vec<Vec<f64>>, matrix: Affine },
    Ramp { ramp: Ramp, contours: Vec<Vec<f64>>, matrix: Affine },
    Picture { src: String, luma: bool, matrix: Affine },
}

impl Cover {
    pub fn moved(self, by: Affine) -> Self {
        let times = |m: Affine| (vello::kurbo::Affine::new(by) * vello::kurbo::Affine::new(m)).as_coeffs();
        match self {
            Cover::Path { contours, matrix } => Cover::Path { contours, matrix: times(matrix) },
            Cover::Ramp { ramp, contours, matrix } => Cover::Ramp { ramp, contours, matrix: times(matrix) },
            Cover::Picture { src, luma, matrix } => Cover::Picture { src, luma, matrix: times(matrix) },
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct MaskLayer {
    pub mode: MaskMode,
    pub invert: bool,
    pub level: f32,
    pub feather: f64,
    pub cover: Cover,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Matte {
    pub items: Vec<Item>,
    pub luma: bool,
    pub invert: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CssFunction {
    pub name: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SvgNode {
    pub tag: String,
    #[serde(default)]
    pub attrs: serde_json::Map<String, serde_json::Value>,
    #[serde(default)]
    pub children: Vec<SvgNode>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Filter {
    Css { fns: Vec<CssFunction> },
    Svg { nodes: Vec<SvgNode> },
}

#[derive(Debug, Clone, Deserialize)]
pub struct Look {
    pub opacity: f32,
    pub matrix: Affine,
    #[serde(default)]
    pub blur: f64,
    #[serde(default = "normal")]
    pub blend: String,
    #[serde(default)]
    pub scissor: Option<[f64; 4]>,
    #[serde(default)]
    pub masks: Option<Vec<MaskLayer>>,
    #[serde(default)]
    pub matte: Option<Matte>,
    #[serde(default)]
    pub filters: Option<Vec<Filter>>,
    #[serde(default)]
    pub space: Option<[f64; 4]>,
    #[serde(default)]
    pub backdrop: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PathItem {
    pub clip: String,
    pub contours: Vec<Vec<f64>>,
    pub rule: FillRule,
    pub paint: Paint,
    #[serde(default)]
    pub within: Option<Within>,
    #[serde(flatten)]
    pub look: Look,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Size {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageItem {
    pub clip: String,
    pub src: String,
    pub video: bool,
    pub media_time: f64,
    pub size: Size,
    pub fit: String,
    pub focus: [f64; 2],
    pub zoom: f64,
    pub clipped: bool,
    pub inner: Affine,
    #[serde(flatten)]
    pub look: Look,
}

fn normal() -> String {
    "normal".into()
}

#[derive(Debug, Clone, Deserialize)]
pub struct UseItem {
    pub clip: String,
    pub group: String,
    pub matrix: Affine,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GlyphsItem {
    pub clip: String,
    pub font: String,
    #[serde(default)]
    pub coords: Vec<(String, f32)>,
    pub size: f64,
    pub glyphs: Vec<[f64; 3]>,
    pub paint: Paint,
    #[serde(flatten)]
    pub look: Look,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Shaping {
    Runs,
    Chars,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Spacing {
    Collapse,
    Keep,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Flow {
    pub spaces: Spacing,
    pub wraps: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Anchor {
    Centre,
    Top,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct PlanFrame {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
    pub anchor: Anchor,
    pub hugs: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Area {
    Line,
    Block,
    Whole,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Unit {
    Char,
    Word,
    Line,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Smoothing {
    Dilated,
    Plain,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlanRequest {
    pub family: String,
    pub weight: f32,
    pub italic: bool,
    pub axes: std::collections::BTreeMap<String, f32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum FillPlan {
    Solid { color: Rgba },
    Linear { angle: f64, stops: Vec<Stop> },
    Radial { center: [f64; 2], radius: f64, stops: Vec<Stop> },
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextOutline {
    pub width: f64,
    pub colour: Rgba,
    pub under: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Tint {
    pub color: Rgba,
    pub amount: f32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Tinted {
    pub opacity: f32,
    pub blur: f64,
    pub turn: Affine,
    pub tint: Option<Tint>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextAnimation {
    pub finest: Unit,
    pub looks: Vec<Tinted>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextPlan {
    pub text: String,
    pub paragraphs: Vec<String>,
    pub request: PlanRequest,
    pub size: f64,
    pub fits: bool,
    pub tracking: f64,
    pub leading: f64,
    pub inset: f64,
    pub shaping: Shaping,
    pub flow: Flow,
    pub frame: PlanFrame,
    pub align: f64,
    pub fade: f32,
    pub rises: Option<Vec<f64>>,
    pub area: Area,
    pub backdrop: Option<Rgba>,
    pub fills: Vec<FillPlan>,
    pub outline: Option<TextOutline>,
    pub animation: Option<TextAnimation>,
    pub smoothing: Smoothing,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Turn {
    pub scale: f64,
    pub rotation: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextItem {
    pub clip: String,
    pub plan: TextPlan,
    pub turn: Turn,
    #[serde(flatten)]
    pub look: Look,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lens {
    pub center: [f32; 2],
    pub drops: [f32; 12],
    pub unwarp: [f32; 3],
    pub blend: f32,
    pub wobble: f32,
    pub wobble_speed: f32,
    pub time: f32,
    pub seed: f32,
    pub ior: f32,
    pub dispersion: f32,
    pub frost: f32,
    pub reflection: f32,
    pub tint_amount: f32,
    pub presence: f32,
    pub tint: [f32; 3],
    #[serde(rename = "box")]
    pub area: [f32; 4],
}

impl Lens {
    pub fn params(&self) -> Vec<f32> {
        let scalars = [self.blend, self.wobble, self.wobble_speed, self.time, self.seed, self.ior, self.dispersion, self.frost, self.reflection, self.tint_amount, self.presence];
        [&self.center[..], &self.drops, &self.unwarp, &scalars, &self.tint, &self.area].concat()
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct LensItem {
    pub clip: String,
    pub lens: Lens,
}

#[derive(Debug, Clone)]
pub enum Item {
    Path(PathItem),
    Image(ImageItem),
    Use(UseItem),
    Glyphs(GlyphsItem),
    Text(Box<TextItem>),
    Lens(Box<LensItem>),
    Other { clip: String, kind: String },
}

impl Item {
    pub fn look(&self) -> Option<&Look> {
        match self {
            Item::Path(p) => Some(&p.look),
            Item::Image(i) => Some(&i.look),
            Item::Use(_) | Item::Glyphs(_) | Item::Text(_) | Item::Lens(_) | Item::Other { .. } => None,
        }
    }

    pub fn clip(&self) -> &str {
        match self {
            Item::Path(p) => &p.clip,
            Item::Image(i) => &i.clip,
            Item::Use(u) => &u.clip,
            Item::Glyphs(g) => &g.clip,
            Item::Text(t) => &t.clip,
            Item::Lens(l) => &l.clip,
            Item::Other { clip, .. } => clip,
        }
    }

    pub fn kind(&self) -> &str {
        match self {
            Item::Path(_) => "path",
            Item::Image(_) => "image",
            Item::Use(_) => "use",
            Item::Glyphs(_) => "glyphs",
            Item::Text(_) => "text",
            Item::Lens(_) => "lens",
            Item::Other { kind, .. } => kind,
        }
    }
}

impl<'de> Deserialize<'de> for Item {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let value = serde_json::Value::deserialize(d)?;
        let text = |key: &str| value.get(key).and_then(|v| v.as_str()).unwrap_or_default().to_string();
        match text("kind").as_str() {
            "path" => serde_json::from_value(value).map(Item::Path).map_err(serde::de::Error::custom),
            "image" => serde_json::from_value(value).map(Item::Image).map_err(serde::de::Error::custom),
            "use" => serde_json::from_value(value).map(Item::Use).map_err(serde::de::Error::custom),
            "glyphs" => serde_json::from_value(value).map(Item::Glyphs).map_err(serde::de::Error::custom),
            "text" => serde_json::from_value(value).map(|t| Item::Text(Box::new(t))).map_err(serde::de::Error::custom),
            "lens" => serde_json::from_value(value).map(|l| Item::Lens(Box::new(l))).map_err(serde::de::Error::custom),
            _ => Ok(Item::Other { clip: text("clip"), kind: text("kind") }),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct FaceSpec {
    pub family: String,
    pub italic: bool,
    pub weight: [f32; 2],
    pub url: String,
    pub ranges: Vec<[u32; 2]>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DisplayList {
    pub width: u32,
    pub height: u32,
    pub background: Option<Rgba>,
    pub items: Vec<Item>,
    #[serde(default)]
    pub faces: Vec<FaceSpec>,
}

impl DisplayList {
    pub fn clone_empty(&self) -> Self {
        Self { width: self.width, height: self.height, background: self.background, items: Vec::new(), faces: self.faces.clone() }
    }
}

pub fn parse(json: &str) -> Result<DisplayList, serde_json::Error> {
    serde_json::from_str(json)
}
