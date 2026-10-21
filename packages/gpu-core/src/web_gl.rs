use vello::kurbo::{Affine, BezPath, Rect, Shape};
use vello::peniko::{BlendMode, Brush, Compose, Fill, ImageQuality, ImageSampler, Mix};
use vello_common::paint::{Image, ImageId, ImageSource};
use vello_hybrid::{RenderSize, Resources, Scene, WebGlRenderer, WebGlTextureBindings, WebGlTextureWithDimensions};
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, HtmlImageElement, HtmlVideoElement, ImageBitmap, WebGl2RenderingContext as Gl};

use crate::canvas::{brush, Canvas};
use crate::compositor::{Compositor, Painter};
use crate::display_list::{parse, parse_splice, DisplayList, Paint, Rgba, Size};
use crate::groups::{report, Library, Limits, Plan};
use crate::gl_passes::{texture, GlRunner, Tex};
use crate::gl_reproject::{held, smooth, GlReprojector, Held, Target};
use crate::retained::{Camera, Lookup, Quality};
use crate::world::{parse_overlay, parse_patch};
use crate::layers::{prepare, Blending, Surface};
use crate::scene::{build_into, Placed, Shelf};
use crate::Skipped;

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

const CACHE_SIDE: u32 = 4096;
const RASTERS_PER_DRAW: usize = 1;
const ITEMS_PER_RASTER: usize = 16;

#[wasm_bindgen]
pub struct WebGlCore {
    renderer: WebGlRenderer,
    resources: Resources,
    canvas: GlCanvas,
    runner: GlRunner,
    width: u32,
    height: u32,
    pictures: Shelf<GlPicture>,
    library: Library,
    cached: Shelf<GlPicture>,
    pending: bool,
    compositor: Compositor,
    camera: Camera,
    retained: Held,
    spare: Held,
    reprojector: GlReprojector,
}

impl Painter for WebGlCore {
    type Error = JsValue;

    fn limits(&self) -> Limits {
        WebGlCore::limits(self)
    }

    fn tile(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    fn shift(&mut self, (dx, dy): (i32, i32)) -> Result<(), JsValue> {
        let gl = self.renderer.gl_context().clone();
        let (w, h) = (self.retained.tex.width as f64, self.retained.tex.height as f64);
        let whole = Rect::new(0.0, 0.0, w, h);
        let from = whole.intersect(whole - vello::kurbo::Vec2::new(dx as f64, dy as f64));
        if from.area() > 0.0 {
            let (x0, x1) = (from.x0 as i32, from.x1 as i32);
            let (y0, y1) = ((h - from.y1) as i32, (h - from.y0) as i32);
            gl.disable(Gl::SCISSOR_TEST);
            gl.bind_framebuffer(Gl::READ_FRAMEBUFFER, Some(&self.retained.fbo));
            gl.bind_framebuffer(Gl::DRAW_FRAMEBUFFER, Some(&self.spare.fbo));
            gl.blit_framebuffer(x0, y0, x1, y1, x0 + dx, y0 - dy, x1 + dx, y1 - dy, Gl::COLOR_BUFFER_BIT, Gl::NEAREST);
            gl.bind_framebuffer(Gl::READ_FRAMEBUFFER, None);
            gl.bind_framebuffer(Gl::DRAW_FRAMEBUFFER, None);
        }
        std::mem::swap(&mut self.retained, &mut self.spare);
        Ok(())
    }

    fn paint(&mut self, plan: Plan, into: Rect, quality: Quality) -> Result<Vec<Skipped>, JsValue> {
        let (list, missing) = self.hold(plan)?;
        let pictures: Shelf<GlPicture> = self.pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), *v)).collect();
        let mut surface = GlSurface { renderer: &mut self.renderer, resources: &mut self.resources, canvas: &mut self.canvas, runner: &self.runner, width: self.width, height: self.height, placed: Vec::new() };
        let layers = prepare(&mut surface, &list, &pictures, Blending::Composited)?;
        let skipped = std::cell::RefCell::new(Vec::new());
        surface.render(list.background, Affine::IDENTITY, &|c| skipped.borrow_mut().extend(build_into(c, &list, &pictures, &layers)))?;
        for id in surface.placed {
            surface.renderer.destroy_image(surface.resources, id);
        }
        let gl = self.renderer.gl_context().clone();
        let (w, h) = (list.width as i32, list.height as i32);
        let below = self.height as i32 - h;
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
        match quality {
            Quality::Sharp => {
                gl.bind_texture(Gl::TEXTURE_2D, Some(&self.retained.tex.texture));
                gl.copy_tex_sub_image_2d(Gl::TEXTURE_2D, 0, into.x0 as i32, self.retained.tex.height as i32 - into.y0 as i32 - h, 0, below, w, h);
            }
            Quality::Rough => {
                let scratch = texture(&gl, w as u32, h as u32);
                smooth(&gl, &scratch.texture);
                gl.copy_tex_sub_image_2d(Gl::TEXTURE_2D, 0, 0, 0, 0, below, w, h);
                let scale = w as f64 / into.width();
                let look = Lookup { scale, x: -into.x0 * scale, y: -into.y0 * scale };
                self.reprojector.draw(&scratch, look, Target { fbo: Some(&self.retained.fbo), width: self.retained.tex.width, height: self.retained.tex.height, within: Some(into) });
            }
        }
        Ok([skipped.into_inner(), missing].concat())
    }

    fn present(&mut self, look: Lookup) -> Result<(), JsValue> {
        self.reprojector.draw(&self.retained.tex, look, Target { fbo: None, width: self.width, height: self.height, within: None });
        Ok(())
    }
}

#[wasm_bindgen]
impl WebGlCore {
    pub fn attach(canvas: HtmlCanvasElement, width: u32, height: u32) -> WebGlCore {
        canvas.set_width(width);
        canvas.set_height(height);
        let (renderer, resources) = WebGlRenderer::new(&canvas);
        let runner = GlRunner::new(renderer.gl_context());
        let compositor = Compositor::new(width, height);
        let retained = held(renderer.gl_context(), compositor.size());
        let spare = held(renderer.gl_context(), compositor.size());
        let reprojector = GlReprojector::new(renderer.gl_context());
        let camera = Camera { x: 0.0, y: 0.0, zoom: 1.0 };
        WebGlCore { renderer, resources, canvas: GlCanvas { scene: Scene::new(width as u16, height as u16), by: Affine::IDENTITY }, runner, width, height, pictures: Shelf::new(), library: Library::new(), cached: Shelf::new(), pending: false, compositor, camera, retained, spare, reprojector }
    }

    pub fn picture(&mut self, clip: &str, source: JsValue, width: u32, height: u32) -> Result<(), JsValue> {
        let gl = self.renderer.gl_context().clone();
        let texture = gl.create_texture().ok_or_else(|| failed("no texture"))?;
        gl.bind_texture(Gl::TEXTURE_2D, Some(&texture));
        gl.pixel_storei(Gl::UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        let (rgba, bytes) = (Gl::RGBA as i32, Gl::UNSIGNED_BYTE);
        let uploaded = if let Some(video) = source.dyn_ref::<HtmlVideoElement>() {
            gl.tex_image_2d_with_u32_and_u32_and_html_video_element(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, video)
        } else if let Some(bitmap) = source.dyn_ref::<ImageBitmap>() {
            gl.tex_image_2d_with_u32_and_u32_and_image_bitmap(Gl::TEXTURE_2D, 0, rgba, Gl::RGBA, bytes, bitmap)
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
        self.compositor.touch_picture(clip, &self.library);
        Ok(())
    }

    pub fn put_group(&mut self, key: &str, list_json: &str) -> Result<(), JsValue> {
        self.compositor.touch(key, &self.library);
        self.library.put_group(key, &parse(list_json).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn append_group(&mut self, key: &str, list_json: &str) -> Result<(), JsValue> {
        self.library.append_group(key, &parse(list_json).map_err(failed)?);
        self.compositor.touch(key, &self.library);
        Ok(())
    }

    pub fn patch_group(&mut self, from: &str, to: &str, splice_json: &str) -> Result<bool, JsValue> {
        self.compositor.touch(to, &self.library);
        let patched = self.library.patch_group(from, to, &parse_splice(splice_json).map_err(failed)?);
        self.compositor.touch(to, &self.library);
        Ok(patched)
    }

    pub fn drop_group(&mut self, key: &str) {
        self.compositor.touch(key, &self.library);
        self.library.drop_group(key);
    }

    pub fn set_camera(&mut self, x: f64, y: f64, zoom: f64) {
        self.camera = Camera { x, y, zoom };
    }

    pub fn patch_uses(&mut self, patch_json: &str) -> Result<(), JsValue> {
        self.compositor.patch(parse_patch(patch_json).map_err(failed)?, &self.library);
        Ok(())
    }

    pub fn set_overlay(&mut self, items_json: &str) -> Result<(), JsValue> {
        self.compositor.set_overlay(parse_overlay(items_json).map_err(failed)?);
        Ok(())
    }

    pub fn frame(&mut self, now_ms: f64) -> Result<String, JsValue> {
        let mut library = std::mem::take(&mut self.library);
        let mut compositor = std::mem::replace(&mut self.compositor, Compositor::new(0, 0));
        let camera = self.camera;
        let frame = compositor.frame(self, &mut library, camera, now_ms, &mut js_sys::Date::now);
        self.library = library;
        self.compositor = compositor;
        let frame = frame?;
        self.pending = frame.pending;
        Ok(frame.report())
    }

    pub fn cache_pending(&self) -> bool {
        self.pending
    }

    pub fn cache_bytes(&self) -> f64 {
        self.library.cache_bytes() as f64
    }

    fn limits(&self) -> Limits {
        Limits { side: CACHE_SIDE.min(self.width).min(self.height), rasters: RASTERS_PER_DRAW, items: ITEMS_PER_RASTER }
    }

    fn raster(&mut self, list: &DisplayList) -> Result<(GlPicture, Vec<Skipped>), JsValue> {
        let mut surface = GlSurface { renderer: &mut self.renderer, resources: &mut self.resources, canvas: &mut self.canvas, runner: &self.runner, width: self.width, height: self.height, placed: Vec::new() };
        let pictures: Shelf<GlPicture> = self.pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), *v)).collect();
        let layers = prepare(&mut surface, list, &pictures, Blending::Composited)?;
        let skipped = std::cell::RefCell::new(Vec::new());
        let region = Rect::new(0.0, 0.0, list.width as f64, list.height as f64);
        let tex = surface.paint(region, list.background, &|c| skipped.borrow_mut().extend(build_into(c, list, &pictures, &layers)))?;
        for id in std::mem::take(&mut surface.placed) {
            surface.renderer.destroy_image(surface.resources, id);
        }
        let id = self.renderer.upload_image(&mut self.resources, &WebGlTextureWithDimensions { texture: tex.texture.clone(), width: tex.width, height: tex.height });
        Ok((GlPicture { id, size: Size { width: tex.width as f64, height: tex.height as f64 } }, skipped.into_inner()))
    }

    fn hold(&mut self, plan: Plan) -> Result<(DisplayList, Vec<Skipped>), JsValue> {
        for clip in &plan.evicted {
            if let Some(old) = self.cached.remove(clip) {
                self.renderer.destroy_image(&mut self.resources, old.id);
            }
        }
        let mut skipped = plan.skipped;
        for raster in plan.rasters {
            let (picture, missed) = self.raster(&raster.list)?;
            skipped.extend(missed);
            if let Some(old) = self.cached.insert(raster.clip, picture) {
                self.renderer.destroy_image(&mut self.resources, old.id);
            }
        }
        Ok((plan.screen, skipped))
    }

    pub fn draw(&mut self, list_json: &str) -> Result<String, JsValue> {
        let plan = self.library.plan(&parse(list_json).map_err(failed)?, self.limits());
        self.pending = plan.pending;
        let (list, missing) = self.hold(plan)?;
        let pictures: Shelf<GlPicture> = self.pictures.iter().chain(&self.cached).map(|(k, v)| (k.clone(), *v)).collect();
        let mut surface = GlSurface { renderer: &mut self.renderer, resources: &mut self.resources, canvas: &mut self.canvas, runner: &self.runner, width: self.width, height: self.height, placed: Vec::new() };
        let layers = prepare(&mut surface, &list, &pictures, Blending::Composited)?;
        let skipped = std::cell::RefCell::new(Vec::new());
        surface.render(list.background, Affine::IDENTITY, &|c| skipped.borrow_mut().extend(build_into(c, &list, &pictures, &layers)))?;
        let skipped = skipped.into_inner();
        for id in surface.placed {
            surface.renderer.destroy_image(surface.resources, id);
        }
        Ok(report(&[skipped, missing].concat()))
    }
}
