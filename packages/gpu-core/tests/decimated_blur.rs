use std::cell::RefCell;

use gpu_core::display_list::{CssFunction, Filter};
use gpu_core::filter_passes::Op;
use gpu_core::filters::{Fx, Runner};

type Size = (u32, u32);

#[derive(Default)]
struct Recording {
    passes: RefCell<Vec<(Op, Size, usize)>>,
}

impl Runner for Recording {
    type Tex = Size;

    fn run(&self, op: Op, _: [&Size; 2], params: &[f32], size: Size) -> Size {
        self.passes.borrow_mut().push((op, size, params.len()));
        size
    }

    fn size(tex: &Size) -> Size {
        *tex
    }
}

const MAX_BLUR_PARAMS: usize = 3 + 2 * 7;

fn blurred(sigma: f64) -> Vec<(Op, Size, usize)> {
    let runner = Recording::default();
    let filters = [Filter::Css { fns: vec![CssFunction { name: "blur".into(), args: vec![format!("{sigma}px")] }] }];
    Fx { runner: &runner }.apply((400, 300), &filters, [1.0, 0.0, 0.0, 1.0], [0.0, 0.0]);
    runner.passes.take()
}

fn blurs(passes: &[(Op, Size, usize)]) -> Vec<&(Op, Size, usize)> {
    passes.iter().filter(|(op, ..)| matches!(op, Op::Blur | Op::BlurPremultiplied)).collect()
}

#[test]
fn a_wide_blur_runs_on_a_smaller_image() {
    let passes = blurred(16.0);

    assert!(passes.iter().any(|(op, ..)| *op == Op::Down), "{passes:?}");
    assert!(blurs(&passes).iter().all(|(_, size, _)| size.0 <= 100 && size.1 <= 75), "{passes:?}");
}

#[test]
fn a_wide_blur_keeps_its_kernel_short() {
    let passes = blurred(40.0);

    assert!(blurs(&passes).iter().all(|(.., params)| *params <= MAX_BLUR_PARAMS), "{passes:?}");
}

#[test]
fn a_wide_blur_comes_back_at_full_size() {
    let passes = blurred(16.0);

    assert_eq!(passes.last().map(|(op, size, _)| (*op, *size)), Some((Op::Up, (400, 300))));
}

#[test]
fn a_narrow_blur_stays_at_full_size() {
    let passes = blurred(1.5);

    assert!(passes.iter().all(|(_, size, _)| *size == (400, 300)), "{passes:?}");
}
