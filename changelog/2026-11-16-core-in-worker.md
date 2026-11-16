# GPU core in a worker (prototype, `?coreWorker=1`)

The WebGPU core can run in a dedicated worker on an OffscreenCanvas, behind `?coreWorker=1`.
Default rendering is unchanged. Design, protocol and measurements in
`docs/design/core-in-worker.md`. Not ready to turn on: a vello panic ("invalid empty image")
appears in worker mode, one zoom flicker dip in 9 runs, and uncapped throughput at 1x CPU is
below the main-thread core.
