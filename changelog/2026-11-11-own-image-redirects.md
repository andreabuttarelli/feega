# Own-origin image fetch: no foreign redirects, capped read

`ownImages` fetched images on the imported app's origin with a bare `fetch`: redirects were followed to any host (SSRF) and the body was read whole before the size check.

Now redirects are resolved by hand (max 3 hops) and only within the allowed origins; any other target returns null. `content-length` over the cap is refused and the body is read as a stream aborted at the cap, reusing `readAllOrReject` from `tool-guard` (now exported). Host rules of `safeFetchBytes` are unchanged.
