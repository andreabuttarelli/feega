# Self-check no longer forces a tool on models that refuse it

Without reasoning, the motion self-check round forced `tool_choice: view_frames`.
Opus 5.5 (default motion model) and Sonnet 5.5 answer 400 to a forced tool
("type tool and any are not supported for this model"), so the round failed.

Each motion model now declares `ToolForcing` in the single table in
`chat-model/catalogue.ts` (probed live on the gateway: Opus 5.5 and Sonnet 5.5
refuse, Opus 5 and GPT-5.6 accept; `none` is accepted by all). Refusing or
unknown models get `auto`: the self-check user turn already asks for
`view_frames`, and `deliveryBlocked` re-runs the round when no look followed the
last edit. Live check: Opus 5.5 with `auto` and that prompt calls `view_frames`.

The other chat agents never force a tool; only the summary round sends `none`.
