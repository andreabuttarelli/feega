use rustc_hash::{FxHashMap, FxHashSet};
use serde::Deserialize;

use crate::display_list::Item;
use crate::world::OverlayPart;

const KEYED_PARTS: [OverlayPart; 2] = [OverlayPart::Fixed, OverlayPart::Selected];

#[derive(Deserialize)]
pub struct ChunkOps {
    #[serde(default)]
    put: Vec<(String, Vec<Item>)>,
    #[serde(default)]
    drop: Vec<String>,
    fixed: Option<Vec<String>>,
    selected: Option<Vec<String>>,
}

pub fn parse_chunk_ops(json: &str) -> Result<ChunkOps, serde_json::Error> {
    serde_json::from_str(json)
}

#[derive(Default)]
pub struct OverlayChunks {
    chunks: FxHashMap<String, Vec<Item>>,
    orders: [Vec<String>; 2],
}

impl OverlayChunks {
    pub fn apply(&mut self, ops: ChunkOps) -> Vec<(OverlayPart, Vec<Item>)> {
        let ChunkOps { put, drop, fixed, selected } = ops;
        let mut touched: FxHashSet<String> = put.iter().map(|(key, _)| key.clone()).collect();
        self.chunks.extend(put);
        for key in drop {
            self.chunks.remove(&key);
            touched.insert(key);
        }

        let mut due = [false; 2];
        for (slot, order) in [fixed, selected].into_iter().enumerate() {
            let Some(order) = order else {
                continue;
            };
            self.orders[slot] = order;
            due[slot] = true;
        }

        for (slot, order) in self.orders.iter().enumerate() {
            due[slot] |= order.iter().any(|key| touched.contains(key));
        }

        KEYED_PARTS.iter().enumerate().filter(|(slot, _)| due[*slot]).map(|(slot, &part)| (part, self.items_of(slot))).collect()
    }

    fn items_of(&self, slot: usize) -> Vec<Item> {
        self.orders[slot].iter().filter_map(|key| self.chunks.get(key)).flatten().cloned().collect()
    }
}
