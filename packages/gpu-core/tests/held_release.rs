#[cfg(feature = "gpu")]
use gpu_core::{display_list::parse, engine::Engine, filter_passes::layer_texture, pictures::Pictures};
#[cfg(feature = "gpu")]
use vello::{kurbo::Affine, wgpu};

#[cfg(feature = "gpu")]
const SIDE: u32 = 16;

#[cfg(feature = "gpu")]
const LIST: &str = r#"{
  "width": 16, "height": 16, "background": [0, 0, 0, 1],
  "items": [
    { "kind": "image", "clip": "pic", "src": "x", "video": false, "mediaTime": 0, "size": { "width": 8, "height": 8 },
      "fit": "fill", "focus": [0.5, 0.5], "zoom": 1, "clipped": true, "inner": [1, 0, 0, 1, 0, 0],
      "opacity": 1, "matrix": [1, 0, 0, 1, 4, 4], "blur": 0, "blend": "normal" }
  ]
}"#;

#[cfg(feature = "gpu")]
fn device() -> (wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).expect("a GPU adapter");
    pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).expect("a device")
}

#[cfg(feature = "gpu")]
fn uploaded(device: &wgpu::Device, queue: &wgpu::Queue) -> wgpu::Texture {
    let size = wgpu::Extent3d { width: 4, height: 4, depth_or_array_layers: 1 };
    let texture = device.create_texture(&wgpu::TextureDescriptor { label: None, size, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::COPY_SRC | wgpu::TextureUsages::COPY_DST | wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] });
    queue.write_texture(texture.as_image_copy(), &[255u8; 64], wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(16), rows_per_image: None }, size);
    texture
}

#[cfg(feature = "gpu")]
fn usable(device: &wgpu::Device, queue: &wgpu::Queue, texture: &wgpu::Texture) -> bool {
    let target = device.create_texture(&wgpu::TextureDescriptor { label: None, size: texture.size(), mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::COPY_DST, view_formats: &[] });
    let scope = device.push_error_scope(wgpu::ErrorFilter::Validation);
    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    encoder.copy_texture_to_texture(texture.as_image_copy(), target.as_image_copy(), texture.size());
    queue.submit([encoder.finish()]);
    pollster::block_on(scope.pop()).is_none()
}

#[cfg(feature = "gpu")]
#[test]
fn a_picture_released_while_a_held_scene_reads_it_still_draws() {
    let (device, queue) = device();
    let mut engine = Engine::new(&device).unwrap();
    let texture = uploaded(&device, &queue);
    let image = engine.vello.register_texture(texture.clone());
    let pictures = Pictures::from_iter([("pic".to_string(), image.clone())]);
    let (held, _) = engine.build_held(&device, &queue, &parse(LIST).unwrap(), &pictures).unwrap();

    engine.retire(image, texture.clone());

    let target = layer_texture(&device, SIDE, SIDE);
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());
    engine.draw_held(&device, &queue, &held, Affine::IDENTITY, None, &view, (SIDE, SIDE)).unwrap();
    assert!(usable(&device, &queue, &texture));

    engine.drop_held(held);
    assert!(!usable(&device, &queue, &texture));
}

#[cfg(feature = "gpu")]
#[test]
fn a_picture_no_held_scene_reads_is_freed_at_once() {
    let (device, queue) = device();
    let mut engine = Engine::new(&device).unwrap();
    let texture = uploaded(&device, &queue);
    let image = engine.vello.register_texture(texture.clone());

    engine.retire(image, texture.clone());

    assert!(!usable(&device, &queue, &texture));
}
