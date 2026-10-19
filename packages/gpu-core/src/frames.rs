use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufWriter, Write};
use std::path::{Path, PathBuf};

use vello::peniko::ImageData;

use crate::display_list::{parse, Cover, DisplayList, Item};
use crate::pictures::{picture, Pictures};
use crate::render::{RenderError, Renderer};
use crate::text::wanted_fonts;
use crate::Skipped;

pub enum Sink {
    Png(PathBuf),
    Raw,
}

pub struct Report {
    pub frames: usize,
    pub skipped: Vec<(usize, Skipped)>,
}

fn failed<E: std::fmt::Debug>(e: E) -> RenderError {
    RenderError(format!("{e:?}"))
}

pub fn decode(path: &Path) -> Option<ImageData> {
    let mut decoder = png::Decoder::new(File::open(path).ok()?);
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

fn wanted(items: &[Item]) -> Vec<(String, String)> {
    items
        .iter()
        .flat_map(|item| {
            let own = match item {
                Item::Image(image) => vec![(image.clip.clone(), image.src.clone())],
                _ => vec![],
            };
            let look = item.look();
            let matte = look.and_then(|l| l.matte.as_ref()).map(|m| wanted(&m.items)).unwrap_or_default();
            let covers = look.and_then(|l| l.masks.as_ref()).into_iter().flatten().filter_map(|m| match &m.cover {
                Cover::Picture { src, .. } => Some((src.clone(), src.clone())),
                _ => None,
            });
            own.into_iter().chain(matte).chain(covers).collect::<Vec<_>>()
        })
        .collect()
}

pub fn write_png(path: &Path, width: u32, height: u32, pixels: &[u8]) -> Result<(), RenderError> {
    let mut encoder = png::Encoder::new(BufWriter::new(File::create(path).map_err(failed)?), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header().and_then(|mut w| w.write_image_data(pixels)).map_err(failed)
}

pub fn frame_name(index: usize) -> String {
    format!("frame-{index:05}.png")
}

pub struct Frames<'a> {
    renderer: &'a mut Renderer,
    root: PathBuf,
    decoded: HashMap<String, Option<ImageData>>,
    size: Option<(u32, u32)>,
}

impl<'a> Frames<'a> {
    pub fn new(renderer: &'a mut Renderer, root: &Path) -> Self {
        Frames { renderer, root: root.to_path_buf(), decoded: HashMap::new(), size: None }
    }

    fn load_fonts(&mut self, list: &DisplayList) -> Result<(), RenderError> {
        for url in wanted_fonts(list) {
            if self.renderer.has_font(url) {
                continue;
            }
            if let Ok(bytes) = fs::read(self.root.join(url)) {
                self.renderer.put_font(url, gpu_text::Source::from_bytes(&bytes).map_err(failed)?);
            }
        }
        Ok(())
    }

    fn pictures(&mut self, list: &DisplayList) -> Pictures {
        let root = &self.root;
        wanted(&list.items).into_iter().filter_map(|(key, src)| self.decoded.entry(src.clone()).or_insert_with(|| decode(&root.join(&src))).clone().map(|data| (key, data))).collect()
    }

    fn sized(&mut self, list: &DisplayList) -> Result<(), RenderError> {
        let size = (list.width, list.height);
        match self.size {
            Some(first) if first != size => Err(RenderError(format!("frame is {}x{}, the first was {}x{}", size.0, size.1, first.0, first.1))),
            _ => {
                self.size = Some(size);
                Ok(())
            }
        }
    }

    pub fn run(&mut self, input: impl BufRead, sink: &Sink, out: &mut impl Write) -> Result<Report, RenderError> {
        let mut report = Report { frames: 0, skipped: vec![] };
        for line in input.lines() {
            let line = line.map_err(failed)?;
            if line.trim().is_empty() {
                continue;
            }
            let list = parse(&line).map_err(failed)?;
            self.sized(&list)?;
            self.load_fonts(&list)?;
            let pictures = self.pictures(&list);
            let rendered = self.renderer.render(&list, &pictures)?;
            let index = report.frames;
            report.skipped.extend(rendered.skipped.into_iter().map(|s| (index, s)));
            match sink {
                Sink::Png(dir) => write_png(&dir.join(frame_name(index)), list.width, list.height, &rendered.pixels)?,
                Sink::Raw => out.write_all(&rendered.pixels).map_err(failed)?,
            }
            report.frames += 1;
        }
        out.flush().map_err(failed)?;
        Ok(report)
    }
}
