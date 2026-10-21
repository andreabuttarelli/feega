# The editor preview draws with the GPU core by default

The motion editor preview now uses `gpu-core` unless the URL says `?engine=html` or the kill switch (`motion-engine-html` flag or env `html`) is on. Interactive docs still force HTML. Export is unchanged and still renders with the HTML engine.
