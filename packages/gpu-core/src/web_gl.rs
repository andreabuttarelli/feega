use vello::kurbo::{Affine, BezPath, Rect, Shape};
use vello::peniko::{BlendMode, Brush, Compose, Fill, ImageQuality, ImageSampler, Mix};
use vello_common::paint::{Image, ImageId, ImageSource};
use vello_hybrid::{RenderSize, Resources, Scene, WebGlRenderer, WebGlTextureBindings, WebGlTextureWithDimensions};
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, WebGl2RenderingContext as Gl};

use crate::canvas::{brush, Canvas};
use crate::display_list::{parse, Paint, Size};
use crate::scene::{build_into, Layers, Shelf};

#[derive(Clone, Copy)]
pub struct GlPicture {
    id: ImageId,
    size: Size,
}

impl Canvas for Scene {
    type Picture = GlPicture;

    fn size(picture: &GlPicture) -> Size {
        picture.size
    }

    fn fill(&mut self, rule: Fill, transform: Affine, paint: &Paint, shape: &BezPath) {
        self.set_transform(transform);
        self.set_fill_rule(rule);
        self.reset_paint_transform();
        self.set_paint(brush::<Image>(paint));
        self.fill_path(shape);
    }

    fn picture(&mut self, transform: Affine, picture: &GlPicture, texels: Affine, region: Rect) {
        self.set_transform(transform);
        self.set_fill_rule(Fill::NonZero);
        self.set_paint_transform(texels);
        let source = ImageSource::OpaqueId { id: picture.id, may_have_transparency: true };
        self.set_paint(Brush::Image(Image { image: source, sampler: ImageSampler::new().with_quality(ImageQuality::Medium) }));
        self.fill_rect(&region);
    }

    fn push_layer(&mut self, blend: Mix, opacity: f32, _frame: Rect) {
        Scene::push_layer(self, None, Some(BlendMode::new(blend, Compose::SrcOver)), Some(opacity), None, None);
    }

    fn push_clip(&mut self, rule: Fill, transform: Affine, shape: &BezPath) {
        self.set_transform(transform);
        self.set_fill_rule(rule);
        self.push_clip_layer(shape);
    }

    fn pop(&mut self) {
        self.pop_layer();
    }
}

fn failed<E: std::fmt::Debug>(e: E) -> JsValue {
    JsValue::from_str(&format!("{e:?}"))
}

#[wasm_bindgen]
pub struct WebGlCore {
    renderer: WebGlRenderer,
    resources: Resources,
    scene: Scene,
    width: u32,
    height: u32,
    pictures: Shelf<GlPicture>,
}

#[wasm_bindgen]
impl WebGlCore {
    pub fn attach(canvas: HtmlCanvasElement, width: u32, height: u32) -> WebGlCore {
        canvas.set_width(width);
        canvas.set_height(height);
        let (renderer, resources) = WebGlRenderer::new(&canvas);
        WebGlCore { renderer, resources, scene: Scene::new(width as u16, height as u16), width, height, pictures: Shelf::new() }
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        let gl = self.renderer.gl_context().clone();
        let texture = gl.create_texture().ok_or_else(|| failed("no texture"))?;
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        let (rgba, bytes) = (Gl::RGBA as i32, Gl::UNSIGNED_BYTE);
        let uploaded = match source.dyn_into::<HtmlVideoElement>() {
            Ok(video) => gl.tex_image_2d_with_u32_and_u32_and_html_video_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, &video),
            Err(other) => gl.tex_image_2d_with_u32_and_u32_and_html_image_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, &other.dyn_into::<HtmlImageElement>().map_err(|_| failed("unknown picture source"))?),
        };
        uploaded?;
        if let Some(old) = self.pictures.remove(clip) {
            self.renderer.destroy_image(&mut self.resources, old.id);
        }
        let id = self.renderer.upload_image(&mut self.resources, &WebGlTextureWithDimensions { texture: texture.clone(), width, height });
        gl.delete_texture(Some(&texture));
        self.pictures.insert(clip.into(), GlPicture { id, size: Size { width: width as f64, height: height as f64 } });
        Ok(())
    }

    pub fn draw(&mut self, list_json: &str) -> Result<String, JsValue> {
        let list = parse(list_json).map_err(failed)?;
        self.scene.reset();
        if let Some(color) = list.background {
            Canvas::fill(&mut self.scene, Fill::NonZero, Affine::IDENTITY, &Paint::Solid { color }, &Rect::new(0.0, 0.0, list.width as f64, list.height as f64).to_path(0.1));
        }
        let skipped = build_into(&mut self.scene, &list, &self.pictures, &Layers::new());
        self.renderer.render(&self.scene, &mut self.resources, &RenderSize { width: self.width, height: self.height }, &WebGlTextureBindings::new()).map_err(failed)?;
        Ok(skipped.iter().map(|s| format!("{} {}", s.clip, s.what)).collect::<Vec<_>>().join("\n"))
    }
}
