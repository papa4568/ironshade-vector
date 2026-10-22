// Exact APK-backed Spin Habitat visual acceptance: reuse the tested PNG and provenance analyzers.
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeScreenshotPng, auditGameplayPair, auditAuthoredVisualProvenance } from './verify-p28g2-gameplay-frames.mjs';
const [normalPath, actionPath, reportPath, provenancePath] = process.argv.slice(2);
if (!normalPath || !actionPath || !reportPath || !provenancePath)
  throw new Error('Provide Spin Habitat normal/action PNGs, pixel report, and provenance JSON');
const pixels = auditGameplayPair(decodeScreenshotPng(readFileSync(normalPath)), decodeScreenshotPng(readFileSync(actionPath)));
const state = JSON.parse(readFileSync(provenancePath, 'utf8'));
const provenance = auditAuthoredVisualProvenance(state);
const report = { task: 'P28-G3', ...pixels, provenance };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (state.capturedRoute !== 'spin-habitat' || !pixels.valid || !provenance.valid)
  throw new Error('P28-G3 real gameplay-frame acceptance failed: ' + JSON.stringify(report));
console.log('P28G3_GAMEPLAY_PIXEL_CONTENT_PASS route=spin-habitat change=' + pixels.changedRatio);
