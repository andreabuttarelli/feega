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
    pub masks: Option<serde_json::Value>,
    #[serde(default)]
    pub matte: Option<serde_json::Value>,
    #[serde(default)]
    pub filters: Option<serde_json::Value>,
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

pub fn parse(json: &str) -> Result<DisplayList, serde_json::Error> {
    serde_json::from_str(json)
}
