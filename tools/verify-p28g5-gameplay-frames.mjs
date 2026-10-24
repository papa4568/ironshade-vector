// G5-only pixel acceptance on the exact PR APK. Shared G2 PNG routines remain untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeScreenshotPng, auditGameplayPair } from '../scripts/verify-p28g2-gameplay-frames.mjs';
import { auditAuthoredVisualProvenance } from './p28g5-ice-provenance.mjs';

const [normalPath, actionPath, reportPath, provenancePath] = process.argv.slice(2);
if (!normalPath || !actionPath || !reportPath || !provenancePath)
  throw new Error('Provide Ice normal/action PNGs, pixel report, and provenance JSON');
const pixels = auditGameplayPair(decodeScreenshotPng(readFileSync(normalPath)), decodeScreenshotPng(readFileSync(actionPath)));
const state = JSON.parse(readFileSync(provenancePath, 'utf8'));
const provenance = auditAuthoredVisualProvenance(state);
const report = { task: 'P28-G5', ...pixels, provenance };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (state.capturedRoute !== 'ice-mine' || !pixels.valid || !provenance.valid)
  throw new Error('P28-G5 exact-APK screenshot acceptance failed: ' + JSON.stringify(report));
console.log('P28G5_GAMEPLAY_PIXEL_CONTENT_PASS route=ice-mine change=' + pixels.changedRatio);
