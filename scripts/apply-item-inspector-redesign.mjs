import { readFileSync, writeFileSync } from 'node:fs';

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing ${label} start marker`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing ${label} end marker`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const armoryPath = 'src/components/Armory.tsx';
let armory = readFileSync(armoryPath, 'utf8');

const delta = String.raw`function Delta({ label, current, candidate, lowerIsBetter = false }: { label: string; current: number; candidate: number; lowerIsBetter?: boolean }) {
  const delta = candidate - current;
  const favorable = lowerIsBetter ? delta < -0.001 : delta > 0.001;
  const unfavorable = lowerIsBetter ? delta > 0.001 : delta < -0.001;
  const digits = label === 'MAG' ? 0 : 1;
  const format = (value: number) => value.toFixed(digits);
  const deltaCopy = Math.abs(delta) < 0.001 ? 'NO CHANGE' : `${delta > 0 ? '+' : ''}${delta.toFixed(digits)}`;
  return <article className={'impact-stat ' + (favorable ? 'better' : unfavorable ? 'worse' : '')}><span>{label}</span><div className="impact-values"><small>{format(current)}</small><i aria-hidden="true">→</i><b>{format(candidate)}</b></div><em>{deltaCopy}</em></article>;
}

`;
armory = replaceBetween(armory, 'function Delta(', 'function ModifierGroup', delta, 'Delta');

const comparison = String.raw`function GearComparison({ profile, item }: { profile: PlayerProfile; item: Item }) {
  const equipped = itemForSlot(profile, item.slot);
  const summary = comparisonSummary(item, equipped);
  const proposed = candidateProfile(profile, item);
  const currentBuild = deriveCombatBuild(profile);
  const candidateBuild = deriveCombatBuild(proposed);
  const weaponSlot = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? item.slot : null;
  const identity = frameIdentityDefinition(frameIdentity(item));
  const augments = (item.augments ?? []).map(augmentDefinition);
  const statCards = weaponSlot ? (() => {
    const current = effectiveWeapon(profile, weaponSlot);
    const candidate = effectiveWeapon(proposed, weaponSlot);
    return <div className="compare-stats impact-grid"><Delta label="DMG" current={current.damage} candidate={candidate.damage} /><Delta label="VEL" current={current.velocity} candidate={candidate.velocity} /><Delta label="PEN" current={current.penetration} candidate={candidate.penetration} /><Delta label="RECOIL" current={current.recoil} candidate={candidate.recoil} lowerIsBetter /><Delta label="HEAT/SHOT" current={current.heat * 100} candidate={candidate.heat * 100} lowerIsBetter /><Delta label="MAG" current={current.magazine} candidate={candidate.magazine} /></div>;
  })() : <div className="compare-stats impact-grid"><Delta label="ARMOR" current={currentBuild.player.maxArmorAdd} candidate={candidateBuild.player.maxArmorAdd} /><Delta label="MOVE %" current={(currentBuild.player.moveSpeedMul - 1) * 100} candidate={(candidateBuild.player.moveSpeedMul - 1) * 100} /><Delta label="CAP REGEN %" current={(currentBuild.player.capRegenMul - 1) * 100} candidate={(candidateBuild.player.capRegenMul - 1) * 100} /><Delta label="VAC RES %" current={currentBuild.player.vacuumResistance * 100} candidate={candidateBuild.player.vacuumResistance * 100} /></div>;
  return (
    <>
      <div className="gear-summary-grid">
        <section className="item-effect-panel"><header><small>PRIMARY EFFECT</small><span>{item.rarity.toUpperCase()}</span></header><p>{primaryItemEffect(item)}</p></section>
        <section className="loadout-impact"><header className="loadout-impact-heading"><div><small>LOADOUT IMPACT</small><b>{slotLabels[item.slot]}</b></div><span>{equipped ? 'VS EQUIPPED' : 'EMPTY SLOT'}</span></header><div className="compare-head"><div><small>CURRENT</small><b>{equipped?.name ?? 'Empty slot'}</b><span>{summary.current}</span></div><div className="candidate-card"><small>CANDIDATE</small><b>{item.name}</b><span>{summary.candidate}</span></div></div>{statCards}</section>
      </div>
      <details className="gear-deep-details"><summary>Technical details & modifiers</summary>
      <div className={'recovery-quality ' + qualityClass(item)}><b>RECOVERY QUALITY {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0).toUpperCase()}</b><span>SOURCE // {item.recoverySource ?? 'Legacy recovery'}</span></div>
      <div className="frame-signature"><b>FRAME // {identity.name.toUpperCase()} // GEN {item.frameGeneration ?? 1}</b><span>{identity.philosophy}</span>{(item.frameGeneration ?? 1) >= 6 && <em>GEN VI // MATURE GEN V STAT BAND · EXPANDED AUGMENT BUS. Prototype/Singular frames can carry a third socket; full access requires Microforge T2.</em>}<strong>FRAME QUALITY {item.equipmentQuality ?? 0}/20</strong></div>
      <div className="implicit-signature"><b>IMPLICIT PROPERTY</b><span>{item.frameImplicit ?? 'Service geometry // neutral frame behavior.'}</span></div>
      <div className="augment-signature"><b>AUGMENTS // {augments.length}/{item.augmentSlots ?? 0}</b>{augments.length === 0 ? <span>No hardware installed.</span> : augments.map(augment => <span key={augment.id}>{augment.hardware.toUpperCase()} // {augment.name} — {augment.description} TRADEOFF // {augment.tradeoff}</span>)}</div>
      {item.singularEffect && <div className="singular-signature"><b>SIGNATURE // FIXED SINGULAR RULE</b><span>{item.singularEffect}</span></div>}
      {item.faction && <div className={'faction-signature faction-' + item.faction}><b>FACTION FRAME // {factionLabel(item.faction).toUpperCase()}</b><span>Recovered {factionLabel(item.faction)} construction. Multi-frame interactions are only revealed here after they become active in your equipped loadout.</span></div>}
      <div className="modifier-columns"><ModifierGroup item={item} family="core" /><ModifierGroup item={item} family="systems" /></div>
      </details>
    </>
  );
}

`;
armory = replaceBetween(armory, 'function GearComparison(', 'function ReconstructionBench', comparison, 'GearComparison');

const inspectorStart = armory.indexOf('<aside className={`item-inspector');
if (inspectorStart < 0) throw new Error('Missing item inspector markup');
const inspectorEndMarker = '</aside></div></>}';
const inspectorEndMarkerIndex = armory.indexOf(inspectorEndMarker, inspectorStart);
if (inspectorEndMarkerIndex < 0) throw new Error('Missing item inspector end marker');
const inspectorEnd = inspectorEndMarkerIndex + '</aside>'.length;
const inspector = String.raw`<aside className={'item-inspector ' + (selected ? 'open ' + rarityClass(selected) + ' ' + factionClass(selected) + ' ' + qualityClass(selected) : '')} aria-label="Item comparison">{selected ? <><header className="inspector-header"><div className="inspector-heading"><div className="inspector-badges"><span className="inspector-rarity">{selected.rarity.toUpperCase()}</span><span>{slotLabels[selected.slot]}</span><span>EQUIP LV {selected.levelRequirement}</span>{selected.faction && <span>{factionLabel(selected.faction).toUpperCase()}</span>}{profile.equipped[selected.slot] === selected.id && <span className="equipped-badge">EQUIPPED</span>}</div><h2>{selected.name}</h2><p>{selected.equipmentClass}. {selected.core}</p></div><button className="sheet-close" aria-label="Back to ship storage" onClick={() => setSelectedId(null)}>Back to storage</button></header><div className="inspector-scroll" tabIndex={0}><GearComparison profile={profile} item={selected} /></div><footer className="inspector-actions">{profile.equipped[selected.slot] === selected.id ? <button onClick={() => unequipLatest(selected.slot)}>Unequip</button> : <button className="primary" onClick={() => equipLatest(selected)}>Equip {slotLabels[selected.slot]}</button>}<button className="danger" onClick={() => discardLatest(selected)}>Discard</button></footer></> : <div className="empty-inspector"><b>Select equipment</b><span>Tap an item to compare it against the currently equipped piece.</span></div>}</aside>`;
armory = armory.slice(0, inspectorStart) + inspector + armory.slice(inspectorEnd);
writeFileSync(armoryPath, armory);

const cssPath = 'src/equipmentBay.css';
let css = readFileSync(cssPath, 'utf8');
if (!css.includes('/* ITEM INSPECTOR REDESIGN */')) {
  css += String.raw`

/* ITEM INSPECTOR REDESIGN */
.item-inspector.open {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}
.inspector-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 16px 16px 13px;
  border-bottom: 1px solid color-mix(in srgb, var(--gear-rarity, #678b80) 44%, #24332f);
  background: linear-gradient(135deg, var(--gear-rarity-wash, rgba(35,55,49,.2)), rgba(6,13,12,.98) 56%);
}
.inspector-heading { min-width: 0; }
.inspector-heading h2 {
  margin: 7px 0 5px;
  color: var(--gear-rarity, #dce6e2);
  font-size: clamp(22px, 3.1vw, 34px);
  line-height: 1;
  letter-spacing: -.025em;
}
.inspector-heading > p {
  max-width: 760px;
  margin: 0;
  color: #91a29d;
  font-size: 10px;
  line-height: 1.45;
}
.inspector-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}
.inspector-badges span {
  padding: 4px 7px;
  border: 1px solid #31443e;
  border-radius: 999px;
  background: rgba(8,17,15,.78);
  color: #82968f;
  font: 900 7px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
}
.inspector-badges .inspector-rarity {
  border-color: var(--gear-rarity-border, #526e65);
  background: var(--gear-rarity-wash, rgba(30,49,43,.42));
  color: var(--gear-rarity, #c6d5d0);
}
.inspector-badges .equipped-badge {
  border-color: rgba(133,190,158,.62);
  background: rgba(43,101,71,.25);
  color: #9bd2b2;
}
.item-inspector.open .sheet-close {
  position: static;
  align-self: start;
  min-height: 42px;
  margin: 0;
  padding: 9px 12px;
  border-color: #4c665e;
  border-radius: 10px;
  background: #12201d;
  color: #d8e4e0;
  white-space: nowrap;
  box-shadow: none;
}
.inspector-scroll {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 13px 16px 18px;
  scrollbar-gutter: stable;
}
.gear-summary-grid { display: grid; gap: 10px; }
.item-effect-panel,
.loadout-impact {
  border: 1px solid #2b3d38;
  border-radius: 12px;
  background: rgba(8,16,15,.86);
}
.item-effect-panel {
  padding: 12px 13px;
  border-color: color-mix(in srgb, var(--gear-rarity, #66877d) 52%, #2b3d38);
  background: linear-gradient(145deg, var(--gear-rarity-wash, rgba(32,48,44,.2)), rgba(8,16,15,.94) 62%);
}
.item-effect-panel header,
.loadout-impact-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.item-effect-panel header small,
.loadout-impact-heading small {
  color: #788d86;
  font: 900 7px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .12em;
}
.item-effect-panel header span {
  color: var(--gear-rarity, #a9bbb5);
  font: 900 7px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
}
.item-effect-panel p {
  margin: 8px 0 0;
  color: #d3ded9;
  font-size: 11px;
  line-height: 1.5;
}
.loadout-impact { padding: 11px; }
.loadout-impact-heading { margin-bottom: 8px; }
.loadout-impact-heading > div small,
.loadout-impact-heading > div b { display: block; }
.loadout-impact-heading > div b {
  margin-top: 3px;
  color: #c6d4cf;
  font-size: 11px;
}
.loadout-impact-heading > span {
  color: #71857e;
  font: 900 7px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .08em;
}
.item-inspector .compare-head { gap: 6px; }
.item-inspector .compare-head > div {
  min-width: 0;
  padding: 8px 9px;
  border-color: #2b3a36;
  background: #0a1311;
}
.item-inspector .compare-head > div.candidate-card {
  border-color: color-mix(in srgb, var(--gear-rarity, #678b80) 54%, #2b3a36);
  background: var(--gear-rarity-wash, rgba(22,38,33,.42));
}
.item-inspector .compare-head b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.impact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 7px;
  border: 0;
}
.impact-stat {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid #253530;
  border-radius: 9px;
  background: #08110f;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.impact-stat > span,
.impact-stat > em { display: block; }
.impact-stat > span {
  color: #70847d;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: .08em;
}
.impact-values {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 5px;
  align-items: center;
  margin-top: 5px;
}
.impact-values small,
.impact-values b { font-size: 11px; }
.impact-values small { color: #778984; }
.impact-values i { color: #51635d; font-style: normal; text-align: center; }
.impact-values b { color: #d8e2de; text-align: right; }
.impact-stat > em {
  margin-top: 4px;
  color: #687873;
  font-size: 7px;
  font-style: normal;
  font-weight: 900;
  text-align: right;
}
.impact-stat.better { border-color: rgba(85,151,111,.54); background: rgba(19,54,35,.33); }
.impact-stat.better > em { color: #8fd1a6; }
.impact-stat.worse { border-color: rgba(155,86,73,.48); background: rgba(62,28,24,.28); }
.impact-stat.worse > em { color: #d19586; }
.item-inspector .gear-deep-details { margin-top: 10px; }
.item-inspector .gear-deep-details > summary {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid #2a3a36;
  border-radius: 10px;
  background: #091210;
  color: #aebfba;
  font-size: 9px;
  font-weight: 900;
}
.item-inspector.open .inspector-actions {
  position: static;
  z-index: auto;
  grid-template-columns: minmax(0, 1fr) minmax(92px, .32fr);
  gap: 8px;
  margin: 0;
  padding: 10px 16px max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid #293a35;
  background: rgba(5,12,10,.98);
}
.item-inspector.open .inspector-actions button {
  min-height: 46px;
  border-radius: 10px;
  font-size: 11px;
}
.item-inspector.open .inspector-actions button.primary {
  background: var(--gear-rarity, #cfe1c5);
  color: #07100d;
}

@media (pointer: coarse), (max-width: 1100px) {
  .item-inspector.open {
    top: max(6px, env(safe-area-inset-top));
    right: max(6px, env(safe-area-inset-right));
    bottom: max(6px, env(safe-area-inset-bottom));
    left: max(6px, env(safe-area-inset-left));
    width: auto;
    max-width: none;
    height: auto;
    max-height: none;
    padding: 0;
    overflow: hidden;
    border-radius: 15px;
  }
  .inspector-scroll { touch-action: pan-y; }
}

@media (pointer: coarse) and (orientation: landscape) and (max-height: 700px) {
  .inspector-header {
    gap: 9px;
    padding: 8px 10px 7px;
  }
  .inspector-heading h2 {
    margin: 4px 0 3px;
    font-size: 20px;
  }
  .inspector-heading > p {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    font-size: 8px;
    line-height: 1.25;
  }
  .inspector-badges { gap: 4px; }
  .inspector-badges span { padding: 3px 5px; font-size: 6px; }
  .item-inspector.open .sheet-close { min-height: 34px; padding: 6px 9px; font-size: 9px; }
  .inspector-scroll { padding: 8px 10px 10px; }
  .gear-summary-grid {
    grid-template-columns: minmax(0, .84fr) minmax(0, 1.35fr);
    align-items: start;
    gap: 8px;
  }
  .item-effect-panel { padding: 9px 10px; }
  .item-effect-panel p { margin-top: 6px; font-size: 9px; line-height: 1.35; }
  .loadout-impact { padding: 8px; }
  .loadout-impact-heading { margin-bottom: 6px; }
  .impact-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 5px; }
  .impact-stat { padding: 6px 7px; }
  .impact-values { margin-top: 3px; }
  .impact-values small,
  .impact-values b { font-size: 9px; }
  .item-inspector .gear-deep-details { margin-top: 8px; }
  .item-inspector .gear-deep-details > summary { min-height: 34px; padding: 7px 9px; font-size: 8px; }
  .item-inspector.open .inspector-actions { padding: 7px 10px max(7px, env(safe-area-inset-bottom)); }
  .item-inspector.open .inspector-actions button { min-height: 38px; padding: 7px 9px; font-size: 9px; }
}

@media (max-width: 620px) and (orientation: portrait) {
  .inspector-header { grid-template-columns: 1fr; }
  .item-inspector.open .sheet-close { grid-row: 1; width: 100%; }
  .gear-summary-grid { grid-template-columns: 1fr; }
  .impact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
}
writeFileSync(cssPath, css);

const testPath = 'tests/ui-readability.ts';
let tests = readFileSync(testPath, 'utf8');
const anchor = "assert(equipmentCss.includes('MOBILE INSPECTOR SCROLL RELIABILITY') && equipmentCss.includes('touch-action: pan-y') && equipmentCss.includes('-webkit-overflow-scrolling: touch') && equipmentCss.includes('height: calc(100dvh'), 'Mobile gear inspector is not a bounded touch-scroll surface.');";
if (!tests.includes(anchor)) throw new Error('Missing UI test anchor');
const added = `${anchor}\nassert(armory.includes('inspector-header') && armory.includes('inspector-scroll') && armory.includes('gear-summary-grid') && armory.includes('impact-stat'), 'Item inspector redesign hierarchy is missing.');\nassert(equipmentCss.includes('ITEM INSPECTOR REDESIGN') && equipmentCss.includes('grid-template-rows: auto minmax(0, 1fr) auto') && equipmentCss.includes('.inspector-scroll') && equipmentCss.includes('overflow: hidden'), 'Item inspector is not using the fixed-header/scroll-body/action-dock layout.');`;
tests = tests.replace(anchor, added);
writeFileSync(testPath, tests);

console.log('ITEM_INSPECTOR_REDESIGN_PATCHED');
