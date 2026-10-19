mod book;
mod contours;
mod face;
mod layout;
mod lines;
#[cfg(target_arch = "wasm32")]
mod web;

pub use book::{FaceBook, FaceRule, Request, Resolved};
pub use contours::{area, clipped, contours_of, dilated, Contour, Rect};
pub use face::{Axes, Command, Coords, Face, FontError, Ligatures, Op, Shaped, Source};
pub use layout::{lay_out, Flow, Fonts, Laid, LaidGlyph, Line, Spaces, Type};
pub use lines::{js_round, set_lines, Block, Glyph, Row, Set, Shaping, Style};
