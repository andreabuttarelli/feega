use gpu_core::display_list::{parse, parse_packed, Item};

const INLINE: &str = r#"{"width":10,"height":10,"background":null,"items":[{"kind":"path","clip":"a","contours":[[0,0,1,0,1,1],[2,2,3,3]],"rule":"nonzero","paint":{"kind":"solid","color":[1,0,0,1]},"opacity":1,"matrix":[1,0,0,1,0,0],"masks":[{"mode":"add","invert":false,"level":1,"feather":0,"cover":{"kind":"path","contours":[[5,5,6,6]],"matrix":[1,0,0,1,0,0]}}]}]}"#;
const PACKED: &str = r#"{"width":10,"height":10,"background":null,"items":[{"kind":"path","clip":"a","masks":[{"mode":"add","invert":false,"level":1,"feather":0,"cover":{"kind":"path","contours":[2],"matrix":[1,0,0,1,0,0]}}],"contours":[0,1],"rule":"nonzero","paint":{"kind":"solid","color":[1,0,0,1]},"opacity":1,"matrix":[1,0,0,1,0,0]}]}"#;

fn contours_of(item: &Item) -> String {
    format!("{item:?}")
}

#[test]
fn a_packed_list_reads_as_the_inline_one_whatever_the_key_order() {
    let inline = parse(INLINE).unwrap();
    let packed = parse_packed(PACKED, vec![0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 2.0, 2.0, 3.0, 3.0, 5.0, 5.0, 6.0, 6.0], vec![6, 10, 14]).unwrap();

    assert_eq!(contours_of(&inline.items[0]), contours_of(&packed.items[0]));
}

#[test]
fn a_missing_packed_contour_is_an_error_not_an_empty_shape() {
    assert!(parse_packed(PACKED, vec![0.0; 6], vec![6]).is_err());
}

#[test]
fn a_packed_index_without_a_pack_is_an_error() {
    assert!(parse(PACKED).is_err());
}
