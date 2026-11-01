import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, hasHeredoc } from "../.claude/hooks/guard-bash.mjs";

const refused = (c: string) => decide(c, "heredoc")?.decision === "deny";

test("a heredoc is refused, however it is spelled", () => {
  for (const c of [
    "cat > f.txt <<EOF\nhello\nEOF",
    "python - <<'PY'\nprint(1)\nPY",
    'python - <<"PY"\nprint(1)\nPY',
    "cat <<-EOF\n\thello\n\tEOF",
    "cat <<\\EOF\nhello\nEOF",
    "cd x && cat <<EOF > y\nz\nEOF",
    "python <<PY\nprint('it\\'s')\nPY",
    "cat << EOF\nx\nEOF",
  ]) {
    assert.ok(refused(c), c);
  }
});

test("here-strings, arithmetic, and the same characters inside a quoted string are left alone", () => {
  for (const c of [
    "grep x <<< \"text\"",
    "echo $((1<<3))",
    "echo $(( 1 << 3 ))",
    "git commit -m \"Never use <<EOF in Bash\"",
    "printf '%s\\n' 'a heredoc (<<EOF) fails' > \"$TEMP/msg.txt\"",
    "echo 'cat <<EOF'",
    "ls -la",
    "npx tsx scripts/x.ts",
    "python \"$TEMP/edit.py\" && git status",
    "x=$(cat file) && echo \"$x\"",
  ]) {
    assert.equal(refused(c), false, c);
  }
});

test("the refusal tells Claude what to do instead", () => {
  const r = decide("cat <<EOF\nx\nEOF", "heredoc");
  assert.ok(r);
  assert.match(r.reason, /Write tool/);
  assert.match(r.reason, /git commit -F/);
});

test("the other guards still do their own work", () => {
  assert.equal(decide("cat <<EOF\nx\nEOF", "push"), null);
  assert.equal(decide("cat <<EOF\nx\nEOF", "live"), null);
  assert.equal(decide("git push", "heredoc"), null);
  assert.equal(hasHeredoc(""), false);
});
