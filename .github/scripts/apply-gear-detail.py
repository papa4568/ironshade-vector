from pathlib import Path

armory_path = Path('src/components/Armory.tsx')
armory = armory_path.read_text()

helper_anchor = "  const applyResult = (result: { profile: PlayerProfile; message: string }) => { onProfileChange(result.profile); setMessage(result.message); };\n"
helpers = helper_anchor + """  const openGearDetails = (itemId: string) => {
    setSelectedId(itemId);
    requestAnimationFrame(() => buildRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };
  const closeGearDetails = () => {
    setSelectedId(null);
    requestAnimationFrame(() => buildRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };
"""
if 'const openGearDetails' not in armory:
    if helper_anchor not in armory:
        raise SystemExit('applyResult anchor missing')
    armory = armory.replace(helper_anchor, helpers, 1)

tab_anchor = "  const selectTab = (value: Tab) => {\n    setTab(value);\n    if (value === 'reconstruct' && !selectedId && profile.inventory[0]) setSelectedId(profile.inventory[0].id);\n"
tab_replacement = "  const selectTab = (value: Tab) => {\n    setTab(value);\n    if (value === 'gear') setSelectedId(null);\n    if (value === 'reconstruct' && !selectedId && profile.inventory[0]) setSelectedId(profile.inventory[0].id);\n"
if tab_anchor in armory:
    armory = armory.replace(tab_anchor, tab_replacement, 1)

equipped_click = "onClick={() => item && setSelectedId(item.id)}"
if equipped_click not in armory and "onClick={() => item && openGearDetails(item.id)}" not in armory:
    raise SystemExit('equipped gear click anchor missing')
armory = armory.replace(equipped_click, "onClick={() => item && openGearDetails(item.id)}", 1)

inventory_click = "onClick={() => setSelectedId(item.id)}"
if inventory_click not in armory and "onClick={() => openGearDetails(item.id)}" not in armory:
    raise SystemExit('storage gear click anchor missing')
armory = armory.replace(inventory_click, "onClick={() => openGearDetails(item.id)}", 1)
armory = armory.replace('Tap a slot to inspect or compare.', 'Tap any item to open its full gear page.', 1)

return_anchor = '  return <main ref={buildRef} className="build-bay">\n'
dedicated = '''  if (tab === 'gear' && selected) {
    const selectedIsEquipped = profile.equipped[selected.slot] === selected.id;
    return <main ref={buildRef} className="build-bay gear-detail-mode">
      <section className={`gear-detail-page ${rarityClass(selected)} ${factionClass(selected)} ${qualityClass(selected)}`} aria-label="Gear details">
        <button type="button" className="gear-detail-back gear-detail-back-top" onClick={closeGearDetails}>← Back to equipment</button>
        <header className="gear-detail-header">
          <div className="gear-detail-badges"><span>{selected.rarity.toUpperCase()}</span><span>{slotLabels[selected.slot]}</span><span>EQUIP LV {selected.levelRequirement}</span>{selected.faction && <span>{factionLabel(selected.faction).toUpperCase()}</span>}{selectedIsEquipped && <span>EQUIPPED</span>}</div>
          <h1>{selected.name}</h1>
          <p>{selected.equipmentClass}. {selected.core}</p>
        </header>
        <div className="gear-detail-actions" aria-label="Gear actions">
          {selectedIsEquipped ? <button onClick={() => unequipLatest(selected.slot)}>Unequip</button> : <button className="primary" onClick={() => equipLatest(selected)}>Equip {slotLabels[selected.slot]}</button>}
          <button className="danger" onClick={() => discardLatest(selected)}>Discard</button>
        </div>
        {message && <div className="build-message gear-detail-message" role="status">{message}</div>}
        <div className="gear-detail-content"><GearComparison profile={profile} item={selected} /></div>
        <footer className="gear-detail-footer">
          <button type="button" className="gear-detail-back" onClick={closeGearDetails}>Back to equipment list</button>
          <div className="gear-detail-actions" aria-label="Gear actions after details">
            {selectedIsEquipped ? <button onClick={() => unequipLatest(selected.slot)}>Unequip</button> : <button className="primary" onClick={() => equipLatest(selected)}>Equip {slotLabels[selected.slot]}</button>}
            <button className="danger" onClick={() => discardLatest(selected)}>Discard</button>
          </div>
        </footer>
      </section>
    </main>;
  }

'''
if 'gear-detail-page' not in armory:
    if return_anchor not in armory:
        raise SystemExit('main return anchor missing')
    armory = armory.replace(return_anchor, dedicated + return_anchor, 1)
armory_path.write_text(armory)

css_path = Path('src/part12.css')
css = css_path.read_text()
old_marker = '/* ANDROID ITEM INSPECTOR SINGLE SCROLLER */'
if old_marker in css:
    css = css.split(old_marker, 1)[0].rstrip() + '\n\n'
if '/* DEDICATED GEAR DETAIL PAGE */' not in css:
    css += '''/* DEDICATED GEAR DETAIL PAGE */
.gear-detail-mode {
  display: block;
  height: 100dvh;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
}
.gear-detail-page {
  position: static;
  display: grid;
  width: min(1100px, 100%);
  max-width: 1100px;
  min-height: 0;
  margin: 0 auto;
  gap: 12px;
  overflow: visible;
}
.gear-detail-back,
.gear-detail-actions button {
  min-height: 44px;
  border: 1px solid #425750;
  border-radius: 9px;
  padding: 10px 14px;
  background: #14201d;
  color: #d8e1de;
  font-weight: 900;
  cursor: pointer;
}
.gear-detail-back { justify-self: start; }
.gear-detail-back-top { font-size: 13px; }
.gear-detail-header {
  display: grid;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--gear-rarity-border, #415650);
  border-radius: 14px;
  background: linear-gradient(135deg, var(--gear-rarity-wash, rgba(39,60,54,.22)), rgba(7,16,14,.98));
}
.gear-detail-header h1 {
  margin: 0;
  color: var(--gear-rarity, #e2e9e6);
  font-size: clamp(25px, 5vw, 42px);
  line-height: 1.05;
}
.gear-detail-header p {
  margin: 0;
  color: #93a49f;
  font-size: 11px;
  line-height: 1.5;
}
.gear-detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.gear-detail-badges span {
  padding: 5px 8px;
  border: 1px solid #3a4e48;
  border-radius: 999px;
  color: #a6b6b1;
  font: 800 8px ui-monospace, monospace;
  letter-spacing: .08em;
}
.gear-detail-actions {
  position: static;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, auto);
  gap: 8px;
}
.gear-detail-actions .primary {
  border-color: #8f977c;
  background: #c9c8ad;
  color: #101511;
}
.gear-detail-actions .danger {
  border-color: #80514d;
  background: #2a1716;
  color: #e0aaa4;
}
.gear-detail-message { width: 100%; margin: 0; }
.gear-detail-content {
  position: static;
  display: block;
  min-height: 0;
  overflow: visible;
}
.gear-detail-footer {
  display: grid;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid #293a35;
}
@media (orientation: landscape) and (max-height: 650px) {
  .gear-detail-mode {
    padding-top: max(8px, env(safe-area-inset-top));
    padding-bottom: max(10px, env(safe-area-inset-bottom));
  }
  .gear-detail-page { gap: 8px; }
  .gear-detail-header { padding: 10px 12px; }
  .gear-detail-header h1 { font-size: clamp(22px, 8vh, 30px); }
  .gear-detail-header p { font-size: 9px; }
  .gear-detail-back,
  .gear-detail-actions button {
    min-height: 40px;
    padding: 8px 11px;
  }
  .gear-detail-content .gear-summary-grid { gap: 8px; }
}
'''
css_path.write_text(css)

test_path = Path('tests/ui-readability.ts')
tests = test_path.read_text()
old = "const mobileInspectorCss = read('src/part12.css');\nassert(mobileInspectorCss.includes('ANDROID ITEM INSPECTOR SINGLE SCROLLER') && mobileInspectorCss.includes('overflow-y: auto') && mobileInspectorCss.includes('.gear-layout .item-inspector.open .inspector-scroll') && mobileInspectorCss.includes('overflow: visible') && mobileInspectorCss.includes('touch-action: auto'), 'Android item inspector still depends on a nested touch-scroll pane.');\n"
new = "const gearDetailCss = read('src/part12.css');\nconst gearDetailSection = gearDetailCss.split('/* DEDICATED GEAR DETAIL PAGE */')[1] ?? '';\nassert(armory.includes(\"if (tab === 'gear' && selected)\") && armory.includes('gear-detail-page') && armory.includes('Back to equipment list'), 'Gear selection does not switch to a dedicated detail screen.');\nassert(gearDetailSection.includes('.gear-detail-mode') && gearDetailSection.includes('overflow-y: auto') && gearDetailSection.includes('touch-action: pan-y') && !gearDetailSection.includes('position: fixed') && !gearDetailSection.includes('position: sticky'), 'Dedicated gear detail page must use one normal page scroll surface without overlay positioning.');\n"
if old in tests:
    tests = tests.replace(old, new, 1)
elif 'Gear selection does not switch to a dedicated detail screen.' not in tests:
    raise SystemExit('old mobile inspector regression assertion missing')
test_path.write_text(tests)
