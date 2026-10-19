use std::fs::{self, File};
use std::io::BufWriter;

use gpu_core::display_list::{parse, DisplayList, Item};
use gpu_core::pictures::{picture, Pictures};
use gpu_core::{render::Renderer, scene::build};

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

fn pictures(list: &DisplayList) -> Pictures {
    list.items
        .iter()
        .filter_map(|item| match item {
            Item::Image(image) => decode(&image.src).map(|data| (image.clip.clone(), data)),
            _ => None,
        })
        .collect()
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pairs: Vec<&[String]> = args[1..].chunks(2).collect();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    for pair in pairs {
        let list = parse(&fs::read_to_string(&pair[0]).expect("display list")).expect("valid display list");
        let pictures = pictures(&list);
        let (_, skipped) = build(&list, &pictures);
        for s in &skipped {
            eprintln!("not drawn: {} {}", s.clip, s.what);
        }
        let pixels = renderer.render(&list, &pictures).expect("render");
        let mut encoder = png::Encoder::new(BufWriter::new(File::create(&pair[1]).expect("png")), list.width, list.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.write_header().and_then(|mut w| w.write_image_data(&pixels)).expect("png write");
    }
}
