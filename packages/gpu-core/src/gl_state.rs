pub trait Switches {
    fn is_on(&self, cap: u32) -> bool;
    fn set(&self, cap: u32, on: bool);
}

pub fn isolated<S: Switches, R>(gl: &S, caps: &[u32], pass: impl FnOnce() -> R) -> R {
    let found: Vec<(u32, bool)> = caps.iter().map(|&cap| (cap, gl.is_on(cap))).collect();
    for &cap in caps {
        gl.set(cap, false);
    }

    let out = pass();

    for (cap, on) in found {
        gl.set(cap, on);
    }
    out
}
