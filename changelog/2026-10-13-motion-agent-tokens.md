# Motion agent: fewer tokens per step

Measured offline (chars/4): every model step of the builder resends ~12.5k tokens of system
prompt and ~34k of tool schemas (148 tools; director 12 tools/3.8k, shot-builder 35/7.8k).
Anthropic caching (top-level `cache_control`) covers that prefix and the history, so run1's
1.6–6.6M tokens per video are mostly cache reads; what grows is the history each step carries.

Two cuts, no behaviour change for the model:

- `get_motion_doc` (and the docs returned by batch/restore) omit clip fields at their default;
  the tool description lists the defaults. 8 Title clips: 7.3k → 4.0k chars (−45%).
- Only the latest `view_frames` keeps its pictures in the conversation; older views become
  "[frames already inspected]". User attachments stay. Each view is ~8 JPEGs that were
  otherwise resent on every following step.

Not done: the Edit/Code tier switch changes `activeTools`, which invalidates the cached tool
prefix at every switch; sending one stable tool list would fix it but lets edit steps call
code tools, a quality change that needs an eval.
