use crate::world::OverlayPart;

#[derive(Default)]
pub struct OverlaySeen([Vec<u8>; 4]);

impl OverlaySeen {
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
