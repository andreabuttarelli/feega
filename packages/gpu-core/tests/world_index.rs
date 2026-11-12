use std::collections::HashMap;

use gpu_core::display_list::{parse, Affine, DisplayList, Item, UseItem};
use gpu_core::groups::{Library, Limits, Plan, Sweep};
use gpu_core::world::{parse_patch, Patch, World};
use vello::kurbo::{Affine as Matrix, Point, Rect};

const LIMITS: Limits = Limits { side: 4096, rasters: 2, items: 1000 };
const SEEDS: u64 = 12;
const STEPS: usize = 40;
const RECTS_PER_STEP: usize = 6;
const FRAME_W: f64 = 1280.0;
const FRAME_H: f64 = 4000.0;
const FRAME_GAP: f64 = 400.0;
const COLUMNS: usize = 40;
const TILE: u32 = 1024;
const SMALL_WORLD: usize = 10_000;
const LARGE_WORLD: usize = 100_000;
const MOST_GROWTH: f64 = 2.0;
const EDGE_SLACK_USES: usize = 2;

struct Seeded(u64);

impl Seeded {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }

    fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }

    fn within(&mut self, lo: f64, hi: f64) -> f64 {
        lo + (self.next() % 1_000_000) as f64 / 1_000_000.0 * (hi - lo)
    }
}

fn square(clip: &str, at: (f64, f64), side: f64, look: &str) -> String {
    let (x, y) = at;
    format!(r#"{{ "kind": "path", "clip": "{clip}", "contours": [[{x}, {y}, {}, {y}, {}, {}, {x}, {}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0.2, 0.4, 0.8, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0]{look} }}"#, x + side, x + side, y + side, y + side)
}

fn list(w: f64, h: f64, items: &[String]) -> DisplayList {
    parse(&format!(r#"{{ "width": {w}, "height": {h}, "background": [1, 1, 1, 1], "items": [{}] }}"#, items.join(", "))).unwrap()
}

fn plain(w: f64, h: f64) -> DisplayList {
    list(w, h, &[square("a", (0.0, 0.0), w.min(h) / 2.0, ""), square("b", (w / 2.0, h / 2.0), w.min(h) / 2.0, "")])
}

const EFFECTS: [&str; 5] = [
    r#", "blur": 40"#,
    r##", "space": [1, 0, 0, 1], "filters": [{ "kind": "css", "fns": [{ "name": "drop-shadow", "args": ["0px", "60px", "80px", "rgba(0,0,0,0.5)"] }] }]"##,
    r#", "backdrop": 24"#,
    r#", "masks": [{ "mode": "add", "invert": false, "level": 1, "feather": 30, "cover": { "kind": "path", "contours": [[0, 0, 300, 0, 300, 300, 0, 300]], "matrix": [1, 0, 0, 1, 0, 0] } }]"#,
    r#", "opacity": 0.5"#,
];

fn effected(w: f64, h: f64) -> DisplayList {
    let edge = |i: usize, look: &str| square(&format!("e{i}"), (w - 60.0, i as f64 * 120.0), 120.0, look);
    let inner = square("inside", (w - 40.0, h - 40.0), 80.0, "");
    let group = format!(r#"{{ "kind": "group", "clip": "grp", "opacity": 0.5, "matrix": [1, 0, 0, 1, 0, 0], "blur": 12, "items": [{inner}] }}"#);
    let items: Vec<String> = EFFECTS.iter().enumerate().map(|(i, look)| edge(i, look)).chain([group]).collect();
    list(w, h, &items)
}

#[derive(Clone)]
struct Kept {
    u: UseItem,
    rest: Option<Affine>,
}

#[derive(Default)]
struct Model {
    uses: Vec<Kept>,
}

impl Model {
    fn apply(&mut self, patch: &Patch) {
        for gone in &patch.drop {
            self.uses.retain(|k| &k.u.clip != gone);
        }
        for u in &patch.put {
            let rest = |old: Option<Affine>| if u.hold { old } else { Some(u.matrix) };
            match self.uses.iter_mut().find(|k| k.u.clip == u.clip) {
                Some(k) => *k = Kept { u: u.clone(), rest: rest(k.rest) },
                None => self.uses.push(Kept { u: u.clone(), rest: rest(None) }),
            }
        }
        if let Some(order) = &patch.order {
            let rank = |clip: &str| order.iter().position(|c| c == clip).unwrap_or(usize::MAX);
            self.uses.sort_by_key(|k| rank(&k.u.clip));
        }
    }

    fn scene(&self, camera: Affine, w: u32, h: u32) -> DisplayList {
        let lifted = |k: &Kept| k.u.hold && k.rest != Some(k.u.matrix);
        let items = self.uses.iter().filter(|k| !lifted(k)).map(|k| Item::Use(UseItem { matrix: times(camera, k.u.matrix), cache: false, hold: false, ..k.u.clone() }));
        DisplayList { width: w, height: h, background: None, items: items.collect(), faces: Vec::new(), fragments: Default::default() }
    }

    fn screen(&self, camera: Affine, w: u32, h: u32) -> DisplayList {
        let items = self.uses.iter().map(|k| Item::Use(UseItem { matrix: times(camera, k.u.matrix), ..k.u.clone() }));
        DisplayList { width: w, height: h, background: None, items: items.collect(), faces: Vec::new(), fragments: Default::default() }
    }
}

fn times(m: Affine, by: Affine) -> Affine {
    (Matrix::new(m) * Matrix::new(by)).as_coeffs()
}

struct Twin {
    indexed: Library,
    oracle: Library,
    sizes: HashMap<String, (f64, f64)>,
}

impl Twin {
    fn new(composes: bool) -> Self {
        let mut twin = Twin { indexed: Library::new(), oracle: Library::new(), sizes: HashMap::new() };
        if composes {
            twin.indexed.compose_encodings();
            twin.oracle.compose_encodings();
        }
        twin
    }

    fn put(&mut self, world: &mut World, key: &str, group: DisplayList) {
        world.touch(key, self.indexed.size_of(key));
        self.indexed.put_group(key, &group);
        self.oracle.put_group(key, &group);
        self.sizes.insert(key.into(), (group.width as f64, group.height as f64));
        world.touch(key, self.indexed.size_of(key));
    }

    fn drop(&mut self, world: &mut World, key: &str) {
        world.touch(key, self.indexed.size_of(key));
        self.indexed.drop_group(key);
        self.oracle.drop_group(key);
        self.sizes.remove(key);
        world.touch(key, None);
    }
}

fn same(a: &Plan, b: &Plan, what: &str) {
    assert_eq!(format!("{:?}", a.screen.items), format!("{:?}", b.screen.items), "{what}: screen items");
    assert_eq!(format!("{:?}", a.rasters.iter().map(|r| (&r.clip, &r.list.items)).collect::<Vec<_>>()), format!("{:?}", b.rasters.iter().map(|r| (&r.clip, &r.list.items)).collect::<Vec<_>>()), "{what}: rasters");
    assert_eq!((&a.evicted, a.pending, &a.finished, &a.waiting), (&b.evicted, b.pending, &b.finished, &b.waiting), "{what}: cache bookkeeping");
    assert_eq!(a.skipped, b.skipped, "{what}: skipped");
}

fn use_json(clip: &str, group: &str, at: (f64, f64), scale: f64, cache: bool, hold: bool) -> String {
    format!(r#"{{ "kind": "use", "clip": "{clip}", "group": "{group}", "matrix": [{scale}, 0, 0, {scale}, {}, {}], "cache": {cache}, "hold": {hold} }}"#, at.0, at.1)
}

fn step(rng: &mut Seeded, world: &mut World, twin: &mut Twin, model: &mut Model, groups: &[String]) {
    let clips: Vec<String> = model.uses.iter().map(|k| k.u.clip.clone()).collect();
    let roll = rng.below(10);
    let patch = match roll {
        0 if !clips.is_empty() => format!(r#"{{ "put": [], "drop": ["{}"] }}"#, clips[rng.below(clips.len())]),
        1 if clips.len() > 1 => {
            let mut order = clips.clone();
            for i in (1..order.len()).rev() {
                order.swap(i, rng.below(i + 1));
            }
            let quoted: Vec<String> = order.iter().take(order.len() - rng.below(2)).map(|c| format!("\"{c}\"")).collect();
            format!(r#"{{ "put": [], "drop": [], "order": [{}] }}"#, quoted.join(", "))
        }
        2 => {
            let key = &groups[rng.below(groups.len())];
            if rng.below(4) == 0 {
                twin.drop(world, key);
            } else {
                let (w, h) = (rng.within(50.0, 3000.0).round(), rng.within(50.0, 9000.0).round());
                let group = if rng.below(2) == 0 { effected(w, h) } else { plain(w, h) };
                twin.put(world, key, group);
            }
            return;
        }
        _ => {
            let clip = if clips.is_empty() || rng.below(3) == 0 { format!("u{}", rng.next() % 10_000) } else { clips[rng.below(clips.len())].clone() };
            let group = &groups[rng.below(groups.len())];
            let at = (rng.within(-20_000.0, 20_000.0), rng.within(-20_000.0, 20_000.0));
            let scale = [1.0, 0.5, 2.0][rng.below(3)];
            let (cache, hold) = (rng.below(4) == 0, rng.below(6) == 0);
            format!(r#"{{ "put": [{}], "drop": [] }}"#, use_json(&clip, group, at, scale, cache, hold))
        }
    };
    let patch = parse_patch(&patch).unwrap();
    let sizes = twin.sizes.clone();
    model.apply(&patch);
    world.patch(patch, |g| sizes.get(g).copied());
}

fn camera(rng: &mut Seeded) -> (Affine, u32, u32) {
    let zoom = [0.02, 0.1, 0.25, 1.0, 3.0][rng.below(5)];
    let side = [256, 512, TILE][rng.below(3)];
    let (x, y) = (rng.within(-25_000.0, 25_000.0), rng.within(-25_000.0, 25_000.0));
    ([zoom, 0.0, 0.0, zoom, -x * zoom, -y * zoom], side, side)
}

fn random_world(seed: u64, composes: bool, check: impl Fn(&World, &mut Twin, &Model, (Affine, u32, u32), String)) {
    let mut rng = Seeded(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) + 1);
    let mut world = World::new();
    let mut twin = Twin::new(composes);
    let mut model = Model::default();
    let groups: Vec<String> = (0..12).map(|i| format!("g{i}")).collect();
    for key in groups.iter().take(10) {
        let (w, h) = (rng.within(100.0, 2000.0).round(), rng.within(100.0, 8000.0).round());
        twin.put(&mut world, key, if rng.below(2) == 0 { effected(w, h) } else { plain(w, h) });
    }
    for n in 0..STEPS {
        step(&mut rng, &mut world, &mut twin, &mut model, &groups);
        for r in 0..RECTS_PER_STEP {
            check(&world, &mut twin, &model, camera(&mut rng), format!("seed {seed} step {n} rect {r}"));
        }
    }
}

#[test]
fn a_tile_plan_from_the_index_equals_the_plan_of_every_use() {
    for composes in [false, true] {
        for seed in 0..SEEDS {
            random_world(seed, composes, |world, twin, model, (camera, w, h), what| {
                let indexed = twin.indexed.plan_with(&world.scene(camera, w, h), LIMITS, Sweep::Keep);
                let oracle = twin.oracle.plan_with(&model.scene(camera, w, h), LIMITS, Sweep::Keep);
                same(&indexed, &oracle, &what);
            });
        }
    }
}

#[test]
fn a_screen_plan_from_the_index_equals_the_plan_of_every_use() {
    for seed in 0..SEEDS {
        random_world(seed, true, |world, twin, model, (camera, w, h), what| {
            let indexed = twin.indexed.plan(&world.screen(camera, w, h), LIMITS);
            let oracle = twin.oracle.plan(&model.screen(camera, w, h), LIMITS);
            same(&indexed, &oracle, &what);
        });
    }
}

fn meets(model: &Model, twin: &Twin, camera: Affine, w: u32, h: u32) -> Vec<String> {
    let view = Rect::new(0.0, 0.0, w as f64, h as f64);
    let on_screen = |k: &Kept| {
        let Some(&(gw, gh)) = twin.sizes.get(&k.u.group) else { return false };
        let t = Matrix::new(times(camera, k.u.matrix));
        let corners = [(0.0, 0.0), (gw, 0.0), (gw, gh), (0.0, gh)].map(|(x, y)| t * Point::new(x, y));
        corners.iter().fold(Rect::from_points(corners[0], corners[0]), |r, p| r.union_pt(*p)).overlaps(view)
    };
    let lifted = |k: &Kept| k.u.hold && k.rest != Some(k.u.matrix);
    model.uses.iter().filter(|k| !lifted(k) && on_screen(k)).map(|k| k.u.clip.clone()).collect()
}

fn reach_of(k: &Kept, sizes: &HashMap<String, (f64, f64)>) -> Option<Rect> {
    let &(w, h) = sizes.get(&k.u.group)?;
    let t = Matrix::new(k.u.matrix);
    let corners = [(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)].map(|(x, y)| t * Point::new(x, y));
    Some(corners.iter().fold(Rect::from_points(corners[0], corners[0]), |r, p| r.union_pt(*p)))
}

#[test]
fn the_extent_follows_every_insert_move_resize_and_remove() {
    for seed in 0..SEEDS {
        random_world(seed, false, |world, twin, model, _, what| {
            let wanted = model.uses.iter().filter_map(|k| reach_of(k, &twin.sizes)).reduce(|a, b| a.union(b));
            let got = world.extent();
            let close = |a: Rect, b: Rect| [a.x0 - b.x0, a.y0 - b.y0, a.x1 - b.x1, a.y1 - b.y1].iter().all(|d| d.abs() < 1e-6);
            assert!(match (got, wanted) { (Some(a), Some(b)) => close(a, b), (None, None) => true, _ => false }, "{what}: extent {got:?}, wanted {wanted:?}");
        });
    }
}

#[test]
fn the_index_follows_every_insert_move_resize_and_remove() {
    for seed in 0..SEEDS {
        random_world(seed, false, |world, twin, model, (camera, w, h), what| {
            let scene: Vec<String> = world.scene(camera, w, h).items.iter().map(|i| i.clip().to_string()).collect();
            let wanted = meets(model, twin, camera, w, h);
            let in_order = |all: &[String], part: &[String]| {
                let mut from = all.iter();
                part.iter().all(|c| from.any(|a| a == c))
            };
            let order: Vec<String> = model.uses.iter().map(|k| k.u.clip.clone()).collect();
            assert!(in_order(&scene, &wanted), "{what}: a use meeting the view is missing");
            assert!(in_order(&order, &scene), "{what}: the scene left the stacking order");
            let sizeless = model.uses.iter().filter(|k| !twin.sizes.contains_key(&k.u.group)).count();
            assert!(scene.len() <= wanted.len() + sizeless + EDGE_SLACK_USES, "{what}: {} visited for {} on screen", scene.len(), wanted.len());
        });
    }
}

fn grid_world(uses: usize) -> World {
    let mut world = World::new();
    let size = |_: &str| Some((FRAME_W, FRAME_H));
    let puts: Vec<String> = (0..uses).map(|i| {
        let at = ((i % COLUMNS) as f64 * (FRAME_W + FRAME_GAP), (i / COLUMNS) as f64 * (FRAME_H + FRAME_GAP));
        use_json(&format!("f{i}"), "frame", at, 1.0, false, false)
    }).collect();
    world.patch(parse_patch(&format!(r#"{{ "put": [{}], "drop": [] }}"#, puts.join(", "))).unwrap(), size);
    world
}

fn visited_by_tile(world: &World) -> usize {
    let camera = [1.0, 0.0, 0.0, 1.0, -2.0 * (FRAME_W + FRAME_GAP), -FRAME_H];
    world.take_visited();
    world.scene(camera, TILE, TILE);
    world.screen(camera, TILE, TILE);
    world.take_visited()
}

#[test]
fn a_tile_visits_as_many_uses_in_a_large_world_as_in_a_small_one() {
    let small = visited_by_tile(&grid_world(SMALL_WORLD));
    let large = visited_by_tile(&grid_world(LARGE_WORLD));

    assert!(small > 0);
    assert!(large as f64 <= small as f64 * MOST_GROWTH, "{small} uses visited at {SMALL_WORLD}, {large} at {LARGE_WORLD}");
}

#[test]
fn a_far_tile_leaves_out_a_use_whose_blur_and_shadow_stop_at_its_frame() {
    let mut world = World::new();
    let mut twin = Twin::new(true);
    let mut model = Model::default();
    twin.put(&mut world, "fx", effected(400.0, 700.0));
    let patch = parse_patch(&format!(r#"{{ "put": [{}], "drop": [] }}"#, use_json("fx", "fx", (0.0, 0.0), 1.0, false, false))).unwrap();
    model.apply(&patch);
    let sizes = twin.sizes.clone();
    world.patch(patch, |g| sizes.get(g).copied());

    let tile = |x: f64| [1.0, 0.0, 0.0, 1.0, -x, 0.0];
    assert_eq!(world.scene(tile(398.0), 256, 256).items.len(), 1);
    assert!(world.scene(tile(700.0), 256, 256).items.is_empty());
    assert!(world.scene(tile(-300.0), 256, 256).items.is_empty());

    for x in [-300.0, -2.0, 0.0, 120.0, 398.0, 400.0, 402.0, 700.0] {
        let camera = tile(x);
        let indexed = twin.indexed.plan_with(&world.scene(camera, 256, 256), LIMITS, Sweep::Keep);
        let oracle = twin.oracle.plan_with(&model.scene(camera, 256, 256), LIMITS, Sweep::Keep);
        same(&indexed, &oracle, &format!("tile at x {x}"));
    }
}
