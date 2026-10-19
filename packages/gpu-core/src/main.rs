use std::fs::{self, File};
use std::io::BufWriter;

use gpu_core::display_list::{parse, Cover, DisplayList, Item};
use gpu_core::pictures::{picture, Pictures};
use gpu_core::render::Renderer;
use gpu_core::text::wanted_fonts;

fn decode(path: &str) -> Option<vello::peniko::ImageData> {
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

fn pictures(list: &DisplayList) -> Pictures {
    wanted(&list.items).into_iter().filter_map(|(key, src)| decode(&src).map(|data| (key, data))).collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pairs: Vec<&[String]> = args[1..].chunks(2).collect();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    for pair in pairs {
        let list = parse(&fs::read_to_string(&pair[0]).expect("display list")).expect("valid display list");
        for url in wanted_fonts(&list) {
            if !renderer.has_font(url) {
                if let Ok(bytes) = fs::read(url) {
                    renderer.put_font(url, gpu_text::Source::from_bytes(&bytes).expect("a readable font"));
                }
            }
        }
        let rendered = renderer.render(&list, &pictures(&list)).expect("render");
        for s in &rendered.skipped {
            eprintln!("not drawn: {} {}", s.clip, s.what);
        }
        let mut encoder = png::Encoder::new(BufWriter::new(File::create(&pair[1]).expect("png")), list.width, list.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.write_header().and_then(|mut w| w.write_image_data(&rendered.pixels)).expect("png write");
    }
}
