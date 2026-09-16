import { readFileSync, writeFileSync } from 'node:fs';

const cssPath = 'src/equipmentBay.css';
const testPath = 'tests/ui-readability.ts';

let css = readFileSync(cssPath, 'utf8');
const marker = '/* MOBILE INSPECTOR SCROLL RELIABILITY */';
if (!css.includes(marker)) {
  css += `\n\n${marker}\n@media (pointer: coarse), (max-width: 1100px) {\n  .item-inspector.open {\n    top: max(8px, env(safe-area-inset-top));\n    right: max(8px, env(safe-area-inset-right));\n    bottom: auto;\n    height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));\n    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));\n    box-sizing: border-box;\n    overflow-x: hidden;\n    overflow-y: scroll;\n    overscroll-behavior-y: contain;\n    -webkit-overflow-scrolling: touch;\n    touch-action: pan-y;\n    scrollbar-gutter: stable;\n  }\n  .item-inspector.open .sheet-close {\n    position: sticky;\n    top: 0;\n    z-index: 12;\n  }\n  .item-inspector.open .inspector-actions {\n    position: sticky;\n    bottom: -1px;\n    z-index: 11;\n    padding-bottom: max(10px, env(safe-area-inset-bottom));\n  }\n}\n`;
  writeFileSync(cssPath, css);
}

let test = readFileSync(testPath, 'utf8');
const testMarker = "assert(equipmentCss.includes('MOBILE INSPECTOR SCROLL RELIABILITY')";
if (!test.includes(testMarker)) {
  const needle = "assert(equipmentCss.includes('.item-inspector .sheet-close') && equipmentCss.includes('@media (pointer: coarse)'), 'Gear inspector cannot be reliably closed on coarse-pointer landscape devices.');";
  const addition = `${needle}\nassert(equipmentCss.includes('MOBILE INSPECTOR SCROLL RELIABILITY') && equipmentCss.includes('touch-action: pan-y') && equipmentCss.includes('-webkit-overflow-scrolling: touch') && equipmentCss.includes('height: calc(100dvh'), 'Mobile gear inspector is not a bounded touch-scroll surface.');`;
  if (!test.includes(needle)) throw new Error('UI test insertion point not found');
  test = test.replace(needle, addition);
  writeFileSync(testPath, test);
}

console.log('MOBILE_INSPECTOR_SCROLL_PATCHED');
