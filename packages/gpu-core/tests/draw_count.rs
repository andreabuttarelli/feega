#[cfg(feature = "gpu")]
use gpu_core::{display_list::parse, engine::Engine, pictures::Pictures};
#[cfg(feature = "gpu")]
use vello::wgpu;

#[cfg(feature = "gpu")]
fn device() -> (wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).expect("a GPU adapter");
    pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).expect("a device")
}

#[cfg(feature = "gpu")]
#[test]
fn every_display_list_drawn_is_counted_once_and_the_count_restarts_when_taken() {
    let (device, queue) = device();
    let mut engine = Engine::new(&device).unwrap();
    let list = parse(r#"{ "width": 16, "height": 16, "background": [0, 0, 0, 1], "items": [] }"#).unwrap();
    let target = device.create_texture(&wgpu::TextureDescriptor { label: None, size: wgpu::Extent3d { width: 16, height: 16, depth_or_array_layers: 1 }, mip_level_count: 1, sample_count: 1, dimension: wgpu::TextureDimension::D2, format: wgpu::TextureFormat::Rgba8Unorm, usage: wgpu::TextureUsages::STORAGE_BINDING | wgpu::TextureUsages::TEXTURE_BINDING, view_formats: &[] });
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());

    engine.draw(&device, &queue, &list, &Pictures::new(), &view).unwrap();
    engine.draw(&device, &queue, &list, &Pictures::new(), &view).unwrap();

    assert_eq!(engine.take_draws(), 2);
    assert_eq!(engine.take_draws(), 0);
}
