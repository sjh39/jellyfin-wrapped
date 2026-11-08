#!/bin/sh
# Refuses a commit that would add an API key, a token, an env file or the archive.
# API keys are protected secrets: they belong in ~/.secrets or .env.server, never in git.
#
#   Runs on every commit (.husky/pre-commit, enabled by npm install).
#   Check by hand:          sh scripts/check-secrets.sh            (staged changes)
#                           sh scripts/check-secrets.sh --all      (every tracked file)
set -u
fail=0

if [ "${1:-}" = "--all" ]; then
  files=$(git ls-files)
else
  files=$(git diff --cached --name-only --diff-filter=ACMR)
fi

for f in $files; do
  case "$f" in
    .env.server.example|.env.example) ;;
    .env|.env.*|*/.env|*/.env.*|.secrets/*|*/.secrets/*|*.key|*.sqlite|*.sqlite-wal|*.sqlite-shm)
      echo "check-secrets: refusing to commit $f (secret or local data file)" >&2
      fail=1 ;;
  esac
done

# Content checks only look at added lines (or whole files with --all).
if [ "${1:-}" = "--all" ]; then
  content=$(git grep -n -I -E -e '.' -- $files 2>/dev/null)
else
  content=$(git diff --cached -U0 --diff-filter=ACMR | grep -E '^\+[^+]' || true)
fi

# A TMDB read token (a JWT), or a long key/token value written into code or config.
jwt='eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}'
assigned='(api[_-]?key|apikey|access[_-]?token|secret|password|token)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Fa-f0-9]{32}([^A-Za-z0-9]|$)'
assigned_long='(api[_-]?key|apikey|access[_-]?token|secret|password)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9_-]{24,}["'"'"']'

hits=$(printf '%s\n' "$content" | grep -i -E -e "$jwt" -e "$assigned" -e "$assigned_long" || true)
if [ -n "$hits" ]; then
  echo "check-secrets: this looks like an API key or token:" >&2
  printf '%s\n' "$hits" | cut -c1-120 | sed 's/^/  /' >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "check-secrets: commit blocked. Put keys in ~/.secrets/ and point *_FILE settings at them." >&2
  exit 1
fi
exit 0
