// G8-only pixel acceptance on the exact PR APK. Shared G2 PNG routines remain untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeScreenshotPng, auditGameplayPair } from '../scripts/verify-p28g2-gameplay-frames.mjs';
import { auditCryoVisualProvenance } from './p28g8-cryo-provenance.mjs';
import { auditBrightEdgeMargins } from './p28g5-bright-edge.mjs';

const [normalPath, actionPath, reportPath, provenancePath] = process.argv.slice(2);
if (!normalPath || !actionPath || !reportPath || !provenancePath)
  throw new Error('Provide Cryo normal/action PNGs, pixel report, and provenance JSON');
const normal = decodeScreenshotPng(readFileSync(normalPath));
const action = decodeScreenshotPng(readFileSync(actionPath));
const pixels = auditGameplayPair(normal, action);
const margins = { normal: auditBrightEdgeMargins(normal), action: auditBrightEdgeMargins(action) };
const state = JSON.parse(readFileSync(provenancePath, 'utf8'));
const provenance = auditCryoVisualProvenance(state);
const report = { task: 'P28-G8', ...pixels,
  valid: pixels.valid && margins.normal.valid && margins.action.valid,
  margins, provenance };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (state.capturedRoute !== 'cryo-reserve' || !report.valid || !provenance.valid)
  throw new Error('P28-G8 exact-APK screenshot acceptance failed: ' + JSON.stringify(report));
console.log('P28G8_GAMEPLAY_PIXEL_CONTENT_PASS route=cryo-reserve change=' + pixels.changedRatio);
