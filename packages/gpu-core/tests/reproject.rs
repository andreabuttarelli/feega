#![cfg(feature = "gpu")]

use gpu_core::reproject::{Draw, Output, Reprojector};
use gpu_core::retained::Lookup;
use vello::wgpu;

const SIDE: u32 = 4;
const ROW_ALIGN: u32 = 256;
const FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;
const EDGE: [u8; 4] = [217, 217, 217, 51];
const IDENTITY: Lookup = Lookup { scale: 1.0, x: 0.0, y: 0.0 };

fn device() -> (wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).expect("a GPU adapter");
    pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).expect("a GPU device")
}

fn texture(device: &wgpu::Device) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: None,
        size: wgpu::Extent3d { width: SIDE, height: SIDE, depth_or_array_layers: 1 },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: FORMAT,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    })
}

fn reprojected(output: Output) -> [u8; 4] {
    let (device, queue) = device();
    let source = texture(&device);
    let target = texture(&device);
    let pixels: Vec<u8> = EDGE.repeat((SIDE * SIDE) as usize);
    queue.write_texture(
        wgpu::TexelCopyTextureInfo { texture: &source, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        &pixels,
        wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(SIDE * 4), rows_per_image: None },
        source.size(),
    );
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    Reprojector::new(&device).draw(&device, &queue, &mut encoder, Draw { source: &source, target: &view, format: FORMAT, look: IDENTITY, within: None, output });
    let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (ROW_ALIGN * SIDE) as u64, usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture: &target, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(ROW_ALIGN), rows_per_image: None } },
        target.size(),
    );
    queue.submit([encoder.finish()]);
    let slice = buffer.slice(..);
    slice.map_async(wgpu::MapMode::Read, |_| {});
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).expect("readback");
    let data = slice.get_mapped_range().expect("mapped").to_vec();
    [data[0], data[1], data[2], data[3]]
}

#[test]
fn an_antialiased_edge_reaches_the_page_premultiplied_not_brighter_than_its_fill() {
    let [r, g, b, a] = reprojected(Output::Premultiplied);

    assert_eq!(a, EDGE[3]);
    assert!([r, g, b].iter().all(|&c| c <= a), "colour {r},{g},{b} exceeds alpha {a}: the browser would add it on top of the page");
}

#[test]
fn a_retained_copy_keeps_straight_alpha_so_it_is_premultiplied_once() {
    assert_eq!(reprojected(Output::Straight), EDGE);
}

const AWAY: Lookup = Lookup { scale: 1.0, x: 100.0, y: 100.0 };

fn first_texel(device: &wgpu::Device, queue: &wgpu::Queue, mut encoder: wgpu::CommandEncoder, target: &wgpu::Texture) -> [u8; 4] {
    let buffer = device.create_buffer(&wgpu::BufferDescriptor { label: None, size: (ROW_ALIGN * SIDE) as u64, usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
    encoder.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo { texture: target, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        wgpu::TexelCopyBufferInfo { buffer: &buffer, layout: wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(ROW_ALIGN), rows_per_image: None } },
        target.size(),
    );
    queue.submit([encoder.finish()]);
    let slice = buffer.slice(..);
    slice.map_async(wgpu::MapMode::Read, |_| {});
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).expect("readback");
    let data = slice.get_mapped_range().expect("mapped").to_vec();
    [data[0], data[1], data[2], data[3]]
}

#[test]
fn a_zoom_gesture_reuses_the_same_uniform_memory_and_each_frame_sees_its_own_look() {
    let (device, queue) = device();
    let source = texture(&device);
    let pixels: Vec<u8> = EDGE.repeat((SIDE * SIDE) as usize);
    queue.write_texture(
        wgpu::TexelCopyTextureInfo { texture: &source, mip_level: 0, origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All },
        &pixels,
        wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(SIDE * 4), rows_per_image: None },
        source.size(),
    );
    let mut reprojector = Reprojector::new(&device);
    let mut first_bytes = None;

    for frame in 0..64 {
        let look = if frame % 2 == 0 { IDENTITY } else { AWAY };
        let target = texture(&device);
        let view = target.create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
        reprojector.draw(&device, &queue, &mut encoder, Draw { source: &source, target: &view, format: FORMAT, look, within: None, output: Output::Straight });
        let seen = first_texel(&device, &queue, encoder, &target);

        assert_eq!(seen, if frame % 2 == 0 { EDGE } else { [0; 4] }, "frame {frame}");
        let bytes = reprojector.uniform_bytes();
        assert_eq!(*first_bytes.get_or_insert(bytes), bytes, "uniform memory grew at frame {frame}");
    }
}
