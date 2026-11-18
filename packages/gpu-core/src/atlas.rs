struct Row {
    y: u32,
    height: u32,
    x: u32,
}

pub struct Packer {
    side: u32,
    rows: Vec<Row>,
    bottom: u32,
}

impl Packer {
    pub fn new(side: u32) -> Self {
        Packer { side, rows: Vec::new(), bottom: 0 }
    }

    pub fn fit(&mut self, width: u32, height: u32) -> Option<(u32, u32)> {
        if width > self.side || height > self.side {
            return None;
        }
        let side = self.side;
        let found = self.rows.iter_mut().filter(|r| r.height >= height && r.x + width <= side).min_by_key(|r| r.height);
        if let Some(row) = found {
            let at = (row.x, row.y);
            row.x += width;
            return Some(at);
        }
        if self.bottom + height > side {
            return None;
        }
        let at = (0, self.bottom);
        self.rows.push(Row { y: self.bottom, height, x: width });
        self.bottom += height;
        Some(at)
    }
}

#[cfg(test)]
mod tests {
    use super::Packer;

    #[test]
    fn cells_never_overlap_and_stay_inside_the_sheet() {
        let mut packer = Packer::new(64);
        let sizes = [(30, 10), (30, 8), (10, 20), (64, 5), (5, 5), (20, 10)];
        let cells: Vec<(u32, u32, u32, u32)> = sizes.iter().filter_map(|&(w, h)| packer.fit(w, h).map(|(x, y)| (x, y, w, h))).collect();

        assert_eq!(cells.len(), sizes.len());
        for (i, a) in cells.iter().enumerate() {
            assert!(a.0 + a.2 <= 64 && a.1 + a.3 <= 64);
            for b in &cells[i + 1..] {
                let apart = a.0 + a.2 <= b.0 || b.0 + b.2 <= a.0 || a.1 + a.3 <= b.1 || b.1 + b.3 <= a.1;
                assert!(apart, "{a:?} overlaps {b:?}");
            }
        }
    }

    #[test]
    fn a_full_sheet_refuses_the_next_cell() {
        let mut packer = Packer::new(16);

        assert!(packer.fit(16, 16).is_some());
        assert!(packer.fit(1, 1).is_none());
        assert!(packer.fit(17, 1).is_none());
    }
}
