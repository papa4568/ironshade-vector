import { readFileSync, writeFileSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, source) { writeFileSync(path, source); }
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(before, after);
}

// Recovered loot should open as a list, with reliable ways to leave an item inspector.
{
  const path = 'src/components/Armory.tsx';
  let source = read(path);
  source = replaceOnce(source,
    "const [selectedId, setSelectedId] = useState<string | null>(newLootIds[0] ?? null);",
    "const [selectedId, setSelectedId] = useState<string | null>(null);",
    'do not auto-open recovered item modal');
  source = replaceOnce(source,
    "const [gearFilter, setGearFilter] = useState<InventoryFilter>('all');",
    "const [gearFilter, setGearFilter] = useState<InventoryFilter>(newLootIds.length > 0 ? 'new' : 'all');",
    'new loot filter');
  source = replaceOnce(source,
    "<div className={`gear-layout ${selected ? 'has-selection' : ''}`}><section className=\"gear-storage\">",
    "<div className={`gear-layout ${selected ? 'has-selection' : ''}`}>{selected && <button type=\"button\" className=\"item-inspector-backdrop\" aria-label=\"Close item inspector\" onClick={() => setSelectedId(null)} />}<section className=\"gear-storage\">",
    'tappable inspector backdrop');
  source = replaceOnce(source,
    '<button className="sheet-close" onClick={() => setSelectedId(null)}>Close</button>',
    '<button className="sheet-close" onClick={() => setSelectedId(null)}>Back to storage</button>',
    'clear inspector exit label');
  write(path, source);
}

// Make the visual dimmer a real non-blocking layer and place a tappable dismiss surface above it.
{
  const path = 'src/equipmentBay.css';
  let source = read(path);
  if (!source.includes('MOBILE INSPECTOR ESCAPE RELIABILITY')) {
    source += `\n\n/* MOBILE INSPECTOR ESCAPE RELIABILITY */\n.gear-layout.has-selection::before { pointer-events: none; }\n.item-inspector-backdrop { display: none; }\n@media (pointer: coarse), (max-width: 1100px) {\n  .gear-layout.has-selection .item-inspector-backdrop {\n    display: block;\n    position: fixed;\n    z-index: 60;\n    inset: 0;\n    width: 100vw;\n    height: 100dvh;\n    margin: 0;\n    padding: 0;\n    border: 0;\n    appearance: none;\n    background: transparent;\n    cursor: default;\n  }\n  .item-inspector.open { z-index: 70; }\n  .item-inspector .sheet-close { pointer-events: auto; touch-action: manipulation; }\n}\n`;
  }
  write(path, source);
}

// Give debrief recovery cards the same rarity language used by the Equipment Bay.
{
  const path = 'src/readability.css';
  let source = read(path);
  if (!source.includes('DEBRIEF RARITY COLORS')) {
    source += `\n\n/* DEBRIEF RARITY COLORS */\n.recovery-review-card.rarity-field { --gear-rarity:#b8c4c0; --gear-rarity-border:rgba(149,166,160,.68); --gear-rarity-wash:rgba(87,105,99,.18); }\n.recovery-review-card.rarity-refined { --gear-rarity:#79d3a3; --gear-rarity-border:rgba(90,190,139,.82); --gear-rarity-wash:rgba(35,119,76,.22); }\n.recovery-review-card.rarity-prototype { --gear-rarity:#aebcff; --gear-rarity-border:rgba(116,143,232,.9); --gear-rarity-wash:rgba(54,72,159,.27); }\n.recovery-review-card.rarity-singular { --gear-rarity:#f0b75f; --gear-rarity-border:rgba(232,164,73,.95); --gear-rarity-wash:rgba(143,87,25,.3); }\n.recovery-review-card[class*='rarity-'] { box-shadow: inset 4px 0 0 var(--gear-rarity), inset 0 0 28px var(--gear-rarity-wash); }\n.recovery-review-card[class*='rarity-'] .recovery-review-meta small,\n.recovery-review-card[class*='rarity-'] .recovery-review-copy h3 { color: var(--gear-rarity); }\n`;
  }
  write(path, source);
}

// The lazy combat stylesheet loads after the global mobile stylesheet, so keep the final compact rule here.
{
  const path = 'src/part7.css';
  let source = read(path);
  if (!source.includes('MOBILE OBJECTIVE COMPACTNESS OVERRIDE')) {
    source += `\n\n/* MOBILE OBJECTIVE COMPACTNESS OVERRIDE */\n@media (pointer: coarse), (max-width: 900px) {\n  .post-clear-objective {\n    top: max(52px, calc(env(safe-area-inset-top) + 42px));\n    bottom: auto;\n    transform: translateX(-50%);\n    width: min(300px, 34vw);\n    padding: 6px 9px;\n    gap: 2px;\n    border-radius: 9px;\n    background: rgba(4, 11, 11, .8);\n    box-shadow: 0 6px 18px rgba(0,0,0,.18);\n  }\n  .post-clear-objective small { display: none; }\n  .post-clear-objective b { font-size: 10px; line-height: 1.1; }\n  .post-clear-objective span { font-size: 7px; line-height: 1.15; letter-spacing: .04em; }\n}\n@media (pointer: coarse) and (orientation: landscape) and (max-height: 560px) {\n  .post-clear-objective { top: max(42px, calc(env(safe-area-inset-top) + 32px)); width: min(280px, 31vw); padding: 5px 8px; }\n  .post-clear-objective b { font-size: 9px; }\n  .post-clear-objective span { font-size: 6px; }\n}\n`;
  }
  write(path, source);
}

// Bright, untone-mapped world-space hostile bars for mobile readability.
{
  const path = 'src/game/threeCombatRenderer.ts';
  let source = read(path);
  source = replaceOnce(source,
    "const hp = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.16), new THREE.MeshBasicMaterial({ color: 0xff4a3d, depthTest: false, depthWrite: false, toneMapped: false }));",
    "const hp = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.2), new THREE.MeshBasicMaterial({ color: 0xff725f, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));",
    'hostile health bar brightness');
  source = replaceOnce(source,
    "const armor = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.09), new THREE.MeshBasicMaterial({ color: 0x6fd2ff, depthTest: false, depthWrite: false, toneMapped: false }));",
    "const armor = new THREE.Mesh(new THREE.PlaneGeometry(barWidth, 0.12), new THREE.MeshBasicMaterial({ color: 0x8ee8ff, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false }));",
    'hostile armor bar brightness');
  source = replaceOnce(source,
    "visual.hp.material.color.setHex(enemy.maxArmor > 0 && enemy.armor <= 0 ? 0xff6557 : 0xff4a3d);",
    "visual.hp.material.color.setHex(enemy.maxArmor > 0 && enemy.armor <= 0 ? 0xffa080 : 0xff725f);",
    'broken armor health highlight');
  write(path, source);
}

// Lock the reported phone regressions into the existing UI test.
{
  const path = 'tests/ui-readability.ts';
  let source = read(path);
  source = replaceOnce(source,
    "const missionCss = read('src/part4.css');",
    "const missionCss = read('src/part4.css');\nconst objectiveCss = read('src/part7.css');",
    'objective stylesheet test input');
  source = replaceOnce(source,
    "assert(renderer.includes('0xff4a3d') && renderer.includes('toneMapped: false'), 'Three.js health bar contrast update is missing.');",
    "assert(renderer.includes('0xff725f') && renderer.includes('0x8ee8ff') && renderer.includes('THREE.AdditiveBlending') && renderer.includes('toneMapped: false'), 'Three.js hostile bars are not using the bright mobile treatment.');",
    'bright hostile bar assertion');
  const anchor = "assert(equipmentCss.includes('.item-inspector .sheet-close') && equipmentCss.includes('@media (pointer: coarse)'), 'Gear inspector cannot be reliably closed on coarse-pointer landscape devices.');";
  source = replaceOnce(source, anchor, anchor + "\nassert(armory.includes(\"useState<string | null>(null)\") && armory.includes(\"newLootIds.length > 0 ? 'new' : 'all'\") && armory.includes('item-inspector-backdrop'), 'Recovered loot should open as a dismissible filtered list rather than trapping the player in an inspector.');\nassert(equipmentCss.includes('MOBILE INSPECTOR ESCAPE RELIABILITY') && equipmentCss.includes('.item-inspector-backdrop') && equipmentCss.includes('pointer-events: none'), 'Mobile item inspector backdrop/escape behavior is missing.');\nassert(css.includes('DEBRIEF RARITY COLORS') && css.includes('.recovery-review-card.rarity-singular') && css.includes('.recovery-review-card.rarity-prototype'), 'Debrief recovery cards are missing rarity color treatment.');\nassert(objectiveCss.includes('MOBILE OBJECTIVE COMPACTNESS OVERRIDE') && objectiveCss.includes('width: min(300px, 34vw)') && objectiveCss.includes('.post-clear-objective small { display: none; }'), 'Post-clear objective guidance can still cover too much of the mobile combat view.');", 'mobile playtest regression assertions');
  write(path, source);
}

console.log('MOBILE_PLAYTEST_UI_2_PATCHED');
