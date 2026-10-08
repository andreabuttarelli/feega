# /promote blocked when social publishing is off

PR #279 hid the Promote button and blocked /ads, but `/p/[projectId]/promote`
still opened when typed. Added to `SOCIAL_PUBLISHING_SURFACE.routes`; its
form actions (`propose_ad`) live on the same route, so the prefix covers them.
The test that asserted `?/propose_ad` was allowed now asserts it is refused.
