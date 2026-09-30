# Audio node ports follow the operation

The audio node had static ports (Text, Video, Audio in; Audio out) regardless of
`params.operation` — a `music` node showed video/audio input handles that
`audioInputProblem`/`runAudio` would refuse anyway, and nothing stopped connecting a video into a
`text_to_speech` node until the run itself rejected it.

- **One table, moved up**: `AUDIO_OPERATIONS` (`audio-operations.ts`) now carries `inputPorts`/
  `outputPorts` per operation, alongside the existing `source`/`needsVoice`/`duration` fields —
  the same table `runAudio` already reads, so ports and server validation can never diverge.
  `audioInputPorts`/`audioOutputPorts`/`audioInputMediums` are the accessors.
- **`node-ports.ts`**: `audio`'s row moved from a static `ConnectorType[]` to a new
  `InputRule.Audio`/`OutputRule.Audio`, resolved from `PortContext.audioOperation()` — the same
  shape every other operation-dependent port (`select`'s item port, `effects`'s media kind)
  already uses.
- **`graph.ts` (`canConnect`)**: `CanvasNode` gained an `operation` field for audio nodes.
  `acceptsOf(node)` reads `audioInputMediums(operation)` for `kind === 'audio'` instead of the
  static `CANVAS_NODE_SPECS.audio.accepts` — the refusal now names the operation
  (`"video cannot feed a audio node for text_to_speech"`).
- **Server-side refusal, not just the client**: `connectVerdict`/`canvasNodeOf`
  (`node-model.ts`) run the same `canConnect` against `nodes.type`/`data`, called from the app's
  `connect` action (`+page.server.ts`) and the `connect_nodes` MCP/chat tool
  (`project-tools.ts`) — an agent could connect a video into a `text_to_speech` node before,
  since only the uncensored-model check existed server-side.
- **Switching operation with wired edges**: `AudioControls` now emits `onoperation` instead of
  writing the patch itself; the page computes which wired edges the new operation's ports no
  longer accept (`orphanedByModelChange`, already used for a model switch), asks for confirmation
  through the same `ConfirmDialog` pattern as the uncensored-model switch when any exist, and
  disconnects only those — compatible edges stay wired.

Dubbing declares both `audios` and `videos` in `outputPorts` (a video source produces a dubbed
video asset, matching `audio-run.ts`), but the canvas draws one output handle per node like every
other generative node — `OutputRule.Audio` takes the first (primary) port. A second drawn output
handle is not something any node has today (`select`'s custom outputs are a named-output
mechanism, not typed connector ports); adding one would be new UI surface, not a port following
its operation.
