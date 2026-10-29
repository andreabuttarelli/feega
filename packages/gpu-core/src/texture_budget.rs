use std::collections::{HashMap, VecDeque};

pub type Side = (u32, u32);

const RGBA_BYTES: u64 = 4;
const SCREEN_TEXTURES: u64 = 6;
const POOL_SHARE: u64 = 8;
const LAYERS_SHARE: u64 = 8;

pub fn bytes_of((width, height): Side) -> u64 {
    width as u64 * height as u64 * RGBA_BYTES
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Split {
    pub cache: u64,
    pub pool: u64,
    pub layers: u64,
}

pub fn split(budget: u64, screen: Side) -> Split {
    let free = budget.saturating_sub(SCREEN_TEXTURES * bytes_of(screen));
    let pool = free / POOL_SHARE;
    let layers = free / LAYERS_SHARE;
    Split { cache: free - pool - layers, pool, layers }
}

pub struct Shelves<T> {
    kept: HashMap<Side, Vec<T>>,
    order: VecDeque<Side>,
    bytes: u64,
    cap: u64,
}

impl<T> Shelves<T> {
    pub fn new(cap: u64) -> Self {
        Shelves { kept: HashMap::new(), order: VecDeque::new(), bytes: 0, cap }
    }

    pub fn bytes(&self) -> u64 {
        self.bytes
    }

    pub fn take(&mut self, side: Side) -> Option<T> {
        let found = self.kept.get_mut(&side)?.pop()?;
        self.bytes -= bytes_of(side);
        if let Some(at) = self.order.iter().rposition(|s| *s == side) {
            self.order.remove(at);
        }
        Some(found)
    }

    pub fn give(&mut self, side: Side, texture: T) -> Vec<T> {
        let mut gone = self.shrink_to(self.cap.saturating_sub(bytes_of(side)));
        if bytes_of(side) > self.cap {
            gone.push(texture);
            return gone;
        }
        self.kept.entry(side).or_default().push(texture);
        self.order.push_back(side);
        self.bytes += bytes_of(side);
        gone
    }

    pub fn set_cap(&mut self, cap: u64) -> Vec<T> {
        self.cap = cap;
        self.shrink_to(cap)
    }

    fn shrink_to(&mut self, most: u64) -> Vec<T> {
        let mut gone = Vec::new();
        while self.bytes > most {
            let Some(oldest) = self.order.pop_front() else { break };
            let Some(texture) = self.kept.get_mut(&oldest).and_then(|shelf| (!shelf.is_empty()).then(|| shelf.remove(0))) else { continue };
            self.bytes -= bytes_of(oldest);
            gone.push(texture);
        }
        self.kept.retain(|_, shelf| !shelf.is_empty());
        gone
    }
}

pub fn over_cap<K: Clone>(entries: &[(K, u64, u64)], cap: u64) -> Vec<K> {
    let mut by_age: Vec<&(K, u64, u64)> = entries.iter().collect();
    by_age.sort_by_key(|(_, used, _)| *used);
    let mut total: u64 = entries.iter().map(|(_, _, bytes)| bytes).sum();
    let mut gone = Vec::new();
    for (key, _, bytes) in by_age {
        if total <= cap {
            break;
        }
        total -= bytes;
        gone.push(key.clone());
    }
    gone
}

#[cfg(test)]
mod tests {
    use super::*;

    const MB: u64 = 1024 * 1024;
    const PHONE_BUDGET: u64 = 128 * MB;
    const PHONE_SCREEN: Side = (780, 1688);
    const FRAMES: [Side; 3] = [(1440, 4480), (768, 4480), (390, 4480)];
    const LAYERS_PER_FRAME: u32 = 30;
    const GESTURE_FRAMES: u32 = 60;

    fn layer_sides(zoom: f64) -> Vec<Side> {
        FRAMES
            .iter()
            .flat_map(|&(w, h)| (1..=LAYERS_PER_FRAME).map(move |i| (((w as f64 * zoom) as u32).max(1), ((h as f64 * zoom * i as f64 / LAYERS_PER_FRAME as f64 / 2.0) as u32).max(1))))
            .collect()
    }

    #[test]
    fn a_fast_zoom_out_over_three_tall_frames_keeps_the_pool_within_its_share() {
        let share = split(PHONE_BUDGET, PHONE_SCREEN);
        let mut pool = Shelves::new(share.pool);
        let mut created = 0;
        let mut peak = 0;
        for step in 0..GESTURE_FRAMES {
            let zoom = 2.0 * (0.5 - (0.5 - 0.17) * step as f64 / GESTURE_FRAMES as f64);
            let drawn: Vec<(Side, u32)> = layer_sides(zoom)
                .into_iter()
                .map(|side| {
                    let texture = pool.take(side).unwrap_or_else(|| {
                        created += 1;
                        created
                    });
                    (side, texture)
                })
                .collect();
            for (side, texture) in drawn {
                pool.give(side, texture);
                peak = peak.max(pool.bytes());
            }
        }
        assert!(peak <= share.pool, "pool peaked at {} MB", peak / MB);
        assert!(share.cache + share.pool + share.layers + SCREEN_TEXTURES * bytes_of(PHONE_SCREEN) <= PHONE_BUDGET);
    }

    #[test]
    fn a_texture_larger_than_the_pool_is_handed_back_to_destroy() {
        let mut pool = Shelves::new(MB);
        assert_eq!(pool.give((1024, 1024), 7), vec![7]);
        assert_eq!(pool.bytes(), 0);
    }

    #[test]
    fn a_full_pool_drops_its_oldest_texture_first() {
        let mut pool = Shelves::new(2 * bytes_of((10, 10)));
        pool.give((10, 10), 1);
        pool.give((10, 10), 2);
        assert_eq!(pool.give((10, 10), 3), vec![1]);
        assert_eq!(pool.take((10, 10)), Some(3));
    }

    #[test]
    fn a_shelved_texture_comes_back_for_its_own_size_only() {
        let mut pool = Shelves::new(MB);
        pool.give((8, 8), 1);
        assert_eq!(pool.take((8, 9)), None);
        assert_eq!(pool.take((8, 8)), Some(1));
        assert_eq!(pool.bytes(), 0);
    }

    #[test]
    fn lowering_the_cap_hands_back_what_no_longer_fits() {
        let mut pool = Shelves::new(MB);
        pool.give((10, 10), 1);
        pool.give((10, 10), 2);
        assert_eq!(pool.set_cap(bytes_of((10, 10))), vec![1]);
    }

    #[test]
    fn layers_over_their_cap_go_least_recently_used_first() {
        let entries = [("old", 1, 4 * MB), ("new", 9, 4 * MB), ("mid", 5, 4 * MB)];
        assert_eq!(over_cap(&entries, 5 * MB), vec!["old", "mid"]);
    }

    #[test]
    fn the_phone_split_leaves_room_for_the_screen_textures() {
        let share = split(PHONE_BUDGET, PHONE_SCREEN);
        assert!(share.cache > share.pool);
        assert_eq!(share.cache + share.pool + share.layers, PHONE_BUDGET - SCREEN_TEXTURES * bytes_of(PHONE_SCREEN));
    }
}
