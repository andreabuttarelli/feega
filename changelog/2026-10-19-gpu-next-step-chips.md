# Next-step chips work again on the GPU canvas

#863 renamed `CanvasFlow`'s `actionUrl` prop to `postAction`; `GpuFlow`, which takes the same
props, still read `actionUrl`, so on the GPU renderer the chips never appeared. A source test now
checks that both renderers hand the chips `postAction`.
