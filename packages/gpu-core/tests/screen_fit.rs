use gpu_core::screen_fit::{fit, screen_side, screen_targets};

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
