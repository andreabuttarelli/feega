use std::cell::RefCell;

use gpu_core::display_list::{CssFunction, Filter};
use gpu_core::filter_passes::Op;
use gpu_core::filters::{reach, Fx, Runner};

#[derive(Default)]
struct Recording {
    ops: RefCell<Vec<Op>>,
}

impl Runner for Recording {
    type Tex = (u32, u32);

    fn run(&self, op: Op, inputs: [&(u32, u32); 2], _: &[f32], _: (u32, u32)) -> (u32, u32) {
        self.ops.borrow_mut().push(op);
        *inputs[0]
    }

    fn size(tex: &(u32, u32)) -> (u32, u32) {
        *tex
    }
}

const FIT: f64 = 0.05;
const CLOSE: f64 = 1.0;

fn at(zoom: f64) -> [f64; 4] {
    [zoom, 0.0, 0.0, zoom]
}

fn drop_shadow() -> Filter {
    Filter::Css { fns: vec![CssFunction { name: "drop-shadow".into(), args: vec!["0px".into(), "15px".into(), "35px".into(), "rgba(0,0,0,0.08)".into()] }] }
}

fn effect(inner: bool) -> Filter {
    let nodes = if inner {
        r##"
      { "tag": "feOffset", "attrs": { "in": "SourceAlpha", "dx": 0, "dy": 4, "result": "moved" }, "children": [] },
      { "tag": "feGaussianBlur", "attrs": { "in": "moved", "stdDeviation": 6, "result": "soft" }, "children": [] },
      { "tag": "feComposite", "attrs": { "in": "SourceAlpha", "in2": "soft", "operator": "out", "result": "rim" }, "children": [] },
      { "tag": "feFlood", "attrs": { "flood-color": "#000", "flood-opacity": 0.2, "result": "ink" }, "children": [] },
      { "tag": "feComposite", "attrs": { "in": "ink", "in2": "rim", "operator": "in", "result": "shade" }, "children": [] },
      { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "shade" }, "children": [] }] }"##
    } else {
        r##"
      { "tag": "feOffset", "attrs": { "in": "SourceAlpha", "dx": 0, "dy": 15, "result": "moved" }, "children": [] },
      { "tag": "feGaussianBlur", "attrs": { "in": "moved", "stdDeviation": 17.5, "result": "soft" }, "children": [] },
      { "tag": "feFlood", "attrs": { "flood-color": "#171717", "flood-opacity": 0.08, "result": "ink" }, "children": [] },
      { "tag": "feComposite", "attrs": { "in": "ink", "in2": "soft", "operator": "in", "result": "shade" }, "children": [] },
      { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "shade" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }] }"##
    };
    serde_json::from_str(&format!(r#"{{ "kind": "svg", "nodes": [{{ "tag": "filter", "attrs": {{}}, "children": [{nodes}] }}] }}"#)).unwrap()
}

fn ops(filter: Filter, zoom: f64) -> Vec<Op> {
    let runner = Recording::default();
    Fx { runner: &runner }.apply((400, 300), &[filter], at(zoom), [0.0, 0.0]);
    runner.ops.take()
}

#[test]
fn a_drop_shadow_under_two_device_pixels_costs_nothing() {
    assert_eq!(ops(drop_shadow(), FIT), vec![]);
}

#[test]
fn an_effect_shadow_under_two_device_pixels_costs_nothing() {
    assert_eq!(ops(effect(false), FIT), vec![]);
}

#[test]
fn an_inner_shadow_under_two_device_pixels_costs_nothing() {
    assert_eq!(ops(effect(true), FIT), vec![]);
}

#[test]
fn a_visible_shadow_still_runs() {
    assert!(!ops(drop_shadow(), CLOSE).is_empty());
    assert!(!ops(effect(false), CLOSE).is_empty());
}

#[test]
fn a_dropped_shadow_reaches_nowhere() {
    let r = reach(&[drop_shadow()], at(FIT)).unwrap();

    assert_eq!(r.px, 0.0);
}

#[test]
fn a_dropped_effect_shadow_reaches_nowhere() {
    let r = reach(&[effect(false)], at(FIT)).unwrap();

    assert_eq!(r.share, 0.0);
}
