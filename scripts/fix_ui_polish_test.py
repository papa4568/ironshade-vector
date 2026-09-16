from pathlib import Path

path = Path('tests/ui-readability.ts')
text = path.read_text()
old = "assert(statsPanel.includes('Player Stats') && statsPanel.includes('Vacuum resistance') && statsPanel.includes('BURST DPS'), 'Player stats page is missing explained final stats.');"
new = "assert(statsPanel.includes('Current build') && statsPanel.includes('Vacuum resistance') && statsPanel.includes('BURST DPS'), 'Player stats page is missing explained final stats.');"
if text.count(old) != 1:
    raise SystemExit(f'expected one stats heading assertion, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
print('UI polish regression heading aligned')
