# Canvas core no longer switches off on load

#1069 shadowed `hovered` with a local of the same name inside the chrome
derivation in `GpuFlow.svelte`, reading it in its own initializer: a TDZ
error turned the core renderer off. The Pixi fallback then threw on every
surface missing from `BUILD` in `scene.ts`; those now draw the blank panel.
