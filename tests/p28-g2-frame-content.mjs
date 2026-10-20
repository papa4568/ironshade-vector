// Synthetic negative controls for the APK screenshot-content gate.
import { deflateSync } from 'node:zlib';
import { decodeScreenshotPng, auditGameplayFrame, auditGameplayPair } from '../scripts/verify-p28g2-gameplay-frames.mjs';

function assert(condition, message) { if (!condition) throw new Error(message); }
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(payload.length + 8);
  out.writeUInt32BE(data.length, 0); payload.copy(out, 4);
  out.writeUInt32BE(crc32(payload), payload.length + 4);
  return out;
}
function makeFrame(mode, offset = 0) {
  const width = 192, height = 120;
  const pixels = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const i = y * (width * 3 + 1) + 1 + x * 3;
    const texture = (x * 29 + y * 43 + ((x ^ y) % 13) * 7 + offset * 37) % 128;
    const gray = mode === 'blank' ? 4 : mode === 'pale' && y >= 38 && y < 63 ? 205 : 12 + texture;
    pixels[i] = mode === 'blank' ? 4 : gray;
    pixels[i + 1] = mode === 'blank' ? 4 : mode === 'pale' && y >= 38 && y < 63 ? 207 : Math.floor(gray * 0.8);
    pixels[i + 2] = mode === 'blank' ? 4 : mode === 'pale' && y >= 38 && y < 63 ? 203 : Math.floor(gray * 0.64);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
const normal = decodeScreenshotPng(makeFrame('textured'));
const action = decodeScreenshotPng(makeFrame('textured', 1));
assert(auditGameplayFrame(normal).valid, 'Synthetic textured frame should pass');
assert(!auditGameplayFrame(decodeScreenshotPng(makeFrame('blank'))).valid, 'Black valid PNG must fail');
assert(!auditGameplayFrame(decodeScreenshotPng(makeFrame('pale'))).valid, 'Large pale floor band must fail');
assert(auditGameplayPair(normal, action).valid, 'Distinct textured normal/action frames should pass');
assert(!auditGameplayPair(normal, normal).valid, 'Identical content must fail even with valid PNGs');
console.log('P28G2_PIXEL_NEGATIVE_CONTROLS_PASS cases=textured+black+pale-band+stale-action');
