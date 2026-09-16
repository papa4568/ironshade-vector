from pathlib import Path
import re

path = Path('src/components/Armory.tsx')
text = path.read_text()

legacy_layout = "<div className={`gear-layout ${selected ? 'has-selection' : ''}`}>{selected && <button type=\"button\" className=\"item-inspector-backdrop\" aria-label=\"Close item inspector\" onClick={() => setSelectedId(null)} />}"
if legacy_layout in text:
    text = text.replace(legacy_layout, '<div className="gear-layout">', 1)

pattern = re.compile(r"</section><aside className=\{'item-inspector ' \+ \(selected \?.*?</aside></div></>}\n\n    \{tab === 'reconstruct'", re.S)
text, count = pattern.subn("</section></div></>}\n\n    {tab === 'reconstruct'", text, count=1)
if count == 0 and "<aside className={'item-inspector '" in text:
    raise SystemExit('legacy inspector markup was found but could not be removed safely')

path.write_text(text)
