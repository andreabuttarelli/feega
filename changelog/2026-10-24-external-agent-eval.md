# External agent comparison eval

**Before:** nothing measured an outside agent (Claude with tools) making a video through feega's MCP
tools against the same agent writing code from scratch.

**Now:** `npm run eval:external-agent` runs one task twice with the same model (Haiku 5.5 through
OpenRouter): (a) feega MCP tools on a throwaway project in test@dazero.co's org, deleted at the
end, rendered through the browser render link; (b) Remotion in a temp dir, rendered locally. It
records success, wall time, turns, tool calls, tokens, cost and a vision-judge score against the
anchors in `scripts/eval/motion-quality/anchors`. Output in
`~/Documents/feega-videos/evals/external-agent-<date>/`. Hard cap $8, per arm $3.50.
`--rejudge=<dir>` re-scores saved videos without re-running the agents.

**Decisions:** `ask_motion_agent` is withheld, so both arms spend only the outside agent's tokens;
the in-app agent's spend would not show in the OpenRouter cost. Both arms get the same site facts
(title, description, headings) because neither can browse. Remotion install and browser download
are excluded from wall time. A session for the test account is minted with the service-role key.

**First run (one run, one sample):** both arms produced a valid 1920x1080 9 s file. feega: 350 s,
23 turns, 14 tool errors of 33 calls, $0.096; Remotion: 71 s, 4 turns, $0.005. Judge 3.4 against 6.0.
The feega arm re-sent the 51-tool list on every turn (1.3M input tokens, 463k cached).

**Not done:** transcripts are not saved, so the 14 errors were not read; a run is one sample.
