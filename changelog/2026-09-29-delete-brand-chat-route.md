# Delete the old brand chat route

`/api/v1/brands/[slug]/agent` and `brand-agent/thread.ts`/`turns.ts` wrote
`chat_threads.user_id` and `chat_messages.brand_id/user_id`, columns the new
schema dropped, so every call returned 500. Since 59479b1e the chat always
uses `/api/v1/projects/[projectId]/agent`; nothing called this route.
`agent/assets` stays: the drag panels use it.
