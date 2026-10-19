use std::fs::{self, File};
use std::io::BufWriter;

use gpu_core::{display_list::parse, render::Renderer, scene::build};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pairs: Vec<&[String]> = args[1..].chunks(2).collect();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    for pair in pairs {
        let list = parse(&fs::read_to_string(&pair[0]).expect("display list")).expect("valid display list");
        let (_, skipped) = build(&list);
        for s in &skipped {
            eprintln!("not drawn: {} {}", s.clip, s.what);
        }
        let pixels = renderer.render(&list).expect("render");
        let mut encoder = png::Encoder::new(BufWriter::new(File::create(&pair[1]).expect("png")), list.width, list.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder.write_header().and_then(|mut w| w.write_image_data(&pixels)).expect("png write");
    }
}
