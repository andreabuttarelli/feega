use std::cell::RefCell;
use std::collections::HashSet;

use gpu_core::gl_state::{isolated, Switches};

const BLEND: u32 = 0x0BE2;
const SCISSOR_TEST: u32 = 0x0C11;
const DEPTH_TEST: u32 = 0x0B71;

#[derive(Default)]
struct Context {
    on: RefCell<HashSet<u32>>,
}

impl Switches for Context {
    fn is_on(&self, cap: u32) -> bool {
        self.on.borrow().contains(&cap)
    }

    fn set(&self, cap: u32, on: bool) {
        let mut caps = self.on.borrow_mut();
        if on {
            caps.insert(cap);
        } else {
            caps.remove(&cap);
        }
    }
}

#[test]
fn a_pass_hands_blending_back_on_or_the_next_vello_raster_punches_holes_around_glyphs() {
    let gl = Context::default();
    gl.set(BLEND, true);

    isolated(&gl, &[BLEND, SCISSOR_TEST, DEPTH_TEST], || {
        assert!(!gl.is_on(BLEND));
        gl.set(SCISSOR_TEST, true);
    });

    assert!(gl.is_on(BLEND));
    assert!(!gl.is_on(SCISSOR_TEST));
}

#[test]
fn a_pass_leaves_off_what_it_found_off() {
    let gl = Context::default();

    isolated(&gl, &[BLEND, DEPTH_TEST], || gl.set(DEPTH_TEST, true));

    assert!(!gl.is_on(BLEND));
    assert!(!gl.is_on(DEPTH_TEST));
}
