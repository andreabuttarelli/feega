use std::fmt::Write;
use std::hash::{DefaultHasher, Hasher};

use crate::display_list::Item;

struct Feed(DefaultHasher);

impl Write for Feed {
    fn write_str(&mut self, s: &str) -> std::fmt::Result {
        self.0.write(s.as_bytes());
        Ok(())
    }
}

fn own_key(item: &Item, children: &[u64]) -> u64 {
    let mut feed = Feed(DefaultHasher::new());
    let _ = match item {
        Item::Group(g) => write!(feed, "group {:?} {:?} {children:?}", g.clip, g.look),
        other => write!(feed, "{other:?}"),
    };
    feed.0.finish()
}

pub fn stamp(items: &mut [Item]) {
    for item in items {
        let children = match item {
            Item::Group(g) => {
                stamp(&mut g.items);
                g.items.iter().filter_map(|i| i.look().and_then(|l| l.key)).collect()
            }
            _ => Vec::new(),
        };
        let key = own_key(item, &children);
        match item {
            Item::Path(p) => p.look.key = Some(key),
            Item::Image(i) => i.look.key = Some(key),
            Item::Layer(l) => l.look.key = Some(key),
            Item::Group(g) => g.look.key = Some(key),
            Item::Use(_) | Item::Glyphs(_) | Item::Text(_) | Item::Lens(_) | Item::Other { .. } => {}
        }
    }
}
