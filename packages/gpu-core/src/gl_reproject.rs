use vello::kurbo::Rect;
use web_sys::{WebGl2RenderingContext as Gl, WebGlFramebuffer, WebGlProgram, WebGlTexture};

use crate::gl_passes::{texture, Tex};
use crate::retained::Lookup;

const VERTEX: &str = "#version 300 es
void main() {
  vec2 p = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 4.0 - 1.0;
  gl_Position = vec4(p, 0.0, 1.0);
}";

const FRAGMENT: &str = "#version 300 es
precision highp float;
uniform highp sampler2D source;
uniform vec2 scale;
uniform vec2 offset;
uniform vec2 size;
out vec4 color;
void main() {
  vec2 px = gl_FragCoord.xy * scale + offset;
  bool inside = all(greaterThanEqual(px, vec2(0.0))) && all(lessThanEqual(px, size));
  color = inside ? texture(source, px / size) : vec4(0.0);
}";

pub struct Held {
    pub tex: Tex,
    pub fbo: WebGlFramebuffer,
}

pub struct Target<'a> {
    pub fbo: Option<&'a WebGlFramebuffer>,
    pub width: u32,
    pub height: u32,
    pub within: Option<Rect>,
}

pub struct GlReprojector {
    gl: Gl,
    program: WebGlProgram,
}

fn compiled(gl: &Gl, kind: u32, source: &str) -> web_sys::WebGlShader {
    let s = gl.create_shader(kind).expect("a shader");
    gl.shader_source(&s, source);
    gl.compile_shader(&s);
    s
}

pub fn smooth(gl: &Gl, tex: &WebGlTexture) {
    gl.bind_texture(Gl::TEXTURE_2D, Some(tex));
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MIN_FILTER, Gl::LINEAR as i32);
    gl.tex_parameteri(Gl::TEXTURE_2D, Gl::TEXTURE_MAG_FILTER, Gl::LINEAR as i32);
}

pub fn held(gl: &Gl, (width, height): (u32, u32)) -> Held {
    let tex = texture(gl, width, height);
    smooth(gl, &tex.texture);
    let fbo = gl.create_framebuffer().expect("a framebuffer");
    gl.bind_framebuffer(Gl::FRAMEBUFFER, Some(&fbo));
    gl.framebuffer_texture_2d(Gl::FRAMEBUFFER, Gl::COLOR_ATTACHMENT0, Gl::TEXTURE_2D, Some(&tex.texture), 0);
    gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
    Held { tex, fbo }
}

impl GlReprojector {
    pub fn new(gl: &Gl) -> Self {
        let program = gl.create_program().expect("a program");
        gl.attach_shader(&program, &compiled(gl, Gl::VERTEX_SHADER, VERTEX));
        gl.attach_shader(&program, &compiled(gl, Gl::FRAGMENT_SHADER, FRAGMENT));
        gl.link_program(&program);
        GlReprojector { gl: gl.clone(), program }
    }

    pub fn draw(&self, source: &Tex, look: Lookup, target: Target) {
        let gl = &self.gl;
        let up = look.bottom_up(source.height as f64, target.height as f64);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width as i32, target.height as i32);
        for cap in [Gl::BLEND, Gl::SCISSOR_TEST, Gl::DEPTH_TEST, Gl::STENCIL_TEST] {
            gl.disable(cap);
        }
        if let Some(r) = target.within {
            gl.enable(Gl::SCISSOR_TEST);
            gl.scissor(r.x0 as i32, (target.height as f64 - r.y1) as i32, r.width() as i32, r.height() as i32);
        }
        gl.color_mask(true, true, true, true);
        gl.bind_vertex_array(None);
        gl.use_program(Some(&self.program));
        gl.active_texture(Gl::TEXTURE0);
        gl.bind_texture(Gl::TEXTURE_2D, Some(&source.texture));
        let at = |name: &str| gl.get_uniform_location(&self.program, name);
        gl.uniform1i(at("source").as_ref(), 0);
        gl.uniform2f(at("scale").as_ref(), up.scale as f32, up.scale as f32);
        gl.uniform2f(at("offset").as_ref(), up.x as f32, up.y as f32);
        gl.uniform2f(at("size").as_ref(), source.width as f32, source.height as f32);
        gl.draw_arrays(Gl::TRIANGLES, 0, 3);
        gl.disable(Gl::SCISSOR_TEST);
        gl.bind_framebuffer(Gl::FRAMEBUFFER, None);
    }
}
