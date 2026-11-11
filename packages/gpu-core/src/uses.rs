use std::cell::Cell;

use rustc_hash::{FxHashMap, FxHashSet};
use vello::kurbo::Rect;

use crate::display_list::UseItem;

const CELL_SIDE: f64 = 2048.0;
const MOST_CELLS: f64 = 256.0;

#[derive(Clone, Copy, PartialEq)]
enum Home {
    Cells([i64; 4]),
    Everywhere,
}

fn cell(v: f64) -> i64 {
    (v / CELL_SIDE).floor() as i64
}

fn span(r: Rect) -> [i64; 4] {
    [cell(r.x0), cell(r.y0), cell(r.x1), cell(r.y1)]
}

fn cells_in(r: Rect) -> f64 {
    ((r.x1 / CELL_SIDE).floor() - (r.x0 / CELL_SIDE).floor() + 1.0) * ((r.y1 / CELL_SIDE).floor() - (r.y0 / CELL_SIDE).floor() + 1.0)
}

fn home(reach: Option<Rect>) -> Home {
    match reach {
        Some(r) if r.is_finite() && cells_in(r) <= MOST_CELLS => Home::Cells(span(r)),
        _ => Home::Everywhere,
    }
}

fn keys([x0, y0, x1, y1]: [i64; 4]) -> impl Iterator<Item = (i64, i64)> {
    (x0..=x1).flat_map(move |x| (y0..=y1).map(move |y| (x, y)))
}

#[derive(Default)]
struct Grid {
    cells: FxHashMap<(i64, i64), Vec<usize>>,
    everywhere: FxHashSet<usize>,
}

impl Grid {
    fn insert(&mut self, slot: usize, home: Home) {
        match home {
            Home::Everywhere => {
                self.everywhere.insert(slot);
            }
            Home::Cells(span) => keys(span).for_each(|k| self.cells.entry(k).or_default().push(slot)),
        }
    }

    fn remove(&mut self, slot: usize, home: Home) {
        let Home::Cells(span) = home else {
            self.everywhere.remove(&slot);
            return;
        };
        for k in keys(span) {
            let Some(held) = self.cells.get_mut(&k) else { continue };
            held.retain(|&s| s != slot);
            if held.is_empty() {
                self.cells.remove(&k);
            }
        }
    }

    fn near(&self, view: Rect) -> Vec<usize> {
        let mut found: Vec<usize> = self.everywhere.iter().copied().collect();
        let [x0, y0, x1, y1] = span(view);
        if !view.is_finite() || cells_in(view) > self.cells.len() as f64 {
            let inside = |&(x, y): &(i64, i64)| x >= x0 && x <= x1 && y >= y0 && y <= y1;
            found.extend(self.cells.iter().filter(|(k, _)| inside(k)).flat_map(|(_, held)| held.iter().copied()));
            return found;
        }
        found.extend(keys([x0, y0, x1, y1]).filter_map(|k| self.cells.get(&k)).flatten().copied());
        found
    }
}

struct Placed {
    u: UseItem,
    rank: u64,
    reach: Option<Rect>,
    home: Home,
}

#[derive(Default)]
pub struct Uses {
    slots: Vec<Option<Placed>>,
    free: Vec<usize>,
    by_clip: FxHashMap<String, usize>,
    by_group: FxHashMap<String, Vec<usize>>,
    flagged: FxHashSet<usize>,
    next_rank: u64,
    grid: Grid,
    extent: Cell<Option<Option<Rect>>>,
}

fn flagged(u: &UseItem) -> bool {
    u.cache || u.hold
}

fn strictly_inside(r: Rect, of: Rect) -> bool {
    r.x0 > of.x0 && r.y0 > of.y0 && r.x1 < of.x1 && r.y1 < of.y1
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Plus {
    Nothing,
    Flagged,
}

impl Uses {
    pub fn get(&self, clip: &str) -> Option<&UseItem> {
        self.by_clip.get(clip).map(|&s| self.at(s))
    }

    fn placed(&self, slot: usize) -> &Placed {
        self.slots[slot].as_ref().expect("live slot")
    }

    fn at(&self, slot: usize) -> &UseItem {
        &self.placed(slot).u
    }

    fn stacked(&self, mut slots: Vec<usize>) -> Vec<&UseItem> {
        slots.sort_unstable_by_key(|&s| self.placed(s).rank);
        slots.dedup();
        slots.into_iter().map(|s| self.at(s)).collect()
    }

    pub fn put(&mut self, u: UseItem, reach: Option<Rect>) -> Option<UseItem> {
        match self.by_clip.get(&u.clip).copied() {
            Some(slot) => {
                let rank = self.placed(slot).rank;
                let old = self.unlink(slot);
                self.link(slot, u, rank, reach);
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
                self.link(slot, u, rank, reach);
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

    pub fn reach_group(&mut self, group: &str, reach: impl Fn(&UseItem) -> Option<Rect>) {
        for slot in self.by_group.get(group).cloned().unwrap_or_default() {
            let fresh = reach(self.at(slot));
            self.relocate(slot, fresh);
        }
    }

    fn relocate(&mut self, slot: usize, reach: Option<Rect>) {
        let was = self.placed(slot);
        let (old_home, old_reach) = (was.home, was.reach);
        self.grid.remove(slot, old_home);
        self.shrink(old_reach);
        let home = home(reach);
        self.grid.insert(slot, home);
        self.grow(reach);
        let placed = self.slots[slot].as_mut().expect("live slot");
        placed.reach = reach;
        placed.home = home;
    }

    fn link(&mut self, slot: usize, u: UseItem, rank: u64, reach: Option<Rect>) {
        self.by_group.entry(u.group.clone()).or_default().push(slot);
        if flagged(&u) {
            self.flagged.insert(slot);
        }
        let home = home(reach);
        self.grid.insert(slot, home);
        self.grow(reach);
        self.slots[slot] = Some(Placed { u, rank, reach, home });
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
        self.grid.remove(slot, placed.home);
        self.shrink(placed.reach);
        placed.u
    }

    fn grow(&self, reach: Option<Rect>) {
        let (Some(known), Some(r)) = (self.extent.get(), reach) else { return };
        self.extent.set(Some(Some(known.map_or(r, |e| e.union(r)))));
    }

    fn shrink(&self, reach: Option<Rect>) {
        if let (Some(Some(e)), Some(r)) = (self.extent.get(), reach) {
            if !strictly_inside(r, e) {
                self.extent.set(None);
            }
        }
    }

    pub fn extent(&self) -> Option<Rect> {
        if let Some(known) = self.extent.get() {
            return known;
        }
        let all = self.slots.iter().flatten().filter_map(|p| p.reach).reduce(|a, b| a.union(b));
        self.extent.set(Some(all));
        all
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

    pub fn meeting(&self, view: Option<Rect>, plus: Plus) -> Vec<&UseItem> {
        let Some(view) = view else { return self.all() };
        let meets = |s: &usize| self.placed(*s).reach.is_none_or(|r| r.overlaps(view));
        let mut found: Vec<usize> = self.grid.near(view).into_iter().filter(meets).collect();
        if plus == Plus::Flagged {
            found.extend(self.flagged.iter().copied());
        }
        self.stacked(found)
    }

    pub fn restack(&mut self, order: &[String]) -> Vec<usize> {
        let mut wanted: FxHashMap<&str, usize> = FxHashMap::default();
        for (i, clip) in order.iter().enumerate() {
            wanted.entry(clip.as_str()).or_insert(i);
        }
        let mut before: Vec<usize> = self.by_clip.values().copied().collect();
        before.sort_unstable_by_key(|&s| self.placed(s).rank);
        let mut after: Vec<(usize, usize)> = before.iter().copied().enumerate().collect();
        after.sort_by_key(|&(_, s)| wanted.get(self.at(s).clip.as_str()).copied().unwrap_or(usize::MAX));
        for (rank, &(_, slot)) in after.iter().enumerate() {
            self.slots[slot].as_mut().expect("live slot").rank = rank as u64;
        }
        self.next_rank = after.len() as u64;
        after.into_iter().map(|(was, _)| was).collect()
    }
}
