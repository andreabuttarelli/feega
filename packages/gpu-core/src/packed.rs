use std::cell::RefCell;
use std::fmt;

use serde::de::{self, Deserializer, SeqAccess, Visitor};

#[derive(Default)]
struct Pack {
    floats: Vec<f64>,
    ends: Vec<u32>,
}

thread_local! {
    static PACK: RefCell<Pack> = RefCell::new(Pack::default());
}

pub fn within<T>(floats: Vec<f64>, ends: Vec<u32>, read: impl FnOnce() -> T) -> T {
    PACK.with(|pack| *pack.borrow_mut() = Pack { floats, ends });
    let out = read();
    PACK.with(|pack| *pack.borrow_mut() = Pack::default());
    out
}

fn packed_contour(index: usize) -> Option<Vec<f64>> {
    PACK.with(|pack| {
        let pack = pack.borrow();
        let end = *pack.ends.get(index)? as usize;
        let start = if index == 0 { 0 } else { pack.ends[index - 1] as usize };
        pack.floats.get(start..end).map(<[f64]>::to_vec)
    })
}

enum Contour {
    Inline(Vec<f64>),
    Packed(usize),
}

impl<'de> de::Deserialize<'de> for Contour {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct ContourVisitor;

        impl<'de> Visitor<'de> for ContourVisitor {
            type Value = Contour;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a contour: an array of numbers, or the index of a packed one")
            }

            fn visit_u64<E: de::Error>(self, index: u64) -> Result<Contour, E> {
                Ok(Contour::Packed(index as usize))
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Contour, A::Error> {
                let mut points = Vec::with_capacity(seq.size_hint().unwrap_or(0));
                while let Some(n) = seq.next_element::<f64>()? {
                    points.push(n);
                }
                Ok(Contour::Inline(points))
            }
        }

        d.deserialize_any(ContourVisitor)
    }
}

pub fn contours<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<Vec<f64>>, D::Error> {
    let read: Vec<Contour> = de::Deserialize::deserialize(d)?;
    read.into_iter()
        .map(|contour| match contour {
            Contour::Inline(points) => Ok(points),
            Contour::Packed(index) => packed_contour(index).ok_or_else(|| de::Error::custom(format!("no packed contour {index}"))),
        })
        .collect()
}
