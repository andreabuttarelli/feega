#[cfg(feature = "gpu")]
use gpu_core::filter_passes::FilterPasses;
#[cfg(feature = "gpu")]
use gpu_core::{display_list::parse, engine::Engine, groups::{Plan, Raster}, pictures::Pictures};
#[cfg(feature = "gpu")]
use vello::wgpu;

#[cfg(feature = "gpu")]
fn device() -> (wgpu::Device, wgpu::Queue) {
    let instance = wgpu::Instance::default();
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions::default())).expect("a GPU adapter");
    pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor::default())).expect("a device")
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
fn a_texture_the_pool_does_not_shelve_is_destroyed_at_once() {
    let (device, queue) = device();
    let passes = FilterPasses::new(&device);
    passes.set_pool_bytes(100 * 100 * 4 - 1);
    let extra = passes.texture(&device, 100, 100);
    let raw = (*extra).clone();
    drop(extra);
    assert!(!usable(&device, &queue, &raw));
}

#[cfg(feature = "gpu")]
#[test]
fn a_shelved_texture_stays_usable() {
    let (device, queue) = device();
    let passes = FilterPasses::new(&device);
    let kept = passes.texture(&device, 32, 32);
    let raw = (*kept).clone();
    drop(kept);
    assert!(usable(&device, &queue, &raw));
}

#[cfg(feature = "gpu")]
const SQUARE: &str = r#"{ "width": 16, "height": 16, "background": [0, 0, 0, 1], "items": [] }"#;

#[cfg(feature = "gpu")]
fn plan(rasters: Vec<Raster>, evicted: Vec<String>) -> Plan {
    Plan { screen: parse(SQUARE).unwrap(), rasters, evicted, pending: false, skipped: vec![], finished: vec![], waiting: vec![] }
}

#[cfg(feature = "gpu")]
fn sized(side: u32) -> Raster {
    Raster { clip: format!("r{side}"), list: parse(&SQUARE.replace("16", &side.to_string())).unwrap() }
}

#[cfg(feature = "gpu")]
#[test]
fn an_evicted_raster_waits_among_the_spares_and_is_freed_when_they_overflow() {
    let (device, queue) = device();
    let mut engine = Engine::new(&device).unwrap();
    let mut held = Pictures::new();
    engine.hold(&mut held, plan(vec![sized(16)], vec![]), &Pictures::new(), &device, &queue).unwrap();
    let raw = engine.held("r16").expect("a held raster").clone();
    engine.hold(&mut held, plan(vec![], vec!["r16".into()]), &Pictures::new(), &device, &queue).unwrap();

    assert!(engine.held("r16").is_none());
    assert!(usable(&device, &queue, &raw));

    for side in 17..=OVERFLOWING_SIDE {
        engine.hold(&mut held, plan(vec![sized(side)], vec![]), &Pictures::new(), &device, &queue).unwrap();
        engine.hold(&mut held, plan(vec![], vec![format!("r{side}")]), &Pictures::new(), &device, &queue).unwrap();
    }

    assert!(!usable(&device, &queue, &raw));
}

#[cfg(feature = "gpu")]
const OVERFLOWING_SIDE: u32 = 48;

#[cfg(feature = "gpu")]
#[test]
fn a_chain_of_filter_passes_reaches_the_queue_in_one_submission() {
    use gpu_core::filter_passes::Op;
    let (device, queue) = device();
    let passes = FilterPasses::new(&device);
    let source = passes.texture(&device, 32, 32);

    let once = passes.run(&device, Op::Blur, [&source, &source], &[1.0, 0.0], (32, 32));
    let twice = passes.run(&device, Op::Blur, [&once, &once], &[0.0, 1.0], (32, 32));
    let thrice = passes.run(&device, Op::Blur, [&twice, &twice], &[1.0, 0.0], (32, 32));
    passes.flush(&queue);

    assert_eq!(passes.submits(), 1);
    assert!(usable(&device, &queue, &thrice));
}
