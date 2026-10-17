from pathlib import Path
import subprocess


def require_once(text: str, old: str, label: str) -> None:
    if text.count(old) != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {text.count(old)}")


sanitizer = Path("agent/tools/trusted-review-json-sanitizer.mjs")
sanitizer.write_text(
    r'''import { pathToFileURL } from 'node:url';

const NON_WHITESPACE_C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const HAS_NON_WHITESPACE_C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;

const ok = (value, message) => { if (!value) throw new Error(message); };

export function sanitizeTrustedJsonValue(value) {
  if (typeof value === 'string') return value.replace(NON_WHITESPACE_C0, '');
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = sanitizeTrustedJsonValue(value[index]);
    }
    return value;
  }
  if (!value || typeof value !== 'object') return value;

  for (const key of Object.keys(value)) {
    ok(!HAS_NON_WHITESPACE_C0.test(key), `trusted JSON key contains a non-whitespace C0 control: ${JSON.stringify(key)}`);
    value[key] = sanitizeTrustedJsonValue(value[key]);
  }
  return value;
}

function selfTest() {
  const escape = String.fromCharCode(0x1b);
  const bell = String.fromCharCode(0x07);
  const raw = sanitizeTrustedJsonValue({
    note: `reviewed ${escape}]8;;urn:ironshade:trusted-review:test${bell}VISIBLE_REFERENCE${escape}]8;;${bell}`,
  });
  ok(raw.note.includes('VISIBLE_REFERENCE'), 'raw OSC-8 sanitization must preserve visible review text');
  ok(!HAS_NON_WHITESPACE_C0.test(raw.note), 'raw OSC-8 sanitization must remove ESC/BEL bytes');

  const escaped = sanitizeTrustedJsonValue(JSON.parse(String.raw`{"note":"reviewed \u001b]8;;urn:ironshade:trusted-review:test\u0007VISIBLE_REFERENCE\u001b]8;;\u0007"}`));
  ok(escaped.note.includes('VISIBLE_REFERENCE'), 'escaped OSC-8 sanitization must preserve visible review text');
  ok(!HAS_NON_WHITESPACE_C0.test(escaped.note), 'escaped OSC-8 sanitization must remove decoded ESC/BEL bytes');

  const whitespace = sanitizeTrustedJsonValue(JSON.parse(String.raw`{"note":"line 1\nline 2\tcell\rreturn"}`));
  ok(whitespace.note === 'line 1\nline 2\tcell\rreturn', 'legal newline, tab, and carriage-return escapes must be preserved');

  let rejectedRawKey = false;
  try {
    sanitizeTrustedJsonValue({ [`sta${escape}tus`]: 'unsafe' });
  } catch (error) {
    rejectedRawKey = /JSON key/.test(String(error));
  }
  ok(rejectedRawKey, 'raw C0 controls in JSON keys must fail closed instead of collapsing keys');

  let rejectedEscapedKey = false;
  try {
    sanitizeTrustedJsonValue(JSON.parse(String.raw`{"status":"safe","sta\u001btus":"unsafe"}`));
  } catch (error) {
    rejectedEscapedKey = /JSON key/.test(String(error));
  }
  ok(rejectedEscapedKey, 'escaped C0 controls in JSON keys must fail closed instead of collapsing keys');

  const ordinary = sanitizeTrustedJsonValue(JSON.parse('{"status":"safe","note":"ordinary visible text"}'));
  ok(ordinary.status === 'safe' && ordinary.note === 'ordinary visible text', 'ordinary JSON semantics must remain unchanged');
  console.log('TRUSTED_REVIEW_JSON_SANITIZER_SELF_TEST_PASS');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const command = process.argv[2];
  if (command === 'self-test') selfTest();
  else throw new Error('usage: trusted-review-json-sanitizer.mjs self-test');
}
''',
    encoding="utf8",
)

v2 = Path("agent/tools/ao6-trusted-independent-review-v2.mjs")
text = v2.read_text(encoding="utf8")
old = "import { mkdirSync, writeFileSync } from 'node:fs';"
new = "import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';"
require_once(text, old, "fs import")
text = text.replace(old, new, 1)

old = "import { materializeRoadmapGraph, parseRoadmap } from './roadmap-adapter.mjs';"
new = old + "\nimport { sanitizeTrustedJsonValue } from './trusted-review-json-sanitizer.mjs';"
require_once(text, old, "sanitizer import insertion")
text = text.replace(old, new, 1)

old = "if (depth === 0) return JSON.parse(repairJson(source.slice(start, index + 1)));"
new = "if (depth === 0) return sanitizeTrustedJsonValue(JSON.parse(repairJson(source.slice(start, index + 1))));"
require_once(text, old, "parseReview sanitization")
text = text.replace(old, new, 1)

marker = "  const wrappedProof = {\n"
require_once(text, marker, "self-test insertion marker")
addition = r'''  const terminalEscape = String.fromCharCode(0x1b);
  const terminalBell = String.fromCharCode(0x07);
  const visibleReference = 'VISIBLE_REFERENCE';
  const parsedOsc8 = parseReview(`{"note":"reviewed ${terminalEscape}]8;;urn:ironshade:trusted-review:test${terminalBell}${visibleReference}${terminalEscape}]8;;${terminalBell}"}`);
  ok(parsedOsc8.note.includes(visibleReference), 'raw OSC-8 parse must preserve visible review text');
  ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(parsedOsc8.note), 'raw OSC-8 parse must remove ESC/BEL bytes after JSON decoding');
  const parsedEscapedOsc8 = parseReview(String.raw`{"note":"reviewed \u001b]8;;urn:ironshade:trusted-review:test\u0007VISIBLE_REFERENCE\u001b]8;;\u0007"}`);
  ok(parsedEscapedOsc8.note.includes(visibleReference), 'escaped OSC-8 parse must preserve visible review text');
  ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(parsedEscapedOsc8.note), 'escaped OSC-8 parse must remove decoded ESC/BEL bytes');
  let rejectedControlKey = false;
  try {
    parseReview(String.raw`{"status":"safe","sta\u001btus":"unsafe"}`);
  } catch (error) {
    rejectedControlKey = /JSON key/.test(String(error));
  }
  ok(rejectedControlKey, 'C0 controls in decoded JSON keys must fail closed before key normalization');

  const persistedDirectory = '.trusted-review-self-test';
  const persistedResult = { schemaVersion: 1, note: parsedOsc8.note };
  const persistedBody = `<!-- ironshade-independent-review:trusted-main-actions:v1 -->\n<!-- ironshade-independent-review:v1 -->\n\`\`\`json\n${JSON.stringify(persistedResult, null, 2)}\n\`\`\`\n`;
  try {
    persistReviewEvidence({ result: persistedResult, body: persistedBody, directory: persistedDirectory });
    const persistedComment = readFileSync(`${persistedDirectory}/review-comment.md`, 'utf8');
    const persistedJson = readFileSync(`${persistedDirectory}/review-result.json`, 'utf8');
    ok(persistedComment.includes(visibleReference), 'persisted trusted review comment must preserve visible evidence text');
    ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(persistedComment), 'persisted trusted review comment must contain no non-whitespace C0 bytes');
    ok(!persistedComment.includes('\\u001b') && !persistedComment.includes('\\u0007'), 'trusted review controls must be removed before publication serialization');
    const persistedRoundTrip = JSON.parse(persistedJson);
    ok(persistedRoundTrip.note.includes(visibleReference), 'persisted trusted review JSON must remain strict JSON with visible evidence text');
  } finally {
    rmSync(persistedDirectory, { recursive: true, force: true });
  }
'''
text = text.replace(marker, addition + marker, 1)
v2.write_text(text, encoding="utf8")

workflow = Path(".github/workflows/ao6-trusted-independent-review.yml")
text = workflow.read_text(encoding="utf8")
old = "run: node --import ./agent/tools/trusted-review-json-sanitizer.mjs --import ./agent/tools/trusted-independent-review-fetch-compat.mjs agent/tools/trusted-independent-review-v4.mjs run"
new = "run: node --import ./agent/tools/trusted-independent-review-fetch-compat.mjs agent/tools/trusted-independent-review-v4.mjs run"
require_once(text, old, "trusted-review run command")
workflow.write_text(text.replace(old, new, 1), encoding="utf8")

for command in (
    ["node", "agent/tools/trusted-review-json-sanitizer.mjs", "self-test"],
    ["node", "agent/tools/ao6-trusted-independent-review-v2.mjs", "self-test"],
    ["node", "agent/tools/trusted-independent-review-v3.mjs", "self-test"],
    ["node", "agent/tools/trusted-independent-review-v4.mjs", "self-test"],
):
    subprocess.run(command, check=True)
