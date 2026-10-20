use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, ExitCode, Stdio};

use gpu_core::display_list::parse;
use gpu_core::files::{write_png, Files};
use gpu_core::render::Renderer;
use gpu_text::Source;

const USAGE: &str = "gpu-core-export --lists <frames.jsonl> --fps <n> (--out <file.mp4> | --frames <dir>) [--font <key>=<file>]...";

enum Sink {
    Video { path: String, fps: f64, ffmpeg: Option<Child> },
    Frames(String),
}

impl Sink {
    fn write(&mut self, index: usize, width: u32, height: u32, pixels: &[u8]) -> Result<(), String> {
        match self {
            Sink::Frames(dir) => write_png(&format!("{dir}/frame-{index:05}.png"), width, height, pixels).map_err(|e| e.to_string()),
            Sink::Video { path, fps, ffmpeg } => {
                if ffmpeg.is_none() {
                    let size = format!("{width}x{height}");
                    let child = Command::new("ffmpeg")
                        .args(["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", &size, "-r", &fps.to_string(), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", path])
                        .stdin(Stdio::piped())
                        .spawn()
                        .map_err(|e| format!("ffmpeg: {e}"))?;
                    *ffmpeg = Some(child);
                }
                let stdin = ffmpeg.as_mut().and_then(|c| c.stdin.as_mut()).ok_or("ffmpeg has no stdin")?;
                stdin.write_all(pixels).map_err(|e| e.to_string())
            }
        }
    }

    fn finish(self) -> Result<(), String> {
        let Sink::Video { ffmpeg: Some(mut child), .. } = self else { return Ok(()) };
        drop(child.stdin.take());
        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("ffmpeg exited with {status}"))
        }
    }
}

struct Options {
    lists: String,
    sink: Sink,
    fonts: Vec<(String, String)>,
}

fn options(args: &[String]) -> Result<Options, String> {
    let value = |name: &str| args.windows(2).find(|w| w[0] == name).map(|w| w[1].clone());
    let lists = value("--lists").ok_or(USAGE)?;
    let fps: f64 = value("--fps").and_then(|f| f.parse().ok()).unwrap_or(30.0);
    let sink = match (value("--out"), value("--frames")) {
        (Some(path), None) => Sink::Video { path, fps, ffmpeg: None },
        (None, Some(dir)) => {
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            Sink::Frames(dir)
        }
        _ => return Err(USAGE.into()),
    };
    let fonts = args.windows(2).filter(|w| w[0] == "--font").filter_map(|w| w[1].split_once('=').map(|(k, p)| (k.to_string(), p.to_string()))).collect();
    Ok(Options { lists, sink, fonts })
}

fn run(options: Options) -> Result<usize, String> {
    let mut renderer = Renderer::new().map_err(|e| e.0)?;
    for (key, path) in &options.fonts {
        let bytes = fs::read(path).map_err(|e| format!("{path}: {e}"))?;
        renderer.put_font(key, Source::from_bytes(&bytes).map_err(|e| format!("{path}: {e:?}"))?);
    }
    let mut files = Files::new();
    let mut sink = options.sink;
    let reader = BufReader::new(File::open(&options.lists).map_err(|e| format!("{}: {e}", options.lists))?);
    let mut count = 0;
    for (index, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| e.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let list = parse(&line).map_err(|e| format!("frame {index}: {e}"))?;
        let rendered = renderer.render(&list, &files.pictures(&list)).map_err(|e| e.0)?;
        if let Some(gap) = rendered.skipped.first() {
            return Err(format!("frame {index}: not drawn: {} {}", gap.clip, gap.what));
        }
        sink.write(index, list.width, list.height, &rendered.pixels)?;
        count += 1;
    }
    sink.finish()?;
    Ok(count)
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match options(&args).and_then(run) {
        Ok(count) => {
            eprintln!("{count} frames");
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
