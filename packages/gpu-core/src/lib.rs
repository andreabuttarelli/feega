pub mod canvas;
pub mod colour;
pub mod compositor;
pub mod display_list;
pub mod engine;
pub mod filter_passes;
#[cfg(not(target_arch = "wasm32"))]
pub mod files;
pub mod filters;
#[cfg(target_arch = "wasm32")]
pub mod gl_passes;
#[cfg(target_arch = "wasm32")]
pub mod gl_reproject;
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
#[cfg(not(target_arch = "wasm32"))]
pub mod stroke;
#[cfg(not(target_arch = "wasm32"))]
pub mod text;
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
