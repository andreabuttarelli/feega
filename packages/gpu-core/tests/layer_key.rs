use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use gpu_core::display_list::{parse, Item};
use gpu_core::layer_key::layer_key;

struct Counting;

thread_local! {
    static ALLOCS: Cell<usize> = const { Cell::new(0) };
}

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.set(ALLOCS.get() + 1);
        System.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout)
    }
}

#[global_allocator]
static COUNTING: Counting = Counting;

const SIZE: (u32, u32) = (512, 512);
const POINTS: usize = 1000;

fn blurred(red: f32) -> Item {
    let contour: Vec<String> = (0..POINTS).map(|i| format!("{}.25,{}.5", i, i * 2)).collect();
    let json = format!(
        r#"{{ "width": 512, "height": 512, "background": null, "items": [
      {{ "kind": "path", "clip": "p", "contours": [[{}]], "rule": "nonzero",
        "paint": {{ "kind": "solid", "color": [{red}, 0, 0, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 4 }}] }}"#,
        contour.join(",")
    );
    parse(&json).unwrap().items.remove(0)
}

#[test]
fn a_layer_key_does_not_build_a_string_as_long_as_the_item() {
    let item = blurred(1.0);

    let before = ALLOCS.get();
    let _ = layer_key(SIZE, &item);

    assert_eq!(ALLOCS.get() - before, 0);
}

#[test]
fn a_layer_key_tells_items_and_sizes_apart() {
    let (red, dim) = (blurred(1.0), blurred(0.5));

    assert_eq!(layer_key(SIZE, &red), layer_key(SIZE, &blurred(1.0)));
    assert_ne!(layer_key(SIZE, &red), layer_key(SIZE, &dim));
    assert_ne!(layer_key(SIZE, &red), layer_key((256, 512), &red));
}
