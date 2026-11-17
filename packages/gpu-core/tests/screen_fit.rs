use gpu_core::display_list::{parse, DisplayList, Item, PathItem};
use gpu_core::groups::{Library, Limits};
use gpu_core::screen_fit::{fit, fitted_list, screen_side, screen_targets};

const TALL: &str = r#"{
  "width": 400, "height": 5000, "background": [1, 1, 1, 1],
  "items": [
    { "kind": "path", "clip": "footer", "contours": [[0, 4900, 400, 4900, 400, 5000, 0, 5000]], "rule": "nonzero",
      "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blur": 10, "blend": "normal" }
  ]
}"#;
const DEVICE_SIDE: u32 = 1000;

fn footer(list: &DisplayList) -> PathItem {
    list.items.iter().find_map(|i| match i {
        Item::Path(p) if p.clip == "footer" => Some(p.clone()),
        _ => None,
    }).expect("the footer path")
}

#[test]
fn a_frame_taller_than_the_device_draws_whole_and_scaled() {
    let list = parse(TALL).unwrap();
    let fitted = fit((list.width, list.height), DEVICE_SIDE);
    let mut library = Library::new();

    let screen = fitted_list(&mut library, list, fitted);
    let planned = library.plan(&screen, Limits { side: DEVICE_SIDE, rasters: 1, items: 16 }).screen;
    let path = footer(&planned);

    assert_eq!((planned.width, planned.height), (80, DEVICE_SIDE));
    assert_eq!(planned.background, Some([1.0, 1.0, 1.0, 1.0]));
    assert!((path.look.matrix[3] - 0.2).abs() < 1e-9, "{:?}", path.look.matrix);
    assert!((path.look.blur - 2.0).abs() < 1e-9, "{}", path.look.blur);
}

#[test]
fn a_frame_that_fits_is_drawn_as_written() {
    let list = parse(TALL).unwrap();
    let mut library = Library::new();

    let screen = fitted_list(&mut library, list.clone(), fit((list.width, list.height), 8192));

    assert_eq!((screen.width, screen.height), (list.width, list.height));
    assert_eq!(screen.items, list.items);
}

const WEBGL_ATLAS: u32 = 4096;
const WEBGPU_DEFAULT: u32 = 8192;
const VIEWPORTS: [(u32, u32); 2] = [(2200 * 2, 1100 * 2), (3840 * 2, 2160 * 2)];

#[test]
fn no_render_target_outgrows_the_device_on_a_wide_screen() {
    for limit in [WEBGL_ATLAS, WEBGPU_DEFAULT] {
        for viewport in VIEWPORTS {
            let fitted = fit(viewport, screen_side(limit));
            for (w, h) in screen_targets(fitted.size) {
                assert!(w <= limit && h <= limit, "{w}x{h} over {limit} for {viewport:?}");
            }
        }
    }
}

#[test]
fn a_screen_that_fits_is_kept_sharp() {
    let fitted = fit((2880, 1800), screen_side(WEBGPU_DEFAULT));

    assert_eq!(fitted.size, (2880, 1800));
    assert_eq!(fitted.scale, 1.0);
}

#[test]
fn a_capped_screen_keeps_its_aspect() {
    let fitted = fit((4400, 2200), 4000);

    assert_eq!(fitted.size, (4000, 2000));
    assert!((fitted.scale - 4000.0 / 4400.0).abs() < 1e-9);
}
