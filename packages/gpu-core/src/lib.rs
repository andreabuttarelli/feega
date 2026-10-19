pub mod display_list;
pub mod engine;
pub mod kernel;
pub mod passes;
pub mod pictures;
#[cfg(not(target_arch = "wasm32"))]
pub mod render;
pub mod scene;
#[cfg(target_arch = "wasm32")]
pub mod web;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skipped {
    pub clip: String,
    pub what: String,
}
