#!/usr/bin/env bash
# Self-tests for scrub-gate.sh.
# Run: ./scripts/scrub-gate.test.sh
# Exit: 0 all pass · 1 any fail

set -uo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
GATE="$REPO_ROOT/scripts/scrub-gate.sh"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

PASS=0
FAIL=0

assert_exit() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS  $desc (exit=$actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $desc (expected exit=$expected, got=$actual)"
    FAIL=$((FAIL + 1))
  fi
}

# Case 1: clean message → exit 0
cat > "$TMPDIR/clean.txt" <<'EOF'
feat(x): add something benign

This is a perfectly clean commit message with no scrub-terms.
EOF
"$GATE" "$TMPDIR/clean.txt" >/dev/null 2>&1
assert_exit "clean message" 0 $?

# Case 2: generic leak (Claude) → exit 1
cat > "$TMPDIR/claude.txt" <<'EOF'
feat(x): did a thing

Co-authored by Claude.
EOF
"$GATE" "$TMPDIR/claude.txt" >/dev/null 2>&1
assert_exit "Claude leak" 1 $?

# Case 3: generic leak (TODO in prose) → exit 1
cat > "$TMPDIR/todo.txt" <<'EOF'
feat(x): add stub

TODO: implement the rest later.
EOF
"$GATE" "$TMPDIR/todo.txt" >/dev/null 2>&1
assert_exit "TODO leak" 1 $?

# Case 4: narrative Before:/After: prose → exit 0 (trailer-check warn-only)
cat > "$TMPDIR/before-after.txt" <<'EOF'
fix(x): change behavior

Before: old behavior.
After: new behavior.
EOF
"$GATE" "$TMPDIR/before-after.txt" >/dev/null 2>&1
assert_exit "Before/After prose (trailer warn only)" 0 $?

# Case 5: SHA references → exit 0 (info-only)
cat > "$TMPDIR/sha.txt" <<'EOF'
fix(x): revert bad change

This undoes commit deadbeef12345678.
EOF
"$GATE" "$TMPDIR/sha.txt" >/dev/null 2>&1
assert_exit "SHA reference (info only)" 0 $?

# Case 6: missing message file → exit 2
"$GATE" "$TMPDIR/nonexistent-file.txt" >/dev/null 2>&1
assert_exit "missing message file" 2 $?

# Case 7: comment lines in message are stripped before scrub (commit-msg-style)
cat > "$TMPDIR/comments.txt" <<'EOF'
feat(x): normal commit

# This is a comment from git's commit-message-template.
# Claude would normally be flagged here, but comments are stripped.
EOF
"$GATE" "$TMPDIR/comments.txt" >/dev/null 2>&1
assert_exit "comment lines stripped" 0 $?

echo ""
echo "scrub-gate tests: $PASS passed · $FAIL failed"
[[ $FAIL -eq 0 ]]
