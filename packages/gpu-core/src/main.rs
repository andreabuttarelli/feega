use std::fs;

use gpu_core::display_list::parse;
use gpu_core::files::{write_png, Files};
use gpu_core::render::Renderer;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let pairs: Vec<&[String]> = args[1..].chunks(2).collect();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let mut files = Files::new();
    for pair in pairs {
        let list = parse(&fs::read_to_string(&pair[0]).expect("display list")).expect("valid display list");
        let rendered = renderer.render(&list, &files.pictures(&list)).expect("render");
        for s in &rendered.skipped {
            eprintln!("not drawn: {} {}", s.clip, s.what);
        }
        write_png(&pair[1], list.width, list.height, &rendered.pixels).expect("png write");
    }
}
