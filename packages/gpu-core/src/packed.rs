use std::cell::RefCell;
use std::fmt;

use serde::de::{self, Deserializer, SeqAccess, Visitor};

#[derive(Default)]
struct Pack {
    floats: Vec<f64>,
    ends: Vec<u32>,
    base: usize,
    read: usize,
}

thread_local! {
    static PACK: RefCell<Pack> = RefCell::new(Pack::default());
}

pub fn within<T>(floats: Vec<f64>, ends: Vec<u32>, read: impl FnOnce() -> T) -> T {
    PACK.with(|pack| *pack.borrow_mut() = Pack { floats, ends, base: 0, read: 0 });
    let out = read();
    PACK.with(|pack| *pack.borrow_mut() = Pack::default());
    out
}

fn packed_contour(local: usize) -> Option<Vec<f64>> {
    PACK.with(|pack| {
        let mut pack = pack.borrow_mut();
        pack.read += 1;
        let index = pack.base + local;
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

fn item_done() {
    PACK.with(|pack| {
        let mut pack = pack.borrow_mut();
        pack.base += pack.read;
        pack.read = 0;
    });
}

pub fn items<'de, D: Deserializer<'de>, T: de::Deserialize<'de>>(d: D) -> Result<Vec<T>, D::Error> {
    struct ItemsVisitor<T>(std::marker::PhantomData<T>);

    impl<'de, T: de::Deserialize<'de>> Visitor<'de> for ItemsVisitor<T> {
        type Value = Vec<T>;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a list of items")
        }

        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<T>, A::Error> {
            let mut out = Vec::with_capacity(seq.size_hint().unwrap_or(0));
            while let Some(item) = seq.next_element::<T>()? {
                out.push(item);
                item_done();
            }
            Ok(out)
        }
    }

    d.deserialize_seq(ItemsVisitor(std::marker::PhantomData))
}
