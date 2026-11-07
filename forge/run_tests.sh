#!/bin/sh
# Rebuilds Forge from the hex chain and runs every test.
# Exit status 0 = everything verified. Any failed check stops the script with status 1.
set -e
cd "$(dirname "$0")"

tmp=$(mktemp)
trap 'rm -f "$tmp" hex0.rebuilt hex1.rebuilt forge.rebuilt' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

# same LABEL ACTUAL EXPECTED: byte-for-byte comparison that stops the script on a mismatch.
# (A bare "cmp ... && echo ok" does not stop under set -e when cmp fails, so it is not used.)
same() { cmp -s "$2" "$3" || fail "$1 differs from $3"; echo "$1 identical to $3"; }

# rpn_test LABEL EXPECTED_LAST_LINE_SUBSTRING ARGS...
# Runs ./forge with ARGS and fails on a nonzero exit status, any "FAIL" in the output,
# empty output, or (when EXPECTED is not empty) a last line that lacks the expected text.
rpn_test() {
    label=$1; expect=$2; shift 2
    rc=0
    out=$(./forge "$@" 2>/dev/null) || rc=$?
    last=$(printf '%s\n' "$out" | tail -n 1)
    echo "$label: $last"
    case "$out" in *FAIL*) fail "$label printed FAIL";; esac
    [ "$rc" -eq 0 ] || fail "$label exited with status $rc"
    [ -n "$last" ] || fail "$label printed nothing"
    if [ -n "$expect" ]; then
        case "$last" in *"$expect"*) ;; *) fail "$label: last line does not contain '$expect'";; esac
    fi
}

echo "== rebuild chain: hex0.hex -> hex0 -> hex1 -> forge"
./hex0 < hex0.hex > hex0.rebuilt || fail "running hex0 on hex0.hex"
same "hex0 rebuilt by hex0" hex0.rebuilt hex0
./hex0 < hex1.hex0 > hex1.rebuilt || fail "running hex0 on hex1.hex0"
chmod +x hex1.rebuilt
same "hex1 rebuilt by hex0" hex1.rebuilt hex1
./hex1.rebuilt < forge.hex1 > forge.rebuilt || fail "running hex1 on forge.hex1"
chmod +x forge.rebuilt
same "forge rebuilt by hex1" forge.rebuilt forge
rm -f hex0.rebuilt hex1.rebuilt forge.rebuilt

echo "== RPN core library tests"
rpn_test "test_core.fg" "all core tests passed" core.fg test_core.fg
echo "== RPN language tests"
rpn_test "test_lang.fg" "all language tests passed" core.fg test_lang.fg

echo "== 0.1 regression suite"
./forge < test_full.in > "$tmp" 2>/dev/null || true
same "0.1 regression suite" "$tmp" expected/test_full.out
echo "== error recovery"
./forge core.fg < test_errors.in > "$tmp" 2>&1 || true
same "error recovery" "$tmp" expected/test_errors.out

echo "== RPN demos"
for d in orbit piston meta; do
    ./forge core.fg examples/$d.fg > "$tmp" 2>/dev/null || true
    same "$d.fg" "$tmp" expected/$d.out
done
rm -f render.ppm
./forge core.fg examples/render.fg >/dev/null 2>&1 || true
[ -f render.ppm ] || fail "render.fg did not write render.ppm"
same "render.fg" render.ppm expected/render.ppm
rm -f render.ppm

echo "== Python-layer runtime unit tests (lang/rt.fg)"
rpn_test "tests/rt1.fg" "" core.fg lang/rt.fg tests/rt1.fg
rpn_test "tests/rt2.fg" "" core.fg lang/rt.fg tests/rt2.fg
rpn_test "tests/rt3.fg" "" core.fg lang/rt.fg tests/rt3.fg
rpn_test "tests/rt4.fg" "ops ok" core.fg lang/rt.fg tests/rt4.fg

echo "== Python-syntax programs vs CPython expected output (tests/py/*.py)"
for f in tests/py/*.py; do
    ./boot.sh "$f" 2>&1 | grep -v '^Forge 1.0' > "$tmp" || true
    same "$(basename "$f")" "$tmp" "${f%.py}.expected"
done

echo "ALL TESTS PASSED"
