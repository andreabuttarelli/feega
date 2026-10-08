# Motion preview no longer rolls back mid-turn

During an agent turn the visible player was borrowed by `showFrames`: it loaded
the agent's in-flight doc to capture frames, then restored the editor's `html`,
built from the last saved revision. The agent writes its revision only at turn
end (`turn.ts`), so the user saw the edit, then the old version, until
`pullAgentEdit` pulled the new head.

Now each frames request sets an agent draft the preview shows until the turn
ends and the saved head replaces it. Discarded: writing revisions mid-turn
(changes `baseVersion` semantics and races the user's own saves).
