# Output port label clear of the add-beside button

A selected frame showed its output name ("Frame") 16px right of the port, under the 24px "+" button
(8px from the edge), so it read "ame". The name now starts after the button (`ADD_BESIDE` in
`core/chrome.ts`) while the button shows; `GpuFlow` passes `addBeside` to the core chrome and the DOM
fallback (`GpuTileChrome`) shifts its label the same way. Discarded: hiding the label (loses the type hint).
