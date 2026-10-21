use gpu_core::display_list::{parse, DisplayList, Item};
use gpu_core::groups::{Library, Limits};

const FRAME: &str = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [
  { "kind": "path", "clip": "card", "contours": [[10, 10, 20, 10, 20, 20, 10, 20]], "rule": "nonzero",
    "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#;

const LIMITS: Limits = Limits { side: 4096, rasters: 1, items: 1000 };
const ONE_ITEM: Limits = Limits { side: 4096, rasters: 1, items: 1 };

fn screen(uses: &[(&str, f64, f64)]) -> DisplayList {
    let items: Vec<String> = uses.iter().map(|(g, s, x)| format!(r#"{{ "kind": "use", "clip": "{g}", "group": "{g}", "matrix": [{s}, 0, 0, {s}, {x}, 0.4], "cache": true }}"#)).collect();
    parse(&format!(r#"{{ "width": 800, "height": 600, "background": null, "items": [{}] }}"#, items.join(","))).unwrap()
}

fn library(groups: &[&str]) -> Library {
    let mut library = Library::new();
    for g in groups {
        library.put_group(g, &parse(FRAME).unwrap());
    }
    library
}

fn kinds(list: &DisplayList) -> Vec<&str> {
    list.items.iter().map(|i| i.kind()).collect()
}

#[test]
fn a_cached_use_is_rastered_once_at_its_device_scale_then_drawn_as_one_image() {
    let mut lib = library(&["a"]);

    let first = lib.plan(&screen(&[("a", 2.0, 10.0)]), LIMITS);
    assert_eq!(first.rasters.len(), 1);
    assert_eq!((first.rasters[0].list.width, first.rasters[0].list.height), (200, 100));
    assert_eq!(kinds(&first.screen), vec!["image"]);

    let panned = lib.plan(&screen(&[("a", 2.0, 70.0)]), LIMITS);
    assert!(panned.rasters.is_empty());
    let Item::Image(image) = &panned.screen.items[0] else { panic!() };
    assert_eq!(image.look.matrix, [1.0, 0.0, 0.0, 1.0, 70.0, 0.0]);
    assert_eq!(image.clip, first.rasters[0].clip);
    assert_eq!(lib.cache_bytes(), 200 * 100 * 4);
}

#[test]
fn a_zoom_past_the_threshold_draws_the_stale_texture_scaled_while_it_re_rasters() {
    let mut lib = library(&["a", "b"]);
    lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);
    lib.plan(&screen(&[("a", 1.0, 0.0), ("b", 1.0, 200.0)]), LIMITS);

    let zoomed = lib.plan(&screen(&[("a", 1.5, 0.0), ("b", 1.5, 300.0)]), LIMITS);

    assert_eq!(zoomed.rasters.len(), 1);
    assert_eq!(kinds(&zoomed.screen), vec!["image", "image"]);
    let Item::Image(stale) = &zoomed.screen.items[1] else { panic!() };
    assert_eq!(stale.look.matrix[0], 1.5);
    assert!(zoomed.pending);

    let next = lib.plan(&screen(&[("a", 1.5, 0.0), ("b", 1.5, 300.0)]), LIMITS);
    assert_eq!(next.rasters.len(), 1);
    assert!(!next.pending);
}

fn held(group: &str, sx: f64, sy: f64) -> DisplayList {
    parse(&format!(r#"{{ "width": 800, "height": 600, "background": null, "items": [{{ "kind": "use", "clip": "{group}", "group": "{group}", "matrix": [{sx}, 0, 0, {sy}, 0, 0], "cache": true, "hold": true }}] }}"#)).unwrap()
}

#[test]
fn a_node_being_resized_stretches_its_texture_instead_of_re_rastering() {
    let mut lib = library(&["a"]);
    lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    let stretched = lib.plan(&held("a", 2.0, 1.5), LIMITS);
    assert!(stretched.rasters.is_empty());
    assert_eq!(kinds(&stretched.screen), vec!["image"]);
    let Item::Image(image) = &stretched.screen.items[0] else { panic!() };
    assert_eq!((image.look.matrix[0], image.look.matrix[3]), (2.0, 1.5));

    assert_eq!(lib.plan(&screen(&[("a", 2.0, 0.0)]), LIMITS).rasters.len(), 1);
}

#[test]
fn a_node_being_resized_past_the_cache_side_is_rastered_once_at_the_largest_scale_that_fits() {
    let mut lib = library(&["a"]);
    let small = Limits { side: 150, ..LIMITS };

    let first = lib.plan(&held("a", 3.0, 3.0), small);
    assert_eq!(first.rasters.len(), 1);
    assert_eq!((first.rasters[0].list.width, first.rasters[0].list.height), (150, 75));
    assert_eq!(kinds(&first.screen), vec!["image"]);

    assert!(lib.plan(&held("a", 3.2, 3.0), small).rasters.is_empty());
}

#[test]
fn a_node_being_resized_without_a_texture_yet_is_rastered() {
    let mut lib = library(&["a"]);

    assert_eq!(lib.plan(&held("a", 2.0, 1.5), LIMITS).rasters.len(), 1);
}

#[test]
fn a_small_zoom_keeps_the_texture() {
    let mut lib = library(&["a"]);
    lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    assert!(lib.plan(&screen(&[("a", 0.95, 0.0)]), LIMITS).rasters.is_empty());
}

#[test]
fn a_new_use_beyond_the_raster_budget_shows_its_background_until_its_texture_exists() {
    let mut lib = library(&["a", "b"]);

    let first = lib.plan(&screen(&[("a", 1.0, 0.0), ("b", 1.0, 200.0)]), LIMITS);
    assert_eq!(kinds(&first.screen), vec!["image", "path"]);
    assert!(first.pending);

    let second = lib.plan(&screen(&[("a", 1.0, 0.0), ("b", 1.0, 200.0)]), LIMITS);
    assert_eq!(kinds(&second.screen), vec!["image", "image"]);
}

#[test]
fn putting_a_group_again_drops_its_texture() {
    let mut lib = library(&["a"]);
    let clip = lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS).rasters[0].clip.clone();

    lib.put_group("a", &parse(FRAME).unwrap());
    let after = lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    assert!(after.evicted.contains(&clip));
    assert_eq!(after.rasters.len(), 1);
}

#[test]
fn a_texture_off_screen_is_evicted() {
    let mut lib = library(&["a"]);
    let clip = lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS).rasters[0].clip.clone();

    let gone = lib.plan(&screen(&[]), LIMITS);

    assert_eq!(gone.evicted, vec![clip]);
    assert_eq!(lib.cache_bytes(), 0);
}

#[test]
fn a_use_larger_than_the_side_limit_is_expanded() {
    let mut lib = library(&["a"]);

    let huge = lib.plan(&screen(&[("a", 50.0, 0.0)]), LIMITS);

    assert!(huge.rasters.is_empty());
    assert_eq!(kinds(&huge.screen), vec!["path", "path"]);
}

#[test]
fn an_uncached_use_is_expanded_as_before() {
    let mut lib = library(&["a"]);
    let list = parse(r#"{ "width": 800, "height": 600, "background": null, "items": [{ "kind": "use", "clip": "a", "group": "a", "matrix": [1, 0, 0, 1, 0, 0] }] }"#).unwrap();

    assert_eq!(kinds(&lib.plan(&list, LIMITS).screen), vec!["path", "path"]);
}

#[cfg(feature = "gpu")]
#[test]
fn a_cached_frame_draws_the_same_pixels_as_the_expanded_one() {
    let pictures = gpu_core::pictures::Pictures::new();
    let draw = |cache: bool| {
        let mut renderer = gpu_core::render::Renderer::new().expect("a GPU adapter");
        renderer.put_group("a", parse(FRAME).unwrap());
        let list = parse(&format!(r#"{{ "width": 400, "height": 300, "background": [0, 0, 0, 1], "items": [{{ "kind": "use", "clip": "a", "group": "a", "matrix": [3, 0, 0, 3, 20, 30], "cache": {cache} }}] }}"#)).unwrap();
        renderer.render(&list, &pictures).unwrap().pixels
    };
    let (expanded, cached) = (draw(false), draw(true));
    let worst = expanded.iter().zip(&cached).map(|(a, b)| a.abs_diff(*b)).max().unwrap();

    assert!(worst <= 2, "worst channel difference {worst}");
}

#[test]
fn a_cached_use_just_off_screen_is_rastered_ahead_but_draws_nothing() {
    let mut lib = library(&["a", "b"]);
    let list = parse(r#"{ "width": 800, "height": 600, "background": null, "items": [
      { "kind": "use", "clip": "a", "group": "a", "matrix": [1, 0, 0, 1, 900, 0], "cache": true },
      { "kind": "use", "clip": "b", "group": "b", "matrix": [1, 0, 0, 1, 900, 0] } ] }"#).unwrap();

    let ahead = lib.plan(&list, LIMITS);

    assert_eq!(ahead.rasters.len(), 1);
    assert!(ahead.screen.items.is_empty());
}

#[test]
fn a_big_group_is_rastered_a_chunk_per_draw_over_its_partial_texture() {
    let mut lib = library(&["a"]);
    let at = screen(&[("a", 1.0, 0.0)]);

    let first = lib.plan(&at, ONE_ITEM);
    assert_eq!(kinds(&first.rasters[0].list), vec!["path"]);
    let Item::Image(partial) = &first.screen.items[0] else { panic!() };
    assert_eq!(partial.src, first.rasters[0].clip);
    assert_eq!(first.screen.items.len(), 1);
    assert!(first.pending);

    let second = lib.plan(&at, ONE_ITEM);
    let Item::Image(base) = &second.rasters[0].list.items[0] else { panic!() };
    assert_eq!(base.clip, first.rasters[0].clip);
    assert_eq!(kinds(&second.rasters[0].list), vec!["image", "path"]);
    assert_eq!(kinds(&second.screen), vec!["image"]);
    assert!(!second.pending);

    let third = lib.plan(&at, ONE_ITEM);
    assert!(third.rasters.is_empty());
    assert!(third.evicted.contains(&first.rasters[0].clip));
}

#[test]
fn while_a_zoom_re_raster_is_in_chunks_the_stale_texture_stays_on_screen() {
    let mut lib = library(&["a"]);
    lib.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS);

    let zoomed = lib.plan(&screen(&[("a", 2.0, 0.0)]), ONE_ITEM);

    let Item::Image(stale) = &zoomed.screen.items[0] else { panic!() };
    assert_eq!(stale.look.matrix[0], 2.0);
    assert!(zoomed.pending);
}

#[cfg(feature = "gpu")]
#[test]
fn a_frame_rastered_in_chunks_draws_the_same_pixels_as_one_raster() {
    let two = r#"{ "width": 100, "height": 50, "background": [0, 0, 1, 1], "items": [
      { "kind": "path", "clip": "x", "contours": [[10, 10, 30, 10, 30, 30, 10, 30]], "rule": "nonzero", "paint": { "kind": "solid", "color": [1, 0, 0, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" },
      { "kind": "path", "clip": "y", "contours": [[20, 20, 60, 20, 60, 40, 20, 40]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0, 1, 0, 0.5] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" } ] }"#;
    let list = parse(r#"{ "width": 400, "height": 300, "background": [0, 0, 0, 1], "items": [{ "kind": "use", "clip": "a", "group": "a", "matrix": [3, 0, 0, 3, 20, 30], "cache": true }] }"#).unwrap();
    let draw = |items: usize| {
        let mut renderer = gpu_core::render::Renderer::with_limits(Limits { side: 4096, rasters: 1, items }).expect("a GPU adapter");
        renderer.put_group("a", parse(two).unwrap());
        let pictures = gpu_core::pictures::Pictures::new();
        (0..4).map(|_| renderer.render(&list, &pictures).unwrap().pixels).last().unwrap()
    };
    let (whole, chunked) = (draw(1000), draw(1));
    let worst = whole.iter().zip(&chunked).map(|(a, b)| a.abs_diff(*b)).max().unwrap();

    assert!(worst <= 2, "worst channel difference {worst}");
}

#[test]
fn a_group_put_in_parts_draws_like_one_put_whole() {
    let whole = library(&["a"]).plan(&screen(&[("a", 1.0, 0.0)]), LIMITS).rasters.remove(0).list;
    let mut parts = Library::new();
    let mut first = parse(FRAME).unwrap();
    let rest = DisplayList { items: first.items.split_off(0), ..first.clone_empty() };
    parts.put_group("a", &first);
    parts.append_group("a", &rest);

    let built = parts.plan(&screen(&[("a", 1.0, 0.0)]), LIMITS).rasters.remove(0).list;

    assert_eq!(kinds(&built), kinds(&whole));
}

#[test]
fn a_plan_names_the_groups_whose_cache_it_finished() {
    let mut lib = library(&["a", "b"]);

    let first = lib.plan(&screen(&[("a", 1.0, 0.0), ("b", 1.0, 200.0)]), LIMITS);
    let second = lib.plan(&screen(&[("a", 1.0, 0.0), ("b", 1.0, 200.0)]), LIMITS);

    assert_eq!(first.finished, vec!["a".to_string()]);
    assert_eq!(first.waiting, vec!["b".to_string()]);
    assert_eq!(second.finished, vec!["b".to_string()]);
    assert!(second.waiting.is_empty());
}

#[test]
fn the_library_names_the_groups_that_draw_a_picture() {
    let mut lib = library(&["plain"]);
    let photo = r#"{ "width": 10, "height": 10, "background": null, "items": [
      { "kind": "group", "clip": "g", "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "items": [
        { "kind": "image", "clip": "pic", "src": "pic", "video": false, "mediaTime": 0, "size": { "width": 4, "height": 4 }, "fit": "fill", "focus": [0, 0], "zoom": 1, "clipped": true, "inner": [1, 0, 0, 1, 0, 0], "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0] } ] } ] }"#;
    lib.put_group("photo", &parse(photo).unwrap());

    assert_eq!(lib.groups_drawing("pic"), vec!["photo".to_string()]);
}

#[test]
fn the_library_knows_the_size_of_a_group() {
    let lib = library(&["a"]);

    assert_eq!(lib.size_of("a"), Some((100.0, 50.0)));
    assert_eq!(lib.size_of("nope"), None);
}
