pub mod display_list;
pub mod render;
pub mod scene;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Skipped {
    pub clip: String,
    pub what: String,
}
