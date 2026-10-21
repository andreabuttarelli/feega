use gpu_core::compositor::{Compositor, Painter};
use gpu_core::display_list::{parse, Item};
use gpu_core::groups::{Library, Limits, Plan};
use gpu_core::retained::{Camera, Lookup, Outcome, Quality};
use gpu_core::world::parse_patch;
use gpu_core::Skipped;
use vello::kurbo::Rect;

const FRAME: &str = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [] }"#;

#[derive(Default)]
struct Fake {
    shifts: Vec<(i32, i32)>,
    painted: Vec<(Rect, Quality, Vec<Item>)>,
    presented: Vec<Lookup>,
    tile: Option<(u32, u32)>,
}

impl Painter for Fake {
    type Error = ();

    fn limits(&self) -> Limits {
        Limits { side: 4096, rasters: 1, items: 1000 }
    }

    fn tile(&self) -> (u32, u32) {
        self.tile.unwrap_or((10_000, 10_000))
    }

    fn shift(&mut self, by: (i32, i32)) -> Result<(), ()> {
        self.shifts.push(by);
        Ok(())
    }

    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, ()> {
        self.painted.push((into, quality, plan.screen.items));
        Ok(vec![])
    }

    fn present(&mut self, look: Lookup) -> Result<(), ()> {
        self.presented.push(look);
        Ok(())
    }
}

fn left_edge(items: &[Item]) -> f64 {
    let Item::Path(back) = &items[0] else { panic!("the frame background") };
    back.contours[0][0]
}

fn width(items: &[Item]) -> f64 {
    let Item::Path(back) = &items[0] else { panic!("the frame background") };
    back.contours[0][2] - back.contours[0][0]
}

fn scene() -> (Compositor, Library) {
    scene_at(0.0)
}

fn scene_at(x: f64) -> (Compositor, Library) {
    let mut library = Library::new();
    library.put_group("g", &parse(FRAME).unwrap());
    let mut c = Compositor::new(800, 600);
    let patch = parse_patch(&r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g", "matrix": [1, 0, 0, 1, X, 0] }], "drop": [] }"#.replace('X', &x.to_string())).unwrap();
    c.patch(patch, &library);
    (c, library)
}

fn at(x: f64, y: f64, zoom: f64) -> Camera {
    Camera { x, y, zoom }
}

#[test]
fn a_pan_inside_the_overscan_only_presents_the_held_texture() {
    let (mut c, mut lib) = scene();
    let mut fake = Fake::default();
    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();

    let frame = c.frame(&mut fake, &mut lib, at(30.0, 0.0, 1.0), 16.0, &mut || 0.0).unwrap();

    assert_eq!(frame.outcome, Some(Outcome::Reused));
    assert_eq!(fake.painted.len(), 1);
    assert_eq!(fake.presented.len(), 2);
}

#[test]
fn a_pan_past_the_overscan_shifts_then_paints_the_strip_with_the_region_offset() {
    let (mut c, mut lib) = scene_at(900.0);
    let mut fake = Fake::default();
    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();

    let frame = c.frame(&mut fake, &mut lib, at(-100.0, 0.0, 1.0), 16.0, &mut || 0.0).unwrap();

    assert_eq!(frame.outcome, Some(Outcome::Partial));
    assert_eq!(fake.shifts, vec![(-175, 0)]);
    let (into, _, items) = &fake.painted[1];
    assert_eq!(*into, Rect::new(775.0, 0.0, 950.0, 750.0));
    assert_eq!(left_edge(items), 900.0 - 175.0 + 75.0 - 775.0);
}

#[test]
fn a_region_bigger_than_the_scratch_target_is_painted_in_tiles() {
    let (mut c, mut lib) = scene();
    let mut fake = Fake { tile: Some((800, 600)), ..Fake::default() };

    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();

    assert_eq!(fake.painted.len(), 4);
}

#[test]
fn a_rough_pass_paints_at_half_scale() {
    let (mut c, mut lib) = scene();
    let mut fake = Fake::default();
    let mut clock = 0.0;
    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || {
        clock += 20.0;
        clock
    })
    .unwrap();
    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 2.0), 16.0, &mut || 0.0).unwrap();

    let frame = c.frame(&mut fake, &mut lib, at(0.0, 0.0, 2.0), 300.0, &mut || 0.0).unwrap();

    let (_, quality, items) = fake.painted.last().unwrap();
    assert_eq!(*quality, Quality::Rough);
    assert_eq!(width(items), 100.0);
    assert!(frame.pending);
}

#[test]
fn an_edit_repaints_only_its_bounds() {
    let (mut c, mut lib) = scene();
    let mut fake = Fake::default();
    c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();

    c.patch(parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g", "matrix": [1, 0, 0, 1, 10, 0] }], "drop": [] }"#).unwrap(), &lib);
    let frame = c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 16.0, &mut || 0.0).unwrap();

    assert_eq!(frame.outcome, Some(Outcome::Partial));
    assert_eq!(fake.painted[1].0, Rect::new(74.0, 74.0, 186.0, 126.0));
}

const TALL: &str = r#"{ "width": 1440, "height": 2800, "background": [0, 0, 1, 1], "items": [
  { "kind": "path", "contours": [[100, 1400, 700, 1400, 700, 1500, 100, 1500]], "rule": "nonzero", "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "clip": "bar", "blur": 0, "blend": "normal" }
] }"#;

fn tall_scene() -> (Compositor, Library) {
    let mut library = Library::new();
    library.put_group("g", &parse(TALL).unwrap());
    let mut c = Compositor::new(800, 600);
    let patch = parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g", "matrix": [1, 0, 0, 1, 0, 0] }], "drop": [] }"#).unwrap();
    c.patch(patch, &library);
    (c, library)
}

fn visible_bars(fake: &Fake) -> usize {
    let (_, _, items) = fake.painted.last().unwrap();
    items.iter().filter(|i| matches!(i, Item::Path(p) if p.clip == "bar")).count()
}

#[test]
fn a_tall_frame_zoomed_in_draws_what_is_inside_the_viewport_after_the_zoom_settles() {
    for zoom in [2.0, 3.0, 4.0] {
        let (mut c, mut lib) = tall_scene();
        let mut fake = Fake::default();
        c.frame(&mut fake, &mut lib, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();
        let camera = at(-300.0 * zoom, -1400.0 * zoom, zoom);

        c.frame(&mut fake, &mut lib, camera, 16.0, &mut || 0.0).unwrap();
        c.frame(&mut fake, &mut lib, camera, 400.0, &mut || 0.0).unwrap();

        assert_eq!(visible_bars(&fake), 1, "zoom {zoom}");
    }
}

fn busy_group() -> String {
    let bars: Vec<String> = (0..2500).map(|i| format!(r#"{{ "kind": "path", "contours": [[0, {y}, 100, {y}, 100, {y2}, 0, {y2}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [1, 1, 1, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "clip": "b{i}", "blur": 0, "blend": "normal" }}"#, y = i, y2 = i + 1)).collect();
    format!(r#"{{ "width": 1440, "height": 2800, "background": [0, 0, 1, 1], "items": [{}] }}"#, bars.join(","))
}

#[test]
fn a_cached_frame_that_is_still_building_when_the_zoom_settles_ends_up_drawn() {
    let mut library = Library::new();
    library.put_group("g", &parse(&busy_group()).unwrap());
    let mut c = Compositor::new(800, 600);
    let patch = parse_patch(r#"{ "put": [{ "kind": "use", "clip": "a", "group": "g", "matrix": [1, 0, 0, 1, 0, 0], "cache": true }], "drop": [] }"#).unwrap();
    c.patch(patch, &library);
    let mut fake = Fake::default();
    c.frame(&mut fake, &mut library, at(0.0, 0.0, 1.0), 0.0, &mut || 0.0).unwrap();
    let camera = at(-200.0, -1000.0, 1.4);
    c.frame(&mut fake, &mut library, camera, 16.0, &mut || 0.0).unwrap();

    let mut now = 400.0;
    let mut drawn = false;
    for _ in 0..30 {
        let frame = c.frame(&mut fake, &mut library, camera, now, &mut || 0.0).unwrap();
        now += 16.0;
        let (_, _, items) = fake.painted.last().unwrap();
        drawn |= items.iter().any(|i| matches!(i, Item::Image(img) if img.clip.starts_with("cache:g")));
        if !frame.pending && drawn {
            break;
        }
    }

    assert!(drawn, "the finished cache was never drawn into the screen");
}
