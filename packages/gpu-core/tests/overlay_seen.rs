use gpu_core::overlay_seen::OverlaySeen;
use gpu_core::world::OverlayPart;

#[test]
fn the_same_payload_for_a_part_is_not_new_twice() {
    let mut seen = OverlaySeen::default();

    assert!(seen.is_new(OverlayPart::Live, b"[1]"));
    assert!(!seen.is_new(OverlayPart::Live, b"[1]"));
}

#[test]
fn a_changed_payload_is_new_again() {
    let mut seen = OverlaySeen::default();
    seen.is_new(OverlayPart::Live, b"[1]");

    assert!(seen.is_new(OverlayPart::Live, b"[2]"));
    assert!(seen.is_new(OverlayPart::Live, b"[1]"));
}

#[test]
fn parts_do_not_share_a_memory() {
    let mut seen = OverlaySeen::default();
    seen.is_new(OverlayPart::Live, b"[1]");

    assert!(seen.is_new(OverlayPart::Selected, b"[1]"));
}

#[test]
fn a_forgotten_part_takes_its_last_payload_again() {
    let mut seen = OverlaySeen::default();
    seen.is_new(OverlayPart::Fixed, b"[1]");

    seen.forget(OverlayPart::Fixed);

    assert!(seen.is_new(OverlayPart::Fixed, b"[1]"));
}
