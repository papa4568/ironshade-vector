from pathlib import Path
import re

armory_path = Path('src/components/Armory.tsx')
text = armory_path.read_text()

legacy_layout = "<div className={`gear-layout ${selected ? 'has-selection' : ''}`}>{selected && <button type=\"button\" className=\"item-inspector-backdrop\" aria-label=\"Close item inspector\" onClick={() => setSelectedId(null)} />}"
if legacy_layout in text:
    text = text.replace(legacy_layout, '<div className="gear-layout">', 1)

pattern = re.compile(r"</section><aside className=\{'item-inspector ' \+ \(selected \?.*?</aside></div></>}\n\n    \{tab === 'reconstruct'", re.S)
text, count = pattern.subn("</section></div></>}\n\n    {tab === 'reconstruct'", text, count=1)
if count == 0 and "<aside className={'item-inspector '" in text:
    raise SystemExit('legacy inspector markup was found but could not be removed safely')
if 'item-inspector-backdrop' in text:
    raise SystemExit('legacy inspector backdrop still exists in Armory markup')
armory_path.write_text(text)

test_path = Path('tests/ui-readability.ts')
tests = test_path.read_text()
obsolete = [
    "assert(equipmentCss.includes('gear-layout.has-selection::before') && equipmentCss.includes('width: min(72vw, 760px)'), 'Landscape mobile gear inspector is missing focused modal treatment.');\n",
    "assert(equipmentCss.includes('.item-inspector .sheet-close') && equipmentCss.includes('@media (pointer: coarse)'), 'Gear inspector cannot be reliably closed on coarse-pointer landscape devices.');\n",
    "assert(equipmentCss.includes('MOBILE INSPECTOR SCROLL RELIABILITY') && equipmentCss.includes('touch-action: pan-y') && equipmentCss.includes('-webkit-overflow-scrolling: touch') && equipmentCss.includes('height: calc(100dvh'), 'Mobile gear inspector is not a bounded touch-scroll surface.');\n",
    "assert(armory.includes('inspector-header') && armory.includes('inspector-scroll') && armory.includes('gear-summary-grid') && armory.includes('impact-stat'), 'Item inspector redesign hierarchy is missing.');\n",
    "assert(equipmentCss.includes('ITEM INSPECTOR REDESIGN') && equipmentCss.includes('grid-template-rows: auto minmax(0, 1fr) auto') && equipmentCss.includes('.inspector-scroll') && equipmentCss.includes('overflow: hidden'), 'Item inspector is not using the fixed-header/scroll-body/action-dock layout.');\n",
    "assert(equipmentCss.includes('ITEM INSPECTOR LAZY-CSS CASCADE GUARD') && equipmentCss.includes('.gear-layout .item-inspector.open'), 'Lazy Armory CSS can override the redesigned inspector grid.');\n",
    "assert(armory.includes(\"useState<string | null>(null)\") && armory.includes(\"newLootIds.length > 0 ? 'new' : 'all'\") && armory.includes('item-inspector-backdrop'), 'Recovered loot should open as a dismissible filtered list rather than trapping the player in an inspector.');\n",
    "assert(equipmentCss.includes('MOBILE INSPECTOR ESCAPE RELIABILITY') && equipmentCss.includes('.item-inspector-backdrop') && equipmentCss.includes('pointer-events: none'), 'Mobile item inspector backdrop/escape behavior is missing.');\n",
]
for line in obsolete:
    tests = tests.replace(line, '')

dedicated_guard = "assert(!armory.includes('item-inspector-backdrop') && !armory.includes(\"<aside className={'item-inspector '\"), 'Legacy gear inspector markup must stay removed once gear uses a dedicated page.');\n"
anchor = "assert(armory.includes('gear-deep-details') && css.includes('.gear-deep-details'), 'Gear inspector does not separate essential comparison from advanced telemetry.');\n"
if dedicated_guard not in tests:
    if anchor not in tests:
        raise SystemExit('gear details regression anchor missing')
    tests = tests.replace(anchor, anchor + dedicated_guard, 1)
test_path.write_text(tests)
