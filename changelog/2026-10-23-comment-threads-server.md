# Comment edit, delete, time, mentions (server)

Groundwork for the comment follow-ups of #757.

- `canvas_comments` gains `time_ms` (a moment of a motion frame), `edited_at` and `mentions`
  (`uuid[]`), in `20261023160000_canvas_comments_threads.sql`.
- `20261023160100_canvas_comments_realtime.sql` adds the table to `supabase_realtime` with
  `replica identity full`. Kept apart from the columns so it can be applied, and reverted, on its
  own; the client works without it (it refreshes on focus and after each own write).
- `editComment` / `deleteComment`: only the author (`author_id = actor.id`, so an agent edits what
  it wrote for its user). Delete is soft; deleting a thread's first comment hides the thread
  because replies without a live root are never listed.
- Mentions are filtered to members of the org in `addComment` / `editComment`, so a forged id is
  dropped, not stored. `teammates` feeds the mention picker and `list_canvas_comments`.
- Agents: `edit_canvas_comment`, `delete_canvas_comment`; `add_canvas_comment` takes `timeMs` and
  `mentions`; replies were already `parentId`. Page actions `editComment` / `deleteComment` map
  to them in `ui-actions.ts`.
