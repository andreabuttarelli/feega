use gpu_core::display_list::{parse, Item};
use gpu_core::held_view::ZOOM_IN_ROOM;
use gpu_core::zoomless::{zoomless, zoomless_in, Fingerprints};

fn blurred(scale: f64, x: f64, y: f64, colour: f64) -> Item {
    let list = format!(
        r#"{{ "width": 800, "height": 600, "background": null, "items": [
      {{ "kind": "path", "clip": "card", "contours": [[0, 0, 40, 0, 40, 30, 0, 30]], "rule": "nonzero",
        "paint": {{ "kind": "solid", "color": [{colour}, 0, 0, 1] }}, "opacity": 1, "matrix": [{scale}, 0, 0, {scale}, {x}, {y}],
        "blend": "normal", "blur": {blur}, "scissor": [{x}, {y}, 800, 600] }} ] }}"#,
        blur = 4.0 * scale
    );
    parse(&list).unwrap().items.remove(0)
}

#[test]
fn a_zoom_inside_one_octave_keeps_the_same_effect_key() {
    let near = zoomless(&blurred(1.1, 13.25, 40.5, 1.0)).unwrap();
    let far = zoomless(&blurred(1.4, -310.7, 7.125, 1.0)).unwrap();

    assert_eq!(near.key, far.key);
}

#[test]
fn an_effect_is_held_fine_enough_to_zoom_in_by_its_room_without_magnifying() {
    for scale in [0.3, 0.5, 0.74, 1.0, 1.1, 1.9, 2.4] {
        let z = zoomless(&blurred(scale, 5.0, 5.0, 1.0)).unwrap();
        assert!(z.scale * ZOOM_IN_ROOM <= 1.0 + 1e-9, "drawn at {} of its texture at zoom {scale}", z.scale);
        assert!(z.scale * ZOOM_IN_ROOM > 0.5, "texture more than twice too fine at zoom {scale}");
    }
}

#[test]
fn different_content_gets_a_different_effect_key() {
    let red = zoomless(&blurred(1.2, 0.0, 0.0, 1.0)).unwrap();
    let dark = zoomless(&blurred(1.2, 0.0, 0.0, 0.5)).unwrap();

    assert_ne!(red.key, dark.key);
}

#[test]
fn another_octave_gets_another_effect_key() {
    let one = zoomless(&blurred(1.2, 0.0, 0.0, 1.0)).unwrap();
    let two = zoomless(&blurred(2.2, 0.0, 0.0, 1.0)).unwrap();

    assert_ne!(one.key, two.key);
}

#[test]
fn the_held_texture_maps_back_to_where_the_item_is_on_screen() {
    let item = blurred(1.5, 100.0, 50.0, 1.0);
    let z = zoomless(&item).unwrap();
    let Item::Path(held) = &z.item(&item) else { panic!() };

    assert_eq!(&held.look.matrix[..4], &[4.0, 0.0, 0.0, 4.0]);
    assert_eq!(held.look.blur, 16.0);
    assert_eq!((z.shift.x, z.shift.y), (100.0, 50.0));
}

#[cfg(feature = "gpu")]
fn scene(scale: f64) -> gpu_core::display_list::DisplayList {
    parse(&format!(
        r#"{{ "width": 200, "height": 160, "background": [1, 1, 1, 1], "items": [
      {{ "kind": "path", "clip": "card", "contours": [[0, 0, 40, 0, 40, 30, 0, 30]], "rule": "nonzero",
        "paint": {{ "kind": "solid", "color": [1, 0, 0, 1] }}, "opacity": 1, "matrix": [{scale}, 0, 0, {scale}, 30.5, 20.25],
        "blend": "normal", "blur": {blur} }} ] }}"#,
        blur = 4.0 * scale
    ))
    .unwrap()
}

#[cfg(feature = "gpu")]
#[test]
fn a_zoom_step_inside_an_octave_draws_the_held_effect_instead_of_a_new_one() {
    use gpu_core::layers::Effects;
    let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter").effects(Effects::Zoomless);
    let pictures = gpu_core::pictures::Pictures::default();

    renderer.render(&scene(1.1), &pictures).unwrap();
    renderer.render(&scene(1.3), &pictures).unwrap();

    assert_eq!(renderer.zoomless_layers(), 1);
}

#[cfg(feature = "gpu")]
#[test]
fn a_held_effect_draws_like_one_made_at_the_screen_scale() {
    use gpu_core::layers::Effects;
    let pictures = gpu_core::pictures::Pictures::default();
    let mut held = gpu_core::render::Renderer::new().expect("a GPU adapter").effects(Effects::Zoomless);
    let mut fresh = gpu_core::render::Renderer::new().expect("a GPU adapter");

    let a = held.render(&scene(1.3), &pictures).unwrap().pixels;
    let b = fresh.render(&scene(1.3), &pictures).unwrap().pixels;
    let mean = a.iter().zip(&b).map(|(x, y)| x.abs_diff(*y) as f64).sum::<f64>() / a.len() as f64;
    let worst = a.iter().zip(&b).map(|(x, y)| x.abs_diff(*y)).max().unwrap();

    assert!(mean < 1.0 && worst <= 24, "mean {mean} worst {worst}");
}

#[test]
fn a_fingerprint_is_hashed_once_until_the_content_changes() {
    let item = blurred(1.2, 3.0, 4.0, 1.0);
    let mut memo = Fingerprints::default();

    let first = zoomless_in(&item, &mut memo).unwrap().key;
    let again = zoomless_in(&blurred(1.3, 9.0, 1.0, 1.0), &mut memo).unwrap().key;
    assert_eq!(memo.hashed(), 1);
    assert_eq!(first, again);

    memo.forget();
    zoomless_in(&item, &mut memo).unwrap();
    assert_eq!(memo.hashed(), 2);
}
