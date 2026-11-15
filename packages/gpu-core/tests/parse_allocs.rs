use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use gpu_core::world::parse_overlay;

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

const ITEMS: usize = 200;
const MAX_ALLOCS_PER_ITEM: usize = 20;
const PATH: &str = r#"{"kind":"path","clip":"edge","contours":[[0,0,10,0,10,10,0,10],[2,2,3,3]],"rule":"nonzero","paint":{"kind":"solid","color":[0.2,0.4,0.6,1]},"opacity":1,"matrix":[1,0,0,1,12.5,40.25]}"#;
const UNKNOWN: &str = r#"[{"kind":"sparkle","clip":"s","stars":[1,2,3]}]"#;

#[test]
fn an_overlay_item_parses_without_a_json_tree_in_between() {
    let json = format!("[{}]", vec![PATH; ITEMS].join(","));

    let before = ALLOCS.get();
    let items = parse_overlay(&json).unwrap();
    let allocs = ALLOCS.get() - before;

    assert_eq!(items.len(), ITEMS);
    assert!(allocs <= ITEMS * MAX_ALLOCS_PER_ITEM, "{} allocations per item", allocs / ITEMS);
}

#[test]
fn an_unknown_kind_keeps_its_clip_and_kind() {
    let items = parse_overlay(UNKNOWN).unwrap();

    assert_eq!((items[0].clip(), items[0].kind()), ("s", "sparkle"));
}
