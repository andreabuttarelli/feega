use std::fs::File;
use std::io::{BufWriter, Cursor, Read};
use std::process::{Command, Stdio};

use vello::peniko::ImageData;

use crate::display_list::{Cover, DisplayList, Item};
use crate::pictures::{picture, Pictures};

fn decode<R: Read>(source: R) -> Option<ImageData> {
    let mut decoder = png::Decoder::new(source);
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::ALPHA | png::Transformations::STRIP_16);
    let mut reader = decoder.read_info().ok()?;
    let mut buf = vec![0; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf).ok()?;
    buf.truncate(info.buffer_size());
    let rgba = match info.color_type {
        png::ColorType::Rgba => buf,
        png::ColorType::GrayscaleAlpha => buf.chunks(2).flat_map(|p| [p[0], p[0], p[0], p[1]]).collect(),
        _ => return None,
    };
    Some(picture(info.width, info.height, rgba))
}

const SD_MATRICES: [&str; 3] = ["bt601", "smpte170m", "bt470bg"];

fn matrix_of(tag: &str) -> &'static str {
    if SD_MATRICES.contains(&tag) {
        "bt601"
    } else {
        "bt709"
    }
}

fn through_ffmpeg(path: &str, at: Option<f64>, matrix: &str) -> Option<ImageData> {
    let seek = at.map(|t| vec!["-ss".to_string(), format!("{t:.6}")]).unwrap_or_default();
    let colours = format!("scale=in_color_matrix={matrix}:in_range=tv:out_range=pc");
    let out = Command::new("ffmpeg")
        .args(["-loglevel", "error", "-i", path])
        .args(seek)
        .args(["-frames:v", "1", "-vf", &colours, "-f", "image2pipe", "-c:v", "png", "-pix_fmt", "rgba", "-"])
        .stdin(Stdio::null())
        .output()
        .ok()?;
    decode(Cursor::new(out.stdout))
}

pub fn still(path: &str) -> Option<ImageData> {
    File::open(path).ok().and_then(decode).or_else(|| through_ffmpeg(path, None, "bt709"))
}

const SHOWN_SLACK: f64 = 1e-4;
const HALF_FRAME: f64 = 0.5;

#[derive(Clone, Copy)]
struct Probe {
    fps: Option<f64>,
    matrix: &'static str,
}

fn probe(path: &str) -> Probe {
    let text = Command::new("ffprobe")
        .args(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,color_space", "-of", "default=nw=1", path])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .unwrap_or_default();
    let field = |name: &str| text.lines().find_map(|l| l.strip_prefix(&format!("{name}="))).unwrap_or_default().to_string();
    let rate = field("r_frame_rate");
    let fps = rate.split_once('/').and_then(|(n, d)| Some(n.parse::<f64>().ok()? / d.parse::<f64>().ok()?));
    Probe { fps, matrix: matrix_of(&field("color_space")) }
}

#[derive(Default)]
pub struct Files {
    probes: std::collections::HashMap<String, Probe>,
}

impl Files {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn video_frame(&mut self, path: &str, seconds: f64) -> Option<ImageData> {
        let probe = *self.probes.entry(path.into()).or_insert_with(|| probe(path));
        let shown = probe.fps.map_or(seconds, |fps| (((seconds * fps + SHOWN_SLACK).floor() - HALF_FRAME) / fps).max(0.0));
        through_ffmpeg(path, Some(shown), probe.matrix)
    }

    pub fn pictures(&mut self, list: &DisplayList) -> Pictures {
        wanted(&list.items)
            .into_iter()
            .filter_map(|w| match w {
                Wanted::Still(key, src) => still(&src).map(|d| (key, d)),
                Wanted::Moving(key, src, at) => self.video_frame(&src, at).map(|d| (key, d)),
            })
            .collect()
    }
}

enum Wanted {
    Still(String, String),
    Moving(String, String, f64),
}

fn wanted(items: &[Item]) -> Vec<Wanted> {
    items
        .iter()
        .flat_map(|item| {
            let own = match item {
                Item::Image(image) if image.video => vec![Wanted::Moving(image.clip.clone(), image.src.clone(), image.media_time)],
                Item::Image(image) => vec![Wanted::Still(image.clip.clone(), image.src.clone())],
                Item::Layer(layer) => vec![Wanted::Still(layer.source.clone(), layer.source.clone())],
                Item::Group(group) => wanted(&group.items),
                _ => vec![],
            };
            let look = item.look();
            let matte = look.and_then(|l| l.matte.as_ref()).map(|m| wanted(&m.items)).unwrap_or_default();
            let covers = look.and_then(|l| l.masks.as_ref()).into_iter().flatten().filter_map(|m| match &m.cover {
                Cover::Picture { src, .. } => Some(Wanted::Still(src.clone(), src.clone())),
                _ => None,
            });
            own.into_iter().chain(matte).chain(covers).collect::<Vec<_>>()
        })
        .collect()
}

pub fn write_png(path: &str, width: u32, height: u32, pixels: &[u8]) -> std::io::Result<()> {
    let mut encoder = png::Encoder::new(BufWriter::new(File::create(path)?), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header().and_then(|mut w| w.write_image_data(pixels)).map_err(std::io::Error::other)
}
