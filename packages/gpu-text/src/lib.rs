mod book;
mod face;
mod layout;
#[cfg(target_arch = "wasm32")]
mod web;

pub use book::{FaceBook, FaceRule, Request, Resolved};
pub use face::{Axes, Command, Coords, Face, FontError, Ligatures, Op, Shaped, Source};
pub use layout::{lay_out, Flow, Fonts, Laid, LaidGlyph, Line, Spaces, Type};
