use std::sync::{Condvar, Mutex};
use std::time::Duration;

use gpu_core::retained::Camera;

const IDLE_WAKE: Duration = Duration::from_secs(1);

pub enum Command {
    Picture { clip: String, rgba: Vec<u8>, width: u32, height: u32 },
    PutGroup { key: String, json: String },
    AppendGroup { key: String, json: String },
    PatchGroup { from: String, to: String, json: String },
    DropGroup(String),
    PatchUses(String),
    SetOverlay(String),
    Snapshot(String),
}

#[derive(Default)]
struct Pending {
    commands: Vec<Command>,
    camera: Option<Camera>,
    frame: bool,
    closed: bool,
}

impl Pending {
    fn empty(&self) -> bool {
        self.commands.is_empty() && self.camera.is_none() && !self.frame && !self.closed
    }
}

pub struct Batch {
    pub commands: Vec<Command>,
    pub camera: Option<Camera>,
    pub frame: bool,
    pub closed: bool,
}

#[derive(Default)]
pub struct Inbox {
    pending: Mutex<Pending>,
    wake: Condvar,
}

impl Inbox {
    pub fn send(&self, command: Command) {
        self.pending.lock().unwrap().commands.push(command);
        self.wake.notify_one();
    }

    pub fn camera(&self, camera: Camera) {
        self.pending.lock().unwrap().camera = Some(camera);
        self.wake.notify_one();
    }

    pub fn frame(&self) {
        self.pending.lock().unwrap().frame = true;
        self.wake.notify_one();
    }

    pub fn close(&self) {
        self.pending.lock().unwrap().closed = true;
        self.wake.notify_one();
    }

    pub fn take(&self, patience: Option<Duration>) -> Batch {
        let mut pending = self.pending.lock().unwrap();
        if pending.empty() {
            pending = self.wake.wait_timeout(pending, patience.unwrap_or(IDLE_WAKE)).unwrap().0;
        }
        Batch { commands: std::mem::take(&mut pending.commands), camera: pending.camera.take(), frame: std::mem::take(&mut pending.frame), closed: pending.closed }
    }
}
