#!/bin/sh
set -u

hook=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/commit-msg
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

failures=0

check() {
  printf '%b' "$3" >"$work/message"
  if sh "$hook" "$work/message" >/dev/null 2>&1; then
    got=accepted
  else
    got=rejected
  fi
  [ "$got" = "$2" ] || {
    printf 'FAIL  %s: %s, wanted %s\n' "$1" "$got" "$2" >&2
    failures=$((failures + 1))
  }
}

pass() { check "$1" accepted "$2"; }
fail() { check "$1" rejected "$2"; }

fill() { printf 'a%.0s' $(seq 1 "$1"); }

pass "a title alone" "feat(popover): open the port from the row"
pass "two hundred characters" "$(fill 200)\n"
pass "two hundred characters with an accent" "$(fill 199)á\n"
pass "the empty message git refuses on its own" "# a comment\n\n"
pass "a merge with a body" "Merge branch 'feature/long-name'\n\n$(fill 300)\n"
pass "a fixup of a long title" "fixup! $(fill 250)\n"
pass "a squash of a long title" "squash! $(fill 250)\n"
pass "a revert" "Revert \"feat(popover): something\"\n"

fail "two hundred and one characters" "$(fill 201)\n"
fail "a body under the title" "feat(popover): a title\n\nand then a paragraph\n"
fail "a co-author trailer" "feat(popover): a title\n\nCo-Authored-By: X <x@example.com>\n"
fail "a generated-by footer" "feat(popover): a title\n\nGenerated with Codebuff\n"

if [ "$failures" -eq 0 ]; then
  printf 'commit-msg: 12 cases, all as expected\n'
  exit 0
fi

printf 'commit-msg: %s cases failed\n' "$failures" >&2
exit 1
