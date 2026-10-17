import { pathToFileURL } from 'node:url';

const NON_WHITESPACE_C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const HAS_NON_WHITESPACE_C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const INSTALL_KEY = Symbol.for('ironshade.trustedReviewJsonSanitizerInstalled');
const originalJsonParse = JSON.parse.bind(JSON);

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

export function installTrustedReviewJsonSanitizer() {
  if (globalThis[INSTALL_KEY]) return;
  JSON.parse = function trustedReviewJsonParse(text, reviver) {
    return sanitizeTrustedJsonValue(originalJsonParse(text, reviver));
  };
  globalThis[INSTALL_KEY] = true;
}

function selfTest() {
  const escape = String.fromCharCode(0x1b);
  const bell = String.fromCharCode(0x07);
  const raw = sanitizeTrustedJsonValue({
    note: `reviewed ${escape}]8;;urn:ironshade:trusted-review:test${bell}VISIBLE_REFERENCE${escape}]8;;${bell}`,
  });
  ok(raw.note.includes('VISIBLE_REFERENCE'), 'raw OSC-8 sanitization must preserve visible review text');
  ok(!HAS_NON_WHITESPACE_C0.test(raw.note), 'raw OSC-8 sanitization must remove ESC/BEL bytes');

  const escaped = JSON.parse(String.raw`{"note":"reviewed \u001b]8;;urn:ironshade:trusted-review:test\u0007VISIBLE_REFERENCE\u001b]8;;\u0007"}`);
  ok(escaped.note.includes('VISIBLE_REFERENCE'), 'escaped OSC-8 sanitization must preserve visible review text');
  ok(!HAS_NON_WHITESPACE_C0.test(escaped.note), 'escaped OSC-8 sanitization must remove decoded ESC/BEL bytes');

  const whitespace = JSON.parse(String.raw`{"note":"line 1\nline 2\tcell\rreturn"}`);
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
    JSON.parse(String.raw`{"status":"safe","sta\u001btus":"unsafe"}`);
  } catch (error) {
    rejectedEscapedKey = /JSON key/.test(String(error));
  }
  ok(rejectedEscapedKey, 'escaped C0 controls in JSON keys must fail closed instead of collapsing keys');

  const ordinary = JSON.parse('{"status":"safe","note":"ordinary visible text"}');
  ok(ordinary.status === 'safe' && ordinary.note === 'ordinary visible text', 'ordinary JSON semantics must remain unchanged');
  console.log('TRUSTED_REVIEW_JSON_SANITIZER_SELF_TEST_PASS');
}

installTrustedReviewJsonSanitizer();

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const command = process.argv[2];
  if (command === 'self-test') selfTest();
  else throw new Error('usage: trusted-review-json-sanitizer.mjs self-test');
}
