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

#[derive(Debug, Clone)]
pub enum Item {
    Path(PathItem),
    Image(ImageItem),
    Other { clip: String, kind: String },
}

impl Item {
    pub fn look(&self) -> Option<&Look> {
        match self {
            Item::Path(p) => Some(&p.look),
            Item::Image(i) => Some(&i.look),
            Item::Other { .. } => None,
        }
    }

    pub fn clip(&self) -> &str {
        match self {
            Item::Path(p) => &p.clip,
            Item::Image(i) => &i.clip,
            Item::Other { clip, .. } => clip,
        }
    }

    pub fn kind(&self) -> &str {
        match self {
            Item::Path(_) => "path",
            Item::Image(_) => "image",
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
            _ => Ok(Item::Other { clip: text("clip"), kind: text("kind") }),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct DisplayList {
    pub width: u32,
    pub height: u32,
    pub background: Option<Rgba>,
    pub items: Vec<Item>,
}

impl DisplayList {
    pub fn clone_empty(&self) -> Self {
        Self { width: self.width, height: self.height, background: self.background, items: Vec::new() }
    }
}

pub fn parse(json: &str) -> Result<DisplayList, serde_json::Error> {
    serde_json::from_str(json)
}
