mod inbox;
mod painter;
mod priority;
mod view;
mod worker;

use std::sync::{Arc, Mutex};
use std::time::Instant;

use gpu_core::retained::Camera;
use napi::bindgen_prelude::Buffer;
use napi::threadsafe_function::{ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, JsFunction};
use napi_derive::napi;

use inbox::{Command, Inbox};
use view::{Layers, Placement};
use worker::{Link, Stats};

#[napi(object)]
pub struct Where {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl From<&Where> for Placement {
    fn from(at: &Where) -> Placement {
        Placement { x: at.x, y: at.y, width: at.width, height: at.height }
    }
}

fn refused(reason: String) -> napi::Error {
    napi::Error::from_reason(reason)
}

#[napi]
pub struct NativeCanvas {
    layers: Layers,
    inbox: Arc<Inbox>,
    stats: Arc<Mutex<Stats>>,
}

#[napi]
impl NativeCanvas {
    #[napi(constructor)]
    pub fn new(env: Env, window: Buffer, at: Where, width: u32, height: u32, background: Vec<f64>, report: JsFunction) -> napi::Result<Self> {
        let started = Instant::now();
        let colour: [f64; 3] = background.try_into().map_err(|_| refused("background needs red, green, blue".into()))?;
        let layers = Layers::attach(&window, &(&at).into(), colour).map_err(refused)?;
        let gpu = layers.gpu((width, height)).map_err(refused)?;

        let mut tsfn: ThreadsafeFunction<String> = report.create_threadsafe_function(0, |context: ThreadSafeCallContext<String>| Ok(vec![context.value]))?;
        tsfn.unref(&env)?;
        let inbox = Arc::new(Inbox::default());
        let stats = Arc::new(Mutex::new(Stats::default()));
        let notify = Box::new(move |message: String| {
            tsfn.call(Ok(message), ThreadsafeFunctionCallMode::NonBlocking);
        });
        worker::spawn(gpu, (width, height), Link { inbox: inbox.clone(), stats: stats.clone(), report: notify, started });
        Ok(NativeCanvas { layers, inbox, stats })
    }

    #[napi]
    pub fn picture(&self, clip: String, rgba: Buffer, width: u32, height: u32) {
        self.inbox.send(Command::Picture { clip, rgba: rgba.to_vec(), width, height });
    }

    #[napi]
    pub fn put_group(&self, key: String, json: String) {
        self.inbox.send(Command::PutGroup { key, json });
    }

    #[napi]
    pub fn append_group(&self, key: String, json: String) {
        self.inbox.send(Command::AppendGroup { key, json });
    }

    #[napi]
    pub fn patch_group(&self, from: String, to: String, json: String) {
        self.inbox.send(Command::PatchGroup { from, to, json });
    }

    #[napi]
    pub fn drop_group(&self, key: String) {
        self.inbox.send(Command::DropGroup(key));
    }

    #[napi]
    pub fn patch_uses(&self, json: String) {
        self.inbox.send(Command::PatchUses(json));
    }

    #[napi]
    pub fn set_overlay(&self, json: String) {
        self.inbox.send(Command::SetOverlay(json));
    }

    #[napi]
    pub fn snapshot(&self, path: String) {
        self.inbox.send(Command::Snapshot(path));
    }

    #[napi]
    pub fn set_camera(&self, x: f64, y: f64, zoom: f64) {
        self.inbox.camera(Camera { x, y, zoom });
    }

    #[napi]
    pub fn frame(&self) {
        self.inbox.frame();
    }

    #[napi]
    pub fn place(&self, at: Where) {
        self.layers.place(&(&at).into());
    }

    #[napi]
    pub fn stats(&self) -> String {
        let mut stats = self.stats.lock().unwrap();
        let presents = std::mem::take(&mut stats.presents);
        let work = std::mem::take(&mut stats.work_ms);
        serde_json::json!({ "presents": presents, "work": work, "firstFrameMs": stats.first_frame_ms, "error": stats.error }).to_string()
    }

    #[napi]
    pub fn close(&self) {
        self.inbox.close();
        self.layers.remove();
    }
}
