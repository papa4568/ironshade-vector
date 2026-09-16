from pathlib import Path

path = Path('src/game/meta.ts')
text = path.read_text()
old = "forcedRarity?: Rarity): Item {"
new = "forcedRarity?: Exclude<Rarity, 'Singular'>): Item {"
if text.count(old) != 1:
    raise SystemExit(f'expected forced rarity signature once, saw {text.count(old)}')
text = text.replace(old, new, 1)
old = "const visibleRarity: Rarity = drop.rarity === 'Singular' ? 'Prototype' : drop.rarity as GroundLootRarity;"
new = "const visibleRarity: Exclude<Rarity, 'Singular'> = drop.rarity === 'Singular' ? 'Prototype' : drop.rarity;"
if text.count(old) != 1:
    raise SystemExit(f'expected visible rarity declaration once, saw {text.count(old)}')
text = text.replace(old, new, 1)
# The GroundLootRarity import is no longer needed after narrowing the materialized field item.
text = text.replace("import type { GroundLootReceipt, GroundLootRarity } from './fieldLoot';", "import type { GroundLootReceipt } from './fieldLoot';")
path.write_text(text)
print('loot rarity typing fix applied')
