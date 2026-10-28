use gpu_core::display_list::{parse, DisplayList};
use gpu_core::groups::{Library, Limits, Motion};

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 48 };
const SCREEN: (u32, u32) = (1170, 2532);
const FRAME: (u32, u32) = (1440, 4480);
const VIEWS: usize = 3;
const BURSTS: usize = 6;
const STEPS: usize = 40;
const FRAME_MS: f64 = 16.0;
const GESTURE_RASTER_EVERY_MS: f64 = 80.0;
const PHONE_BUDGET: u64 = 128 * 1024 * 1024;
const MB: f64 = 1024.0 * 1024.0;

fn group() -> DisplayList {
    let items: Vec<String> = (0..200)
        .map(|i| {
            let (x, y) = ((i % 10) as f64 * 140.0, (i / 10) as f64 * 220.0);
            format!(r#"{{ "kind": "path", "clip": "p{i}", "contours": [[{x}, {y}, {}, {y}, {}, {}, {x}, {}]], "rule": "nonzero", "paint": {{ "kind": "solid", "color": [0.2, 0.4, 0.8, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }}"#, x + 120.0, x + 120.0, y + 200.0, y + 200.0)
        })
        .collect();
    parse(&format!(r#"{{ "width": {}, "height": {}, "background": [1, 1, 1, 1], "items": [{}] }}"#, FRAME.0, FRAME.1, items.join(","))).unwrap()
}

fn screen(zoom: f64) -> DisplayList {
    let uses: Vec<String> = (0..VIEWS)
        .map(|g| {
            let x = g as f64 * (FRAME.0 as f64 + 200.0) * zoom;
            format!(r#"{{ "kind": "use", "clip": "g{g}", "group": "g{g}", "matrix": [{zoom}, 0, 0, {zoom}, {x}, 0], "cache": true }}"#)
        })
        .collect();
    parse(&format!(r#"{{ "width": {}, "height": {}, "background": null, "items": [{}] }}"#, SCREEN.0, SCREEN.1, uses.join(","))).unwrap()
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Before,
    After,
}

fn run(mode: Mode) -> (usize, f64, f64) {
    let mut lib = Library::new();
    for g in 0..VIEWS {
        lib.put_group(&format!("g{g}"), &group());
    }
    if mode == Mode::After {
        lib.set_budget(PHONE_BUDGET);
    }
    lib.plan(&screen(0.3), LIMITS);
    let (mut rasters, mut allocated, mut peak, mut now, mut rastered_at) = (0, 0u64, 0u64, 0.0, f64::NEG_INFINITY);
    for _ in 0..BURSTS {
        for i in 0..=2 * STEPS {
            let t = if i <= STEPS { i } else { 2 * STEPS - i } as f64 / STEPS as f64;
            let zoom = 0.3 * 4f64.powf(t);
            let mut limits = LIMITS;
            if mode == Mode::After {
                lib.set_motion(Motion::Gesture);
                if !lib.is_building() && now - rastered_at < GESTURE_RASTER_EVERY_MS {
                    limits.rasters = 0;
                }
            }
            let plan = lib.plan(&screen(zoom), limits);
            if !plan.rasters.is_empty() {
                rastered_at = now;
            }
            rasters += plan.rasters.len();
            allocated += plan.rasters.iter().map(|r| r.list.width as u64 * r.list.height as u64 * 4).sum::<u64>();
            peak = peak.max(lib.cache_bytes());
            now += FRAME_MS;
        }
    }
    (rasters, allocated as f64 / MB, peak as f64 / MB)
}

fn main() {
    for (name, mode) in [("before", Mode::Before), ("after", Mode::After)] {
        let (rasters, allocated, peak) = run(mode);
        println!("{name}: rasters={rasters} allocatedMb={allocated:.0} peakHeldMb={peak:.0}");
    }
}
