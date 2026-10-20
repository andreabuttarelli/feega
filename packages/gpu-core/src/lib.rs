pub mod canvas;
pub mod colour;
pub mod display_list;
pub mod engine;
pub mod filter_passes;
#[cfg(not(target_arch = "wasm32"))]
pub mod files;
pub mod filters;
#[cfg(target_arch = "wasm32")]
pub mod gl_passes;
#[cfg(not(target_arch = "wasm32"))]
pub mod glyphs;
pub mod groups;
pub mod kernel;
pub mod layers;
pub mod pictures;
#[cfg(not(target_arch = "wasm32"))]
pub mod render;
pub mod scene;
#[cfg(not(target_arch = "wasm32"))]
pub mod stroke;
#[cfg(not(target_arch = "wasm32"))]
pub mod text;
pub mod turbulence;
#[cfg(target_arch = "wasm32")]
pub mod web;
#[cfg(target_arch = "wasm32")]
pub mod web_gl;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skipped {
    pub clip: String,
    pub what: String,
}
