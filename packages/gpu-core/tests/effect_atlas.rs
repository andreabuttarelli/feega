#![cfg(feature = "gpu")]

use gpu_core::engine::{Atlas, Engine};
use gpu_core::{display_list::parse, pictures::Pictures};
use vello::wgpu;

const SIZE: u32 = 256;
const TOLERANCE: u8 = 2;

fn device() -> (wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).expect("a GPU adapter");
    pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).expect("a device")
}

fn square(x: u32, y: u32, look: &str) -> String {
    let (x0, y0, x1, y1) = (x, y, x + 40, y + 40);
    format!(
        r#"{{ "kind": "path", "clip": "s{x}-{y}", "contours": [[{x0}, {y0}, {x1}, {y0}, {x1}, {y1}, {x0}, {y1}]], "rule": "nonzero",
  "paint": {{ "kind": "solid", "color": [0.9, 0.4, 0.2, 1] }}, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal"{look} }}"#
    )
}

fn look(x: u32, y: u32) -> &'static str {
    match (x / 64 + y / 64) % 4 {
        0 => r#", "blur": 3"#,
        1 => r#", "blur": 0, "masks": [{ "mode": "add", "invert": false, "level": 1, "feather": 2, "cover": { "kind": "path", "contours": [[0, 0, 1, 0, 1, 1, 0, 1]], "matrix": [20, 0, 0, 40, 0, 0] } }]"#,
        2 => r#", "blur": 0, "backdrop": 4"#,
        _ => r#", "blur": 0, "matte": { "luma": false, "invert": true, "items": [{ "kind": "path", "clip": "m", "contours": [[0, 0, 128, 0, 128, 256, 0, 256]], "rule": "nonzero", "paint": { "kind": "solid", "color": [1, 1, 1, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }] }"#,
    }
}

fn wall() -> String {
    let mut items = vec![r#"{ "kind": "path", "clip": "bg", "contours": [[0, 0, 256, 0, 256, 256, 0, 256]], "rule": "nonzero", "paint": { "kind": "solid", "color": [0.1, 0.5, 0.8, 1] }, "opacity": 1, "matrix": [1, 0, 0, 1, 0, 0], "blend": "normal" }"#.to_string()];
    for y in (8..SIZE).step_by(64) {
        for x in (8..SIZE).step_by(64) {
            items.push(square(x, y, look(x, y)));
        }
    }
    format!(r#"{{ "width": {SIZE}, "height": {SIZE}, "background": [0, 0, 0, 1], "items": [{}] }}"#, items.join(","))
}

fn drawn(atlas: Atlas) -> (Vec<u8>, u32) {
    let (device, queue) = device();
    let mut engine = Engine::new(&device).unwrap();
    engine.atlas = atlas;
    let list = parse(&wall()).unwrap();
    let target = device.create_texture(&wgpu::TextureDescriptor { label: None, size: wgpu::Extent3d { width: SIZE, height: SIZE, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::COPY_SRC, view_formats: &[] });
    engine.draw(&device, &queue, &list, &Pictures::new(), &target.create_view(&wgpu::TextureViewDescriptor::default())).unwrap();
    let renders = engine.take_tally().total();
    (read(&device, &queue, &target), renders)
}

fn read(device: &wgpu::Device, queue: &wgpu::Queue, target: &wgpu::Texture) -> Vec<u8> {
    let row = SIZE * 4;
    let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (row * SIZE) as u64, usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture: target, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(row), rows_per_image: None } },
        wgpu::Extent3d { width: SIZE, height: SIZE, depth_or_array_layers: 1 },
    );
    queue.submit([encoder.finish()]);
    let slice = buffer.slice(..);
    slice.map_async(wgpu::MapMode::Read, |_| {});
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).unwrap();
    let data = slice.get_mapped_range().unwrap().to_vec();
    data
}

#[test]
fn the_effect_atlas_draws_the_same_pixels_as_one_render_per_layer() {
    let (packed, _) = drawn(Atlas::On);
    let (alone, _) = drawn(Atlas::Off);

    let worst = packed.iter().zip(&alone).map(|(a, b)| a.abs_diff(*b)).max().unwrap();

    assert!(worst <= TOLERANCE, "worst channel difference {worst}");
}

#[test]
fn the_effect_layers_of_one_draw_share_a_few_renders() {
    let (_, packed) = drawn(Atlas::On);
    let (_, alone) = drawn(Atlas::Off);

    assert!(alone >= 20, "baseline renders {alone}");
    assert!(packed <= 6, "atlas renders {packed}");
}
