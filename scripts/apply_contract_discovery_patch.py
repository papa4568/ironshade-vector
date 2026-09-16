from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    Path(path).write_text(text)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count} for {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match for {pattern[:120]!r}')
    write(path, next_text)


replace_once(
    'src/components/ShipHub.tsx',
    "import { bossSingularNames, buildIdentity, locationSingularNames, namedSingularCount, type PlayerProfile } from '../game/meta';",
    "import { buildIdentity, type PlayerProfile } from '../game/meta';",
)
replace_once(
    'src/components/ShipHub.tsx',
    "import { factionEquipmentNames, factionGearChance } from '../game/factionGear';",
    "import { factionGearChance } from '../game/factionGear';",
)
replace_once(
    'src/components/ShipHub.tsx',
    "  const targetedDrops = bossSingularNames(selected?.deepTarget ?? '');\n  const locationDrops = locationSingularNames(selected?.location ?? '', profile.level);\n",
    "",
)
replace_once(
    'src/components/ShipHub.tsx',
    "  const selectedFactionPool = selected ? factionEquipmentNames(selected.sponsor) : [];\n",
    "",
)
replace_once(
    'src/components/ShipHub.tsx',
    "<small>{factionEquipmentNames(faction.id).join(' · ')}</small>",
    "<small>Frame identities and interactions reveal only after recovery.</small>",
)
replace_once(
    'src/components/ShipHub.tsx',
    "Repeatable target reconstruction from banked evidence. Deep victory guarantees one item from the named command target's dedicated Singular pool before the normal second recovery resolves.",
    "Repeatable target reconstruction from banked evidence. Deep victory guarantees one high-value equipment recovery before the normal second recovery resolves; its identity remains unknown until recovered.",
)
replace_once(
    'src/components/ShipHub.tsx',
    "<span>RECOVERY CEILING // RL {selected.maxRecoveryLevel ?? 12}</span><span>FRAME GEN // ≤ {selected.maxFrameGeneration ?? 1}</span>",
    "<span>EQUIPMENT // QUALITY RISES WITH OPERATION TIER</span>",
)
regex_once(
    'src/components/ShipHub.tsx',
    r"<div className=\{`faction-armory-preview faction-\$\{selected\.sponsor\}`\}>.*?(?=\{selected\.anomalyOpportunity)",
    """<div className={`faction-armory-preview faction-${selected.sponsor}`}><small>{factionDisplayName(selected.sponsor).toUpperCase()} // RECOVERY SIGNAL</small><b>{selectedFactionSafeChance}% safe · {selectedFactionDeepChance}% deep sponsor-built recovery chance</b><p>Reputation improves sponsor-aligned recovery odds. Frame names, combinations, and fixed-identity gear remain unidentified until you recover them.</p></div><div className=\"director-box\"><small>UNIDENTIFIED EQUIPMENT RECOVERY</small><p>Deep command victories and some locations can produce unusual fixed-identity equipment. Names and effects are revealed only after recovery.</p></div>""",
)

# Extend the UI regression so future contract-board changes cannot reintroduce item spoilers.
test_path = 'tests/ui-readability.ts'
replace_once(
    test_path,
    "const css = read('src/readability.css');\n",
    "const css = read('src/readability.css');\nconst shipHub = read('src/components/ShipHub.tsx');\n",
)
replace_once(
    test_path,
    "assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');\n",
    """assert(css.includes('.target-readout') && css.includes('.gear-quick-read') && css.includes('.loot-radar'), 'Readability stylesheet is incomplete.');
assert(!shipHub.includes('bossSingularNames'), 'Contract Board still imports unrecovered boss gear names.');
assert(!shipHub.includes('locationSingularNames'), 'Contract Board still imports unrecovered location gear names.');
assert(!shipHub.includes('factionEquipmentNames'), 'Ship UI still exposes unrecovered faction gear names.');
assert(!shipHub.includes('DEDICATED SINGULAR POOL'), 'Contract Board still advertises a named Singular pool.');
assert(!shipHub.includes('LOCATION CHASE POOL'), 'Contract Board still advertises location chase gear before discovery.');
assert(!shipHub.includes('RECOVERY CEILING // RL'), 'Contract Board still leads with opaque recovery-level jargon.');
assert(shipHub.includes('UNIDENTIFIED EQUIPMENT RECOVERY'), 'Contract Board is missing the discovery-safe equipment explanation.');
assert(shipHub.includes('Frame identities and interactions reveal only after recovery.'), 'Faction panel is missing acquisition-first discovery guidance.');
""",
)
replace_once(
    test_path,
    "console.log('UI_READABILITY_PASS discovery=hidden targetHp=visible loot=explained');",
    "console.log('UI_READABILITY_PASS discovery=hidden contractGear=unidentified targetHp=visible loot=explained');",
)

print('contract discovery patch applied')
