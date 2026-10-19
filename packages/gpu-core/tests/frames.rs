#![cfg(feature = "gpu")]

use std::fs;
use std::path::Path;

use gpu_core::frames::{decode, frame_name, Frames, Sink};
use gpu_core::render::Renderer;
use serde_json::Value;

const FIXTURE: &str = "tests/fixtures/text-parity.json";
const REPO: &str = "../..";
const BYTES: usize = 4;

fn book(names: &[&str]) -> String {
    let cases: Vec<Value> = serde_json::from_str(&fs::read_to_string(FIXTURE).unwrap()).unwrap();
    names.iter().map(|n| cases.iter().find(|c| c["name"] == *n).unwrap()["list"].to_string()).collect::<Vec<_>>().join("\n")
}

fn raw(book: &str) -> Vec<u8> {
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let mut out = vec![];
    Frames::new(&mut renderer, Path::new(REPO)).run(book.as_bytes(), &Sink::Raw, &mut out).unwrap();
    out
}

#[test]
fn pipes_one_rgba_frame_per_line() {
    let out = raw(&book(&["title settled", "font mono", "caption on its box"]));

    assert_eq!(out.len(), 3 * 1920 * 1080 * BYTES);
}

#[test]
fn renders_the_same_bytes_every_time() {
    let lines = book(&["animator chars", "animator chars", "gradient fill and outside stroke"]);
    let first = raw(&lines);
    let second = raw(&lines);
    let frame = 1920 * 1080 * BYTES;

    assert_eq!(first, second);
    assert_eq!(first[..frame], first[frame..2 * frame]);
}

#[test]
fn writes_numbered_pngs_matching_the_raw_frames() {
    let lines = book(&["title revealing", "kicker tracked"]);
    let dir = std::env::temp_dir().join("gpu-core-frames-test");
    fs::create_dir_all(&dir).unwrap();
    let mut renderer = Renderer::new().expect("a GPU adapter");
    let report = Frames::new(&mut renderer, Path::new(REPO)).run(lines.as_bytes(), &Sink::Png(dir.clone()), &mut vec![]).unwrap();
    let second = decode(&dir.join(frame_name(1))).unwrap();
    let frame = 1920 * 1080 * BYTES;

    assert_eq!(report.frames, 2);
    assert!(report.skipped.is_empty());
    assert_eq!(second.data.data(), &raw(&lines)[frame..]);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn refuses_a_frame_of_another_size() {
    let mut list: Value = serde_json::from_str(&book(&["font mono"])).unwrap();
    list["width"] = 64.into();
    let lines = [book(&["font mono"]), list.to_string()].join("\n");
    let mut renderer = Renderer::new().expect("a GPU adapter");

    assert!(Frames::new(&mut renderer, Path::new(REPO)).run(lines.as_bytes(), &Sink::Raw, &mut vec![]).is_err());
}
