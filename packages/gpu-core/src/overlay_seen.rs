use crate::world::OverlayPart;

#[derive(Default)]
pub struct OverlaySeen([Vec<u8>; 3]);

impl OverlaySeen {
    pub fn forget(&mut self, part: OverlayPart) {
        self.0[part as usize].clear();
    }

    pub fn is_new(&mut self, part: OverlayPart, payload: &[u8]) -> bool {
        let last = &mut self.0[part as usize];
        if last.as_slice() == payload {
            return false;
        }

        last.clear();
        last.extend_from_slice(payload);
        true
    }
}
