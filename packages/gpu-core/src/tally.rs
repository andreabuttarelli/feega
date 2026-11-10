use std::fmt::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reason {
    Screen,
    Raster,
    Body,
    Mask,
    Matte,
    Backdrop,
    Lens,
    Composited,
}

const REASONS: [Reason; 8] = [Reason::Screen, Reason::Raster, Reason::Body, Reason::Mask, Reason::Matte, Reason::Backdrop, Reason::Lens, Reason::Composited];

impl Reason {
    fn name(self) -> &'static str {
        match self {
            Reason::Screen => "screen",
            Reason::Raster => "raster",
            Reason::Body => "body",
            Reason::Mask => "mask",
            Reason::Matte => "matte",
            Reason::Backdrop => "backdrop",
            Reason::Lens => "lens",
            Reason::Composited => "composited",
        }
    }

    fn slot(self) -> usize {
        REASONS.iter().position(|r| *r == self).unwrap_or(0)
    }
}

#[derive(Debug, Default, Clone)]
pub struct Tally {
    counts: [u32; REASONS.len()],
    ms: [f64; REASONS.len()],
}

impl Tally {
    pub fn add(&mut self, reason: Reason, ms: f64) {
        self.counts[reason.slot()] += 1;
        self.ms[reason.slot()] += ms;
    }

    pub fn count(&self, reason: Reason) -> u32 {
        self.counts[reason.slot()]
    }

    pub fn total(&self) -> u32 {
        self.counts.iter().sum()
    }

    pub fn json(&self) -> String {
        let mut out = String::from("{");
        for (i, reason) in REASONS.iter().enumerate() {
            let sep = if i == 0 { "" } else { "," };
            let _ = write!(out, r#"{sep}"{}":{{"n":{},"ms":{:.3}}}"#, reason.name(), self.counts[i], self.ms[i]);
        }
        out.push('}');
        out
    }
}

#[cfg(target_arch = "wasm32")]
mod clock {
    use wasm_bindgen::prelude::wasm_bindgen;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = performance, js_name = now)]
        fn performance_now() -> f64;
    }

    pub fn now_ms() -> f64 {
        performance_now()
    }
}

#[cfg(not(target_arch = "wasm32"))]
mod clock {
    use std::sync::OnceLock;
    use std::time::Instant;

    static START: OnceLock<Instant> = OnceLock::new();

    pub fn now_ms() -> f64 {
        START.get_or_init(Instant::now).elapsed().as_secs_f64() * 1000.0
    }
}

pub use clock::now_ms;
