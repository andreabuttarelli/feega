use gpu_core::kernel::{gaussian, MAX_TAPS};

fn total(sigma: f64) -> f32 {
    let taps = gaussian(sigma);
    taps[0].weight + 2.0 * taps[1..].iter().map(|t| t.weight).sum::<f32>()
}

#[test]
fn merged_taps_halve_the_fetches() {
    assert_eq!(gaussian(17.5).len(), 28);
}

#[test]
fn the_weights_sum_to_one() {
    for sigma in [0.5, 2.0, 17.5, 60.0] {
        assert!((total(sigma) - 1.0).abs() < 1e-5, "{sigma}");
    }
}

#[test]
fn a_pair_lands_at_its_weighted_offset() {
    let sigma = 4.0f64;
    let w = |i: f64| (-i * i / (2.0 * sigma * sigma)).exp();

    assert!((gaussian(sigma)[1].offset as f64 - (w(1.0) + 2.0 * w(2.0)) / (w(1.0) + w(2.0))).abs() < 1e-5);
}

#[test]
fn a_wide_blur_stays_inside_the_tap_budget() {
    assert!(gaussian(200.0).len() <= MAX_TAPS);
}
