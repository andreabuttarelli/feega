use rustc_hash::{FxHashMap, FxHashSet};

use crate::display_list::UseItem;

struct Placed {
    u: UseItem,
    rank: u64,
}

#[derive(Default)]
pub struct Uses {
    slots: Vec<Option<Placed>>,
    free: Vec<usize>,
    by_clip: FxHashMap<String, usize>,
    by_group: FxHashMap<String, Vec<usize>>,
    flagged: FxHashSet<usize>,
    next_rank: u64,
}

fn flagged(u: &UseItem) -> bool {
    u.cache || u.hold
}

impl Uses {
    pub fn get(&self, clip: &str) -> Option<&UseItem> {
        self.by_clip.get(clip).map(|&s| self.at(s))
    }

    fn at(&self, slot: usize) -> &UseItem {
        &self.slots[slot].as_ref().expect("live slot").u
    }

    fn rank(&self, slot: usize) -> u64 {
        self.slots[slot].as_ref().expect("live slot").rank
    }

    fn stacked(&self, mut slots: Vec<usize>) -> Vec<&UseItem> {
        slots.sort_unstable_by_key(|&s| self.rank(s));
        slots.dedup();
        slots.into_iter().map(|s| self.at(s)).collect()
    }

    pub fn put(&mut self, u: UseItem) -> Option<UseItem> {
        match self.by_clip.get(&u.clip).copied() {
            Some(slot) => {
                let rank = self.rank(slot);
                let old = self.unlink(slot);
                self.link(slot, Placed { u, rank });
                Some(old)
            }
            None => {
                let slot = self.free.pop().unwrap_or(self.slots.len());
                if slot == self.slots.len() {
                    self.slots.push(None);
                }
                self.by_clip.insert(u.clip.clone(), slot);
                let rank = self.next_rank;
                self.next_rank += 1;
                self.link(slot, Placed { u, rank });
                None
            }
        }
    }

    pub fn remove(&mut self, clip: &str) -> Option<UseItem> {
        let slot = self.by_clip.remove(clip)?;
        let old = self.unlink(slot);
        self.free.push(slot);
        Some(old)
    }

    fn link(&mut self, slot: usize, placed: Placed) {
        self.by_group.entry(placed.u.group.clone()).or_default().push(slot);
        if flagged(&placed.u) {
            self.flagged.insert(slot);
        }
        self.slots[slot] = Some(placed);
    }

    fn unlink(&mut self, slot: usize) -> UseItem {
        let placed = self.slots[slot].take().expect("live slot");
        if let Some(of_group) = self.by_group.get_mut(&placed.u.group) {
            of_group.retain(|&s| s != slot);
            if of_group.is_empty() {
                self.by_group.remove(&placed.u.group);
            }
        }
        self.flagged.remove(&slot);
        placed.u
    }

    pub fn of_group(&self, group: &str) -> Vec<&UseItem> {
        self.stacked(self.by_group.get(group).cloned().unwrap_or_default())
    }

    pub fn flagged(&self) -> Vec<&UseItem> {
        self.stacked(self.flagged.iter().copied().collect())
    }

    pub fn all(&self) -> Vec<&UseItem> {
        self.stacked(self.by_clip.values().copied().collect())
    }

    pub fn restack(&mut self, order: &[String]) -> Vec<usize> {
        let mut wanted: FxHashMap<&str, usize> = FxHashMap::default();
        for (i, clip) in order.iter().enumerate() {
            wanted.entry(clip.as_str()).or_insert(i);
        }
        let mut before: Vec<usize> = self.by_clip.values().copied().collect();
        before.sort_unstable_by_key(|&s| self.rank(s));
        let mut after: Vec<(usize, usize)> = before.iter().copied().enumerate().collect();
        after.sort_by_key(|&(_, s)| wanted.get(self.at(s).clip.as_str()).copied().unwrap_or(usize::MAX));
        for (rank, &(_, slot)) in after.iter().enumerate() {
            self.slots[slot].as_mut().expect("live slot").rank = rank as u64;
        }
        self.next_rank = after.len() as u64;
        after.into_iter().map(|(was, _)| was).collect()
    }
}
