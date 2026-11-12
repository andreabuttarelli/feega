# Perf: the zoom bench says "not measured" on runners without a GPU

The `zoom` job has measured 0–1 fps with 8–16 s frames on every branch since it was added: GitHub's
hosted runners have no GPU, so WebGPU runs in SwiftShader, and the job compared that against a
baseline recorded on a Mac. It was continue-on-error and always red, which read as a regression.
The bench now records the WebGPU adapter; on a software adapter (SwiftShader, llvmpipe) it skips
the runs and `zoom-compare.mjs` writes "not measured" and exits 0. On a machine with a GPU nothing
changes.
