// Screenshot-content acceptance for exact APK-backed Damaged Vessel frames.
// No external PNG packages: Android screencap is 8-bit non-interlaced RGB/RGBA.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
export function decodeScreenshotPng(bytes) {
  assert(bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'Screenshot must be PNG');
  let width = 0, height = 0, channels = 0, pos = 8;
  const chunks = [];
  while (pos + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString('ascii', pos + 4, pos + 8);
    assert(pos + 12 + length <= bytes.length, 'Truncated PNG chunk');
    const data = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      assert(data[8] === 8 && channels && data[10] === 0 && data[11] === 0 && data[12] === 0,
        'Screenshot must be 8-bit, RGB/RGBA, non-interlaced PNG');
    }
    if (type === 'IDAT') chunks.push(data);
    pos += 12 + length;
    if (type === 'IEND') break;
  }
  assert(width >= 16 && height >= 16 && width * height <= 15_000_000 && chunks.length > 0, 'Screenshot dimensions/IDAT invalid');
  const packed = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  assert(packed.length === (stride + 1) * height, 'Screenshot raster length invalid');
  const pixels = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const offset = y * (stride + 1);
    const filter = packed[offset];
    assert(filter <= 4, 'Unsupported PNG row filter');
    const row = new Uint8Array(stride);
    for (let j = 0; j < stride; j += 1) {
      const a = j >= channels ? row[j - channels] : 0;
      const up = previous[j];
      const c = j >= channels ? previous[j - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((a + up) / 2);
      else if (filter === 4) {
        const p = a + up - c;
        const da = Math.abs(p - a), db = Math.abs(p - up), dc = Math.abs(p - c);
        predictor = da <= db && da <= dc ? a : db <= dc ? up : c;
      }
      row[j] = (packed[offset + 1 + j] + predictor) & 255;
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      pixels[dst] = row[src]; pixels[dst + 1] = row[src + 1];
      pixels[dst + 2] = row[src + 2];
      pixels[dst + 3] = channels === 4 ? row[src + 3] : 255;
    }
    previous = row;
  }
  return { width, height, pixels };
}

function luminance(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return (image.pixels[offset] * 0.2126
    + image.pixels[offset + 1] * 0.7152
    + image.pixels[offset + 2] * 0.0722);
}

export function auditGameplayFrame(image) {
  const { width, height, pixels } = image;
  const left = Math.floor(width * 0.20), right = Math.ceil(width * 0.80);
  const top = Math.floor(height * 0.20), bottom = Math.ceil(height * 0.82);
  const dx = Math.max(1, Math.floor(width / 650));
  const dy = Math.max(1, Math.floor(height / 380));
  let count = 0, lightSum = 0, lightSq = 0, distinct = new Set(), edges = 0, dark = 0, paleBandRows = 0, rows = 0;
  for (let y = top; y < bottom; y += dy) {
    let longest = 0, run = 0, sampleCount = 0;
    rows += 1;
    for (let x = left; x < right; x += dx) {
      const pos = (y * width + x) * 4;
      const rr = pixels[pos], gg = pixels[pos + 1], bb = pixels[pos + 2];
      const lum = luminance(image, x, y);
      const pale = Math.min(rr, gg, bb) >= 155 && Math.max(rr, gg, bb) - Math.min(rr, gg, bb) <= 22;
      run = pale ? run + 1 : 0;
      longest = Math.max(longest, run);
      lightSum += lum;
      lightSq += lum * lum;
      dark += lum < 7 ? 1 : 0;
      distinct.add((rr >> 4) + ((gg >> 4) << 4) + ((bb >> 4) << 8));
      if (x + dx < right && y + dy < bottom
        && Math.abs(lum - luminance(image, x + dx, y)) + Math.abs(lum - luminance(image, x, y + dy)) > 22) edges += 1;
      count += 1; sampleCount += 1;
    }
    if (sampleCount > 0 && longest / sampleCount >= 0.48) paleBandRows += 1;
  }
  assert(count > 0, 'Empty gameplay crop');
  const sigma = Math.sqrt(Math.max(0, lightSq / count - (lightSum / count) ** 2));
  const edgeRatio = edges / count;
  const paleRowsRatio = paleBandRows / rows;
  const darkRatio = dark / count;
  const valid = sigma >= 8 && distinct.size >= 18 && edgeRatio >= 0.006
    && darkRatio < 0.96 && paleRowsRatio < 0.14;
  return { valid, width, height, crop: [left, top, right, bottom],
    lightStandardDeviation: Number(sigma.toFixed(2)), colorBins: distinct.size,
    edgeRatio: Number(edgeRatio.toFixed(5)), darkRatio: Number(darkRatio.toFixed(5)),
    paleBandRowsRatio: Number(paleRowsRatio.toFixed(5)),
    reason: !valid ? 'flat-or-dark-gameplay-or-oversized-pale-band' : 'content-rich-gameplay' };
}

export function auditGameplayPair(normal, action) {
  const first = auditGameplayFrame(normal);
  const second = auditGameplayFrame(action);
  assert(normal.width === action.width && normal.height === action.height, 'Action screenshot dimensions changed');
  const [left, top, right, bottom] = first.crop;
  const dx = Math.max(1, Math.floor(normal.width / 650));
  const dy = Math.max(1, Math.floor(normal.height / 380));
  let changed = 0, total = 0;
  for (let y = top; y < bottom; y += dy) for (let x = left; x < right; x += dx) {
    const pos = (y * normal.width + x) * 4;
    const diff = Math.abs(normal.pixels[pos] - action.pixels[pos])
      + Math.abs(normal.pixels[pos + 1] - action.pixels[pos + 1])
      + Math.abs(normal.pixels[pos + 2] - action.pixels[pos + 2]);
    if (diff >= 38) changed += 1;
    total += 1;
  }
  const changedRatio = changed / total;
  return { valid: first.valid && second.valid && changedRatio >= 0.003,
    normal: first, action: second, changedRatio: Number(changedRatio.toFixed(5)) };
}

// Disallow a visually plausible screenshot from masking source-asset fallback
// or unready materials. This contract complements real pixel inspection.
export function auditAuthoredVisualProvenance(state) {
  const finite = key => Number.isFinite(Number(state?.[key])) ? Number(state[key]) : NaN;
  const mapped = finite('mappedObjects'), authored = finite('authoredObjects'), fallback = finite('fallbackObjects');
  const expected = {
    'orbital-station': { profile: 'orbital-recessed-deck-inlay', bindings: 40, contacts: 25 },
    'damaged-vessel': { profile: 'damaged-recessed-deck-inlay', bindings: 35, contacts: 11 },
    'spin-habitat': { profile: 'spin-recessed-deck-inlay', bindings: 35, contacts: 4 },
    'jovian-harvester': { profile: 'jovian-recessed-deck-inlay', bindings: 80, contacts: 4 },
  }[state?.capturedRoute];
  const problems = [];
  if (!expected || state?.backend !== 'webgl2') problems.push('wrong-map-or-backend');
  if (state?.tier !== 'high' || state?.captureMode !== 'high-tier-qa-visual-only'
    || !state?.assetIds || !state.assetIds.split(',').every(id => id.endsWith('-lod0'))) {
    problems.push('not-authored-lod0-flagship-visual');
  }
  if (state?.artState !== 'ready' || !(mapped > 0 && authored === mapped && fallback === 0)) problems.push('procedural-box-or-unresolved-world-slot');
  if (state?.premium !== 'ready' || !(finite('premiumBindings') >= (expected?.bindings ?? Infinity))
    || state?.ibl !== 'shared-prefiltered:ready') problems.push('missing-or-unready-premium-material');
  if (state?.routeStyle !== expected?.profile
    || !(finite('routeMaxWidth') > 0 && finite('routeMaxWidth') <= 0.20)) problems.push('oversized-route-material');
  if (state?.objectiveCue !== 'beacon+navigation-path'
    || !(finite('worldObjects') >= 1)) problems.push('missing-or-occluded-objective');
  if (!state?.assetIds || !(finite('groundProps') >= (expected?.contacts ?? Infinity))) problems.push('missing-asset-provenance');
  if (state?.beforeAssetIds !== state?.assetIds
    || state?.beforeArtState !== 'ready'
    || state?.beforePremium !== 'ready'
    || state?.beforeIbl !== 'shared-prefiltered:ready') problems.push('late-asset-pop-in');
  return { valid: problems.length === 0, problems };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [normalPath, actionPath, reportPath, provenancePath] = process.argv.slice(2);
  assert(normalPath && actionPath && reportPath && provenancePath, 'Provide normal/action PNG, pixel-report and captured provenance JSON');
  const report = auditGameplayPair(
    decodeScreenshotPng(readFileSync(normalPath)), decodeScreenshotPng(readFileSync(actionPath)));
  const provenance = auditAuthoredVisualProvenance(JSON.parse(readFileSync(provenancePath, 'utf8')));
  writeFileSync(reportPath, JSON.stringify({ task: 'P28-G2', ...report, provenance }, null, 2) + '\n');
  assert(report.valid && provenance.valid,
    'P28-G2 screenshot-content/provenance gate failed: ' + JSON.stringify({ report, provenance }));
  console.log('P28G2_GAMEPLAY_PIXEL_CONTENT_PASS change=' + report.changedRatio
    + ' colors=' + report.normal.colorBins + '/' + report.action.colorBins);
}
