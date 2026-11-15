use std::collections::hash_map::DefaultHasher;
use std::fmt::Write;
use std::hash::Hasher;

use crate::display_list::Item;

pub type LayerKey = u128;

const SECOND_LANE: u8 = 1;

struct Lanes(DefaultHasher, DefaultHasher);

impl Write for Lanes {
    fn write_str(&mut self, s: &str) -> std::fmt::Result {
        self.0.write(s.as_bytes());
        self.1.write(s.as_bytes());
        Ok(())
    }
}

pub fn layer_key((width, height): (u32, u32), item: &Item) -> LayerKey {
    let mut second = DefaultHasher::new();
    second.write_u8(SECOND_LANE);
    let mut lanes = Lanes(DefaultHasher::new(), second);
    let _ = write!(lanes, "{width}x{height} {item:?}");
    (lanes.0.finish() as u128) << 64 | lanes.1.finish() as u128
}
