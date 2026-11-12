use gpu_core::tiles::Refresh;

fn fed(every_ms: f64, frames: usize) -> Refresh {
    let mut r = Refresh::default();
    (0..frames).for_each(|i| r.observe(i as f64 * every_ms));
    r
}

#[test]
fn a_60_hz_display_keeps_the_budgets_the_engine_was_tuned_for() {
    let r = fed(1000.0 / 60.0, 20);
    assert!((r.still_ms() - 12.0).abs() < 0.1);
    assert!((r.gesture_ms() - 4.0).abs() < 0.1);
}

#[test]
fn a_120_hz_display_gets_budgets_that_fit_its_8_ms_frame() {
    let r = fed(1000.0 / 120.0, 20);
    assert!(r.still_ms() < 6.1, "still {}", r.still_ms());
    assert!(r.gesture_ms() < 2.1, "gesture {}", r.gesture_ms());
}

#[test]
fn an_idle_pause_between_frames_is_not_read_as_a_slow_display() {
    let mut r = fed(1000.0 / 120.0, 20);
    r.observe(5000.0);
    assert!(r.still_ms() < 6.1);
}

#[test]
fn before_any_frame_the_budgets_are_the_60_hz_ones() {
    assert!((Refresh::default().still_ms() - 12.0).abs() < 0.1);
}
