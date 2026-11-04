# `start_from` links start the website import

Shared links used `?start_from=stripe.com`, but only `start_url` was read: the param was ignored and the visitor landed on `/app`. `startUrlRedirect` now rewrites `start_from` to `start_url` on the same path before anything else, so signed-out (login/signup/OAuth) and signed-in entries follow the existing `start_url` flow and its validation. Rejected: teaching every reader (`rememberStartUrl`, login, canvas page) a second name.
