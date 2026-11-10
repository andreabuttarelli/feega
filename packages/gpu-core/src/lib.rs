pub mod canvas;
pub mod colour;
pub mod compositor;
pub mod display_list;
pub mod packed;
pub mod engine;
pub mod filter_passes;
#[cfg(not(target_arch = "wasm32"))]
pub mod files;
pub mod filters;
#[cfg(target_arch = "wasm32")]
pub mod gl_passes;
#[cfg(target_arch = "wasm32")]
pub mod gl_reproject;
pub mod gl_state;
#[cfg(not(target_arch = "wasm32"))]
pub mod glyphs;
pub mod fragments;
pub mod groups;
pub mod kernel;
pub mod layers;
pub mod lod;
pub mod pictures;
pub mod reproject;
pub mod retained;
#[cfg(not(target_arch = "wasm32"))]
pub mod render;
pub mod scene;
pub mod tally;
#[cfg(not(target_arch = "wasm32"))]
pub mod stroke;
#[cfg(not(target_arch = "wasm32"))]
pub mod text;
pub mod texture_budget;
pub mod tiles;
pub mod turbulence;
#[cfg(target_arch = "wasm32")]
pub mod web;
#[cfg(target_arch = "wasm32")]
pub mod web_gl;
pub mod world;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skipped {
    pub clip: String,
    pub what: String,
}

thread_local! {
    pub static PROBE_MODE: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
}
pub const PROBE_NO_FX: u32 = 1;
pub const PROBE_NO_VELLO: u32 = 2;
pub fn probe_off(bit: u32) -> bool {
    PROBE_MODE.with(|m| m.get() & bit != 0)
}
thread_local! {
    pub static PROBE_OPS: std::cell::RefCell<[(u32, f64); 15]> = const { std::cell::RefCell::new([(0, 0.0); 15]) };
}
