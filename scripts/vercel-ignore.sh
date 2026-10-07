#!/usr/bin/env bash
readonly SKIP=0
readonly BUILD=1
readonly OPT_IN='[preview]'
readonly watched="${1:-}"

if [[ "$VERCEL_ENV" != production && "$VERCEL_GIT_COMMIT_MESSAGE" != *"$OPT_IN"* ]]; then
  exit "$SKIP"
fi

if [[ -n "$watched" ]] && git diff --quiet HEAD^ HEAD -- "$watched"; then
  exit "$SKIP"
fi

exit "$BUILD"
