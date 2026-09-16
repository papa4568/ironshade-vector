import { readFileSync, writeFileSync } from 'node:fs';

function appendOnce(path, marker, content) {
  const source = readFileSync(path, 'utf8');
  if (source.includes(marker)) throw new Error(`${path}: marker already present`);
  writeFileSync(path, `${source.trimEnd()}\n\n${content.trim()}\n`);
}

appendOnce('src/part4.css', 'RESPONSIVE MISSION SURFACE RELIABILITY', `/* RESPONSIVE MISSION SURFACE RELIABILITY */
.overlay {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-top: max(12px, env(safe-area-inset-top));
  padding-right: max(12px, env(safe-area-inset-right));
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  padding-left: max(12px, env(safe-area-inset-left));
}
.overlay-card {
  flex: 0 0 auto;
  max-width: calc(100vw - max(24px, env(safe-area-inset-left)) - max(24px, env(safe-area-inset-right)));
  margin-block: auto;
}
.debrief-shell {
  height: 100dvh;
  min-height: 100dvh;
  place-items: start center;
  align-content: start;
  overscroll-behavior: contain;
}
.debrief-card {
  max-width: calc(100vw - max(24px, env(safe-area-inset-left)) - max(24px, env(safe-area-inset-right)));
}
@media (orientation: landscape) and (max-height: 900px) {
  .overlay { padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); }
  .overlay-card { width: min(560px, 94vw); padding: 18px 20px; border-radius: 13px; }
  .overlay-card h2 { margin: 5px 0 7px; font-size: clamp(24px, 5vh, 30px); line-height: 1.08; }
  .overlay-card p { margin: 7px 0; font-size: 11px; line-height: 1.4; }
  .telemetry-grid { margin: 10px 0 2px; gap: 6px; }
  .telemetry-grid span { padding: 7px 5px; }
  .overlay-actions { margin-top: 10px; }
  .overlay-actions button { min-height: 40px; padding: 9px 12px; }
  .extraction-choice { margin-top: 10px; gap: 7px; }
  .extraction-choice button { min-height: 60px; padding: 9px; }
  .debrief-shell { padding: max(10px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
  .debrief-card { padding: 18px 20px; border-radius: 14px; }
  .debrief-card h1 { margin: 5px 0; font-size: clamp(26px, 5vh, 34px); }
  .debrief-card > p { margin: 5px 0 9px; font-size: 10px; }
  .debrief-grid { margin: 10px 0; gap: 6px; }
  .debrief-grid div { padding: 8px; }
  .recovery-review { margin-top: 10px; padding: 9px; }
  .debrief-next, .anomaly-note { margin-top: 9px; }
  .debrief-actions { position: sticky; bottom: 0; z-index: 3; padding-top: 8px; padding-bottom: max(2px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, transparent, #0a1112 28%); }
}`);

appendOnce('src/equipmentBay.css', 'RESPONSIVE GEAR INSPECTOR RELIABILITY', `/* RESPONSIVE GEAR INSPECTOR RELIABILITY */
.item-inspector .sheet-close {
  display: block;
  position: sticky;
  z-index: 8;
  top: 0;
  width: fit-content;
  min-height: 38px;
  margin: 0 0 8px auto;
  float: none;
  border: 1px solid #456159;
  background: #13201d;
  color: #d3dfdb;
  box-shadow: 0 6px 18px rgba(0,0,0,.38);
}
@media (pointer: coarse) {
  .gear-layout { display: block; }
  .gear-layout.has-selection::before {
    content: '';
    position: fixed;
    z-index: 59;
    inset: 0;
    background: rgba(0,0,0,.7);
    backdrop-filter: blur(2px);
  }
  .item-inspector,
  .gear-layout:not(.has-selection) .item-inspector {
    display: none;
    position: fixed;
    z-index: 70;
    top: max(8px, env(safe-area-inset-top));
    right: max(8px, env(safe-area-inset-right));
    bottom: max(8px, env(safe-area-inset-bottom));
    left: auto;
    width: min(72vw, 760px);
    max-width: calc(100vw - max(16px, env(safe-area-inset-left)) - max(16px, env(safe-area-inset-right)));
    max-height: none;
    min-height: 0;
    padding: 12px 13px;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-color: #678b80;
    border-radius: 12px;
    background: #07100e;
    box-shadow: -22px 0 80px rgba(0,0,0,.82);
  }
  .item-inspector.open { display: block; }
  .item-inspector h2 { font-size: clamp(20px, 5vh, 28px); line-height: 1.08; }
  .inspector-actions { position: sticky; z-index: 7; bottom: 0; }
}
@media (orientation: landscape) and (max-height: 900px) {
  .build-bay { height: 100dvh; min-height: 100dvh; }
  .item-inspector,
  .gear-layout:not(.has-selection) .item-inspector {
    top: max(8px, env(safe-area-inset-top));
    bottom: max(8px, env(safe-area-inset-bottom));
    width: min(72vw, 760px);
    max-width: calc(100vw - max(16px, env(safe-area-inset-left)) - max(16px, env(safe-area-inset-right)));
    padding: 12px 13px;
  }
  .item-inspector h2 { margin: 5px 0; font-size: 21px; line-height: 1.05; }
  .item-inspector > p { margin-bottom: 8px; font-size: 9px; line-height: 1.3; }
  .item-inspector .sheet-close { min-height: 34px; padding: 6px 9px; }
  .gear-quick-read { margin: 7px 0; padding: 9px 10px; }
  .compare-head > div { padding: 8px 9px; }
  .compare-stats { margin-top: 6px; }
  .compare-line { min-height: 28px; }
  .gear-deep-details { margin-top: 7px; }
  .gear-deep-details > summary { min-height: 36px; padding: 7px 9px; }
}`);

const testPath = 'tests/ui-readability.ts';
let tests = readFileSync(testPath, 'utf8');
const importAnchor = "const equipmentCss = read('src/equipmentBay.css');\n";
if (!tests.includes(importAnchor)) throw new Error('UI test import anchor missing');
tests = tests.replace(importAnchor, `${importAnchor}const missionCss = read('src/part4.css');\n`);
const assertionAnchor = "assert(equipmentCss.includes('gear-layout.has-selection::before') && equipmentCss.includes('width: min(72vw, 760px)'), 'Landscape mobile gear inspector is missing focused modal treatment.');\n";
if (!tests.includes(assertionAnchor)) throw new Error('UI test assertion anchor missing');
tests = tests.replace(assertionAnchor, `${assertionAnchor}assert(equipmentCss.includes('.item-inspector .sheet-close') && equipmentCss.includes('@media (pointer: coarse)'), 'Gear inspector cannot be reliably closed on coarse-pointer landscape devices.');\nassert(missionCss.includes('RESPONSIVE MISSION SURFACE RELIABILITY') && missionCss.includes('overflow-y: auto'), 'Combat completion overlays can still extend outside the visible viewport.');\nassert(missionCss.includes('place-items: start center') && missionCss.includes('height: 100dvh'), 'Mission debrief can still center oversized content outside the scrollable viewport.');\nassert(missionCss.includes('max-height: 900px'), 'Short landscape viewport scaling regression coverage is missing.');\n`);
writeFileSync(testPath, tests);
