use std::cell::RefCell;

use gpu_core::display_list::{CssFunction, Filter};
use gpu_core::filter_passes::Op;
use gpu_core::filters::{Fx, Runner};

const BLUR_OPS: [Op; 3] = [Op::Premultiply, Op::BlurPremultiplied, Op::Blur];

#[derive(Default)]
struct Recording {
    ops: RefCell<Vec<Op>>,
}

impl Runner for Recording {
    type Tex = (u32, u32);

    fn run(&self, op: Op, inputs: [&(u32, u32); 2], _: &[f32]) -> (u32, u32) {
        self.ops.borrow_mut().push(op);
        *inputs[0]
    }

    fn size(tex: &(u32, u32)) -> (u32, u32) {
        *tex
    }
}

fn shadow_ops(blur: &str) -> Vec<Op> {
    let runner = Recording::default();
    let filters = [Filter::Css { fns: vec![CssFunction { name: "drop-shadow".into(), args: vec!["0px".into(), "15px".into(), blur.into(), "rgba(0,0,0,0.08)".into()] }] }];
    Fx { runner: &runner }.apply((400, 300), &filters, [1.0, 0.0, 0.0, 1.0], [0.0, 0.0]);
    runner.ops.take()
}

#[test]
fn a_blurred_drop_shadow_costs_the_blur_and_one_pass() {
    let ops = shadow_ops("35px");

    assert_eq!(ops.iter().filter(|o| !BLUR_OPS.contains(*o)).count(), 1, "{ops:?}");
}

#[test]
fn a_sharp_drop_shadow_costs_one_pass() {
    assert_eq!(shadow_ops("0px").len(), 1);
}

fn svg_shadow(spread: bool) -> Filter {
    let grown = if spread { r#"{ "tag": "feMorphology", "attrs": { "in": "SourceAlpha", "operator": "dilate", "radius": 4, "result": "grown" }, "children": [] },"# } else { "" };
    let from = if spread { "grown" } else { "SourceAlpha" };
    let json = format!(
        r##"{{ "kind": "svg", "nodes": [{{ "tag": "filter", "attrs": {{}}, "children": [ {grown}
      {{ "tag": "feOffset", "attrs": {{ "in": "{from}", "dx": 0, "dy": 15, "result": "moved" }}, "children": [] }},
      {{ "tag": "feGaussianBlur", "attrs": {{ "in": "moved", "stdDeviation": 17.5, "result": "soft" }}, "children": [] }},
      {{ "tag": "feFlood", "attrs": {{ "flood-color": "#171717", "flood-opacity": 0.08, "result": "ink" }}, "children": [] }},
      {{ "tag": "feComposite", "attrs": {{ "in": "ink", "in2": "soft", "operator": "in", "result": "shade" }}, "children": [] }},
      {{ "tag": "feMerge", "attrs": {{}}, "children": [{{ "tag": "feMergeNode", "attrs": {{ "in": "shade" }}, "children": [] }}, {{ "tag": "feMergeNode", "attrs": {{ "in": "SourceGraphic" }}, "children": [] }}] }}
    ] }}] }}"##
    );
    serde_json::from_str(&json).unwrap()
}

fn ops_of(filter: Filter) -> Vec<Op> {
    let runner = Recording::default();
    Fx { runner: &runner }.apply((400, 300), &[filter], [1.0, 0.0, 0.0, 1.0], [0.0, 0.0]);
    runner.ops.take()
}

#[test]
fn an_svg_shadow_built_by_the_effects_costs_the_blur_and_one_pass() {
    let ops = ops_of(svg_shadow(false));

    assert_eq!(ops.iter().filter(|o| !BLUR_OPS.contains(*o)).count(), 1, "{ops:?}");
}

#[test]
fn an_svg_shadow_with_spread_adds_only_the_morphology() {
    let ops = ops_of(svg_shadow(true));

    assert_eq!(ops.iter().filter(|o| !BLUR_OPS.contains(*o) && **o != Op::Morph).count(), 1, "{ops:?}");
}

fn svg_inner_shadow() -> Filter {
    serde_json::from_str(
        r##"{ "kind": "svg", "nodes": [{ "tag": "filter", "attrs": {}, "children": [
      { "tag": "feOffset", "attrs": { "in": "SourceAlpha", "dx": 0, "dy": -2, "result": "moved" }, "children": [] },
      { "tag": "feGaussianBlur", "attrs": { "in": "moved", "stdDeviation": 2.5, "result": "soft" }, "children": [] },
      { "tag": "feComposite", "attrs": { "in": "SourceAlpha", "in2": "soft", "operator": "out", "result": "rim" }, "children": [] },
      { "tag": "feFlood", "attrs": { "flood-color": "#0a2540", "flood-opacity": 0.22, "result": "ink" }, "children": [] },
      { "tag": "feComposite", "attrs": { "in": "ink", "in2": "rim", "operator": "in", "result": "shade" }, "children": [] },
      { "tag": "feMerge", "attrs": {}, "children": [{ "tag": "feMergeNode", "attrs": { "in": "SourceGraphic" }, "children": [] }, { "tag": "feMergeNode", "attrs": { "in": "shade" }, "children": [] }] }
    ] }] }"##,
    )
    .unwrap()
}

#[test]
fn an_svg_inner_shadow_built_by_the_effects_costs_the_blur_and_one_pass() {
    let ops = ops_of(svg_inner_shadow());

    assert_eq!(ops.iter().filter(|o| !BLUR_OPS.contains(*o)).count(), 1, "{ops:?}");
}

#[test]
fn a_shadow_filter_with_its_own_region_is_still_fused() {
    let mut filter = svg_inner_shadow();
    if let Filter::Svg { nodes } = &mut filter {
        nodes[0].attrs.insert("x".into(), serde_json::json!("-50%"));
        nodes[0].attrs.insert("width".into(), serde_json::json!("200%"));
    }

    let ops = ops_of(filter);

    assert_eq!(ops.iter().filter(|o| !BLUR_OPS.contains(*o)).count(), 1, "{ops:?}");
}
