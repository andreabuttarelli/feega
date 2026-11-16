use vello::kurbo::{Point, Rect};

use crate::display_list::{Affine, Item, Look};
use crate::groups::placed;

const UNBOUNDED: Rect = Rect::new(-1.0e7, -1.0e7, 1.0e7, 1.0e7);
const SIMILAR: f64 = 1e-6;
const KEY_DECIMALS: usize = 3;

pub struct Zoomless {
    pub key: String,
    pub item: Item,
    pub scale: f64,
    pub shift: Point,
}

fn similarity(m: Affine) -> Option<f64> {
    let [a, b, c, d, _, _] = m;
    let s = a.hypot(b);
    let similar = (a - d).abs() <= SIMILAR * s && (b + c).abs() <= SIMILAR * s;
    (similar && s > 0.0).then_some(s)
}

fn reads_behind(item: &Item) -> bool {
    match item {
        Item::Lens(_) => true,
        Item::Group(g) => g.look.backdrop.is_some() || g.items.iter().any(reads_behind),
        _ => item.look().is_some_and(|l| l.backdrop.is_some()),
    }
}

fn unscissored_look(look: &Look) -> Look {
    Look { scissor: None, ..look.clone() }
}

fn unscissored(item: &Item) -> Item {
    match item {
        Item::Path(p) => Item::Path(crate::display_list::PathItem { look: unscissored_look(&p.look), ..p.clone() }),
        Item::Image(i) => Item::Image(crate::display_list::ImageItem { look: unscissored_look(&i.look), ..i.clone() }),
        Item::Layer(l) => Item::Layer(crate::display_list::LayerItem { look: unscissored_look(&l.look), ..l.clone() }),
        Item::Group(g) => Item::Group(Box::new(crate::display_list::GroupItem { clip: g.clip.clone(), items: g.items.iter().map(unscissored).collect(), look: unscissored_look(&g.look) })),
        other => other.clone(),
    }
}

fn rounded(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut number = String::new();
    let flush = |number: &mut String, out: &mut String| {
        if number.is_empty() {
            return;
        }
        match number.parse::<f64>() {
            Ok(v) if number.contains('.') || number.contains('e') => {
                let r = format!("{:.*}", KEY_DECIMALS, v);
                out.push_str(if r.trim_start_matches('-').trim_matches(|c| c == '0' || c == '.').is_empty() { "0" } else { &r });
            }
            _ => out.push_str(number),
        }
        number.clear();
    };
    for c in text.chars() {
        let continues = c.is_ascii_digit() || c == '.' || ((c == 'e' || c == '-') && !number.is_empty()) || (c == '-' && number.is_empty());
        if continues {
            number.push(c);
            continue;
        }
        flush(&mut number, &mut out);
        out.push(c);
    }
    flush(&mut number, &mut out);
    out
}

fn moved(m: [f64; 6], item: &Item, scale: f64) -> Item {
    placed(item, m, UNBOUNDED, scale)
}

pub fn bucket(scale: f64) -> f64 {
    2f64.powf(scale.log2().ceil())
}

pub fn zoomless(item: &Item) -> Option<Zoomless> {
    if reads_behind(item) {
        return None;
    }
    let look = item.look()?;
    let s = similarity(look.matrix)?;
    let [.., tx, ty] = look.matrix;
    let held = bucket(s);
    let free = unscissored(item);
    let to_unit = [1.0 / s, 0.0, 0.0, 1.0 / s, -tx / s, -ty / s];
    let unit = moved(to_unit, &free, 1.0 / s);
    let k = held / s;
    let at_held = moved([k, 0.0, 0.0, k, -tx * k, -ty * k], &free, k);
    Some(Zoomless { key: format!("{held} {}", rounded(&format!("{unit:?}"))), item: at_held, scale: s / held, shift: Point::new(tx, ty) })
}
