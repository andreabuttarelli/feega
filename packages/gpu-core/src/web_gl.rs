use vello::kurbo::{Affine, BezPath, Rect, Shape};
use vello::peniko::{BlendMode, Brush, Compose, Fill, ImageQuality, ImageSampler, Mix};
use vello_common::paint::{Image, ImageId, ImageSource};
use vello_hybrid::{RenderSize, Resources, Scene, WebGlRenderer, WebGlTextureBindings, WebGlTextureWithDimensions};
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, WebGl2RenderingContext as Gl};

use crate::canvas::{brush, Canvas};
use crate::display_list::{parse, DisplayList, Paint, Rgba, Size};
use crate::gl_passes::{texture, GlRunner, Tex};
use crate::layers::{prepare, Surface};
use crate::scene::{build_into, Placed, Shelf};

#[derive(Clone, Copy)]
pub struct GlPicture {
    id: ImageId,
    size: Size,
}

pub struct GlCanvas {
    scene: Scene,
    by: Affine,
}

impl Canvas for GlCanvas {
    type Picture = GlPicture;

    fn size(picture: &GlPicture) -> Size {
        picture.size
    }

    fn fill(&mut self, rule: Fill, transform: Affine, paint: &Paint, shape: &BezPath) {
        self.scene.set_transform(self.by * transform);
        self.scene.set_fill_rule(rule);
        self.scene.reset_paint_transform();
        self.scene.set_paint(brush::<Image>(paint));
        self.scene.fill_path(shape);
    }

    fn picture(&mut self, transform: Affine, picture: &GlPicture, texels: Affine, region: Rect) {
        self.scene.set_transform(self.by * transform);
        self.scene.set_fill_rule(Fill::NonZero);
        self.scene.set_paint_transform(texels);
        let source = ImageSource::OpaqueId { id: picture.id, may_have_transparency: true };
        self.scene.set_paint(Brush::Image(Image { image: source, sampler: ImageSampler::new().with_quality(ImageQuality::Medium) }));
        self.scene.fill_rect(&region);
    }

    fn push_layer(&mut self, blend: Mix, opacity: f32, _frame: Rect) {
        self.scene.push_layer(None, Some(BlendMode::new(blend, Compose::SrcOver)), Some(opacity), None, None);
    }

    fn push_clip(&mut self, rule: Fill, transform: Affine, shape: &BezPath) {
        self.scene.set_transform(self.by * transform);
        self.scene.set_fill_rule(rule);
        self.scene.push_clip_layer(shape);
    }

    fn pop(&mut self) {
        self.scene.pop_layer();
    }
}

fn failed<E: std::fmt::Debug>(e: E) -> JsValue {
    JsValue::from_str(&format!("{e:?}"))
}

struct GlSurface<'a> {
    renderer: &'a mut WebGlRenderer,
    resources: &'a mut Resources,
    canvas: &'a mut GlCanvas,
    runner: &'a GlRunner,
    width: u32,
    height: u32,
    placed: Vec<ImageId>,
}

impl GlSurface<'_> {
    fn render(&mut self, base: Option<Rgba>, by: Affine, draw: &dyn Fn(&mut GlCanvas)) -> Result<(), JsValue> {
        self.canvas.scene.reset();
        self.canvas.by = Affine::IDENTITY;
        if let Some(color) = base {
            Canvas::fill(self.canvas, Fill::NonZero, Affine::IDENTITY, &Paint::Solid { color }, &Rect::new(0.0, 0.0, self.width as f64, self.height as f64).to_path(0.1));
        }
        self.canvas.by = by;
        draw(self.canvas);
        self.renderer.render(&self.canvas.scene, self.resources, &RenderSize { width: self.width, height: self.height }, &WebGlTextureBindings::new()).map_err(failed)
    }
}

impl Surface for GlSurface<'_> {
    type Canvas = GlCanvas;
    type Runner = GlRunner;
    type Error = JsValue;

    fn frame(&self) -> Rect {
        Rect::new(0.0, 0.0, self.width as f64, self.height as f64)
    }

    fn paint(&mut self, region: Rect, base: Option<Rgba>, draw: &dyn Fn(&mut GlCanvas)) -> Result<Tex, JsValue> {
        self.render(base, Affine::translate((-region.x0, -region.y0)), draw)?;
        let (w, h) = (region.width() as u32, region.height() as u32);
        let gl = self.renderer.gl_context().clone();
        let raw = texture(&gl, w, h);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&raw.texture));
        gl.copy_tex_sub_image_2d(Gl::TEXTURE_2D, 0, 0, 0, 0, (self.height - h) as i32, w as i32, h as i32);
        Ok(self.runner.flipped(&raw))
    }

    fn runner(&self) -> &GlRunner {
        self.runner
    }

    fn place(&mut self, tex: Tex, region: Rect) -> Placed<GlPicture> {
        let id = self.renderer.upload_image(self.resources, &WebGlTextureWithDimensions { texture: tex.texture.clone(), width: tex.width, height: tex.height });
        self.placed.push(id);
        Placed { image: GlPicture { id, size: Size { width: tex.width as f64, height: tex.height as f64 } }, origin: region.origin() }
    }
}

#[wasm_bindgen]
pub struct WebGlCore {
    renderer: WebGlRenderer,
    resources: Resources,
    canvas: GlCanvas,
    runner: GlRunner,
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
        let runner = GlRunner::new(renderer.gl_context());
        WebGlCore { renderer, resources, canvas: GlCanvas { scene: Scene::new(width as u16, height as u16), by: Affine::IDENTITY }, runner, width, height, pictures: Shelf::new() }
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        let gl = self.renderer.gl_context().clone();
        let texture = gl.create_texture().ok_or_else(|| failed("no texture"))?;
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        let (rgba, bytes) = (Gl::RGBA as i32, Gl::UNSIGNED_BYTE);
        let uploaded = if let Some(video) = source.dyn_ref::<HtmlVideoElement>() {
            gl.tex_image_2d_with_u32_and_u32_and_html_video_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, video)
        } else if let Some(still) = source.dyn_ref::<HtmlCanvasElement>() {
            gl.tex_image_2d_with_u32_and_u32_and_html_canvas_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, still)
        } else {
            let image = source.dyn_ref::<HtmlImageElement>().ok_or_else(|| failed("unknown picture source"))?;
            gl.tex_image_2d_with_u32_and_u32_and_html_image_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, image)
        };
        gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
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
        let list: DisplayList = parse(list_json).map_err(failed)?;
        let mut surface = GlSurface { renderer: &mut self.renderer, resources: &mut self.resources, canvas: &mut self.canvas, runner: &self.runner, width: self.width, height: self.height, placed: Vec::new() };
        let layers = prepare(&mut surface, &list, &self.pictures)?;
        let skipped = std::cell::RefCell::new(Vec::new());
        surface.render(list.background, Affine::IDENTITY, &|c| skipped.borrow_mut().extend(build_into(c, &list, &self.pictures, &layers)))?;
        let skipped = skipped.into_inner();
        for id in surface.placed {
            surface.renderer.destroy_image(surface.resources, id);
        }
        Ok(skipped.iter().map(|s| format!("{} {}", s.clip, s.what)).collect::<Vec<_>>().join("\n"))
    }
}
