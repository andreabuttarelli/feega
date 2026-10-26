use std::sync::{Condvar, Mutex};
use std::time::{Duration, Instant};

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
    staged: Vec<Command>,
    commands: Vec<Command>,
    camera_at: Option<Instant>,
    camera: Option<Camera>,
    frame: bool,
    closed: bool,
}

impl Pending {
    fn commit(&mut self) {
        let staged = std::mem::take(&mut self.staged);
        self.commands.extend(staged);
    }

    fn empty(&self) -> bool {
        self.commands.is_empty() && self.camera.is_none() && !self.frame && !self.closed
    }
}

pub struct Batch {
    pub commands: Vec<Command>,
    pub camera_at: Option<Instant>,
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
        self.pending.lock().unwrap().staged.push(command);
    }

    pub fn camera(&self, camera: Camera) {
        let mut pending = self.pending.lock().unwrap();
        pending.commit();
        pending.camera = Some(camera);
        pending.camera_at.get_or_insert_with(Instant::now);
        self.wake.notify_one();
    }

    pub fn frame(&self) {
        let mut pending = self.pending.lock().unwrap();
        pending.commit();
        pending.frame = true;
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
        Batch { commands: std::mem::take(&mut pending.commands), camera_at: pending.camera_at.take(), camera: pending.camera.take(), frame: std::mem::take(&mut pending.frame), closed: pending.closed }
    }
}
