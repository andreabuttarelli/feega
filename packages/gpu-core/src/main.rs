use std::fs::{self, File};
use std::io::{self, BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use gpu_core::frames::{Frames, Sink};
use gpu_core::render::Renderer;

const USAGE: &str = "usage: gpu-core-render <frames.jsonl | -> (--png=<dir> | --raw) [--root=<dir>]\n  one display list per line; --raw writes RGBA8 frames to stdout for an encoder";
const STDIN: &str = "-";

struct Args {
    input: String,
    sink: Sink,
    root: PathBuf,
}

fn flag<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.iter().find_map(|a| a.strip_prefix(name).and_then(|v| v.strip_prefix('=')))
}

fn parsed(args: &[String]) -> Option<Args> {
    let input = args.iter().find(|a| !a.starts_with("--"))?.clone();
    let sink = match (flag(args, "--png"), args.iter().any(|a| a == "--raw")) {
        (Some(dir), false) => Sink::Png(dir.into()),
        (None, true) => Sink::Raw,
        _ => return None,
    };
    let beside = Path::new(&input).parent().filter(|_| input != STDIN).map(Path::to_path_buf).unwrap_or_default();
    let root = flag(args, "--root").map(PathBuf::from).unwrap_or(beside);
    Some(Args { input, sink, root })
}

fn reader(input: &str) -> io::Result<Box<dyn BufRead>> {
    if input == STDIN {
        return Ok(Box::new(BufReader::new(io::stdin())));
    }
    Ok(Box::new(BufReader::new(File::open(input)?)))
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(args) = parsed(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };
    if let Sink::Png(dir) = &args.sink {
        fs::create_dir_all(dir).expect("output directory");
    }
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let input = reader(&args.input).expect("frames");
    let report = Frames::new(&mut renderer, &args.root).run(input, &args.sink, &mut io::stdout().lock());
    match report {
        Ok(report) => {
            for (frame, s) in &report.skipped {
                eprintln!("frame {frame} not drawn: {} {}", s.clip, s.what);
            }
            eprintln!("{} frames", report.frames);
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{}", e.0);
            ExitCode::FAILURE
        }
    }
}
