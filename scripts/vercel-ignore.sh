#!/usr/bin/env bash
readonly SKIP=0
readonly BUILD=1
readonly OPT_IN='[preview]'

if [[ "$VERCEL_ENV" != production && "$VERCEL_GIT_COMMIT_MESSAGE" != *"$OPT_IN"* ]]; then
  exit "$SKIP"
fi

if [[ $# -gt 0 ]] && git diff --quiet HEAD^ HEAD -- "$@"; then
  exit "$SKIP"
fi

exit "$BUILD"
