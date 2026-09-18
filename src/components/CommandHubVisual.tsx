import { buildIdentity, dominantEquipmentFaction, type EquipmentSlot, type Item, type PlayerProfile } from '../game/meta';
import type { CampaignState } from '../game/campaign';

type Props = { profile: PlayerProfile; campaign: CampaignState };

const factionAccent = { meridian: '#79b09d', heliostat: '#d8a35c', longarc: '#79a9c6' } as const;
const slotOrder: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];
const slotLabel: Record<EquipmentSlot, string> = {
  carbine: 'Carbine',
  breacher: 'Breacher',
  rail: 'Rail Lance',
  suit: 'Combat Suit',
  rig: 'Systems Rig',
  implant: 'Implant',
};
const rarityAccent = {
  Field: '#9fb0ab',
  Refined: '#69bfff',
  Prototype: '#c491f2',
  Singular: '#f3b15f',
} as const;

function equippedItem(profile: PlayerProfile, slot: EquipmentSlot) {
  const id = profile.equipped[slot];
  return id ? profile.inventory.find(item => item.id === id) ?? null : null;
}
function itemSignal(item: Item | null) {
  return item ? rarityAccent[item.rarity] : '#52625d';
}
function compactName(value: string, max = 28) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
function itemDetails(item: Item | null) {
  if (!item) return 'No deployment package assigned';
  const modifiers = item.modifiers.length;
  const augments = item.augments?.length ?? 0;
  return `Q${item.equipmentQuality ?? 0} · ${modifiers} MOD${modifiers === 1 ? '' : 'S'} · ${augments}/${item.augmentSlots ?? 0} AUG`;
}

export default function CommandHubVisual({ profile, campaign }: Props) {
  const faction = dominantEquipmentFaction(profile);
  const accent = faction ? factionAccent[faction] : '#88b7aa';
  const shipTier = Object.values(campaign.shipUpgrades).reduce((sum, value) => sum + Number(value || 0), 0);
  const completion = Math.min(100, Math.max(8, campaign.contractsCompleted * 4));

  const loadout = slotOrder.map(slot => ({ slot, item: equippedItem(profile, slot) }));
  const equipped = loadout.filter(entry => entry.item);
  const weapon = equippedItem(profile, 'carbine') ?? equippedItem(profile, 'breacher') ?? equippedItem(profile, 'rail');
  const suit = equippedItem(profile, 'suit');
  const rig = equippedItem(profile, 'rig');
  const implant = equippedItem(profile, 'implant');
  const modifierCount = equipped.reduce((sum, entry) => sum + (entry.item?.modifiers.length ?? 0), 0);
  const augmentCount = equipped.reduce((sum, entry) => sum + (entry.item?.augments?.length ?? 0), 0);
  const socketCount = equipped.reduce((sum, entry) => sum + (entry.item?.augmentSlots ?? 0), 0);
  const averageQuality = equipped.length
    ? Math.round(equipped.reduce((sum, entry) => sum + (entry.item?.equipmentQuality ?? 0), 0) / equipped.length)
    : 0;
  const bestRecovery = equipped.reduce((best, entry) => Math.max(best, entry.item?.recoveryQuality ?? 0), 0);

  const featured = [
    {
      label: 'Primary weapon',
      item: weapon,
      empty: 'No weapon frame linked',
      note: 'Weapon rarity drives the operator hardpoint and command-link color.',
    },
    {
      label: 'Combat suit',
      item: suit,
      empty: 'No combat suit linked',
      note: 'Suit frame, recovery quality, modifiers, and augments are reflected here.',
    },
    {
      label: 'Systems core',
      item: rig ?? implant,
      empty: 'No systems core linked',
      note: 'Rig and implant packages define the visible systems layer.',
    },
  ];

  const style = {
    '--hub-accent': accent,
    '--hub-weapon': itemSignal(weapon),
    '--hub-suit': itemSignal(suit),
    '--hub-rig': itemSignal(rig),
    '--hub-implant': itemSignal(implant),
  } as React.CSSProperties;

  return <div className="command-visual command-bridge command-bridge-overhaul" style={style}>
    <div className="command-bridge-copy">
      <span className="card-kicker">QUIET SIGNAL // COMMAND DECK</span>
      <h2>Tasking nexus online.</h2>
      <p>{buildIdentity(profile)}</p>
      <div className="command-visual-tags">
        <span>OPERATOR LV {profile.level}</span>
        <span>SHIP SYS {shipTier}</span>
        <span>{faction ? `${faction.toUpperCase()} LOADOUT` : 'MIXED LOADOUT'}</span>
      </div>
      <div className="bridge-readiness-band">
        <div><small>GEAR LINK</small><b>{equipped.length}/6 ACTIVE</b></div>
        <div><small>FRAME QUALITY</small><b>Q{averageQuality}</b></div>
        <div><small>MOD LATTICE</small><b>{modifierCount} MODS</b></div>
        <div><small>AUGMENTS</small><b>{augmentCount}/{socketCount} LIVE</b></div>
      </div>
    </div>

    <div className="bridge-status-stack" aria-label="Command readiness">
      <span><small>VESSEL</small><b>MV Quiet Signal</b></span>
      <span><small>COMBAT CORE</small><b>{equipped.length >= 4 ? 'Synchronized' : 'Partial loadout'}</b></span>
      <span><small>RECOVERY GRADE</small><b>R{bestRecovery}</b></span>
      <span><small>RECOVERY LOG</small><b>{campaign.contractsCompleted} contracts</b></span>
    </div>

    <svg className="command-diorama command-bridge-scene" viewBox="0 0 1120 430" role="img" aria-label="MV Quiet Signal command deck with current equipped operator">
      <title>MV Quiet Signal command deck with current equipped operator</title>
      <defs>
        <linearGradient id="bridgeGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#101c1b"/><stop offset=".55" stopColor="#081110"/><stop offset="1" stopColor="#030706"/></linearGradient>
        <linearGradient id="shipHull" x1="0" x2="1"><stop offset="0" stopColor="#172321"/><stop offset=".55" stopColor="#263734"/><stop offset="1" stopColor="#0d1514"/></linearGradient>
        <linearGradient id="visor" x1="0" x2="1"><stop offset="0" stopColor="#20363d"/><stop offset="1" stopColor="#9fd9e3"/></linearGradient>
        <radialGradient id="holoGlow"><stop offset="0" stopColor="var(--hub-accent)" stopOpacity=".36"/><stop offset="1" stopColor="var(--hub-accent)" stopOpacity="0"/></radialGradient>
        <radialGradient id="suitGlow"><stop offset="0" stopColor="var(--hub-suit)" stopOpacity=".25"/><stop offset="1" stopColor="var(--hub-suit)" stopOpacity="0"/></radialGradient>
      </defs>

      <rect width="1120" height="430" fill="url(#bridgeGlass)"/>
      <g opacity=".25" stroke="#38534c" strokeWidth="1">
        <path d="M0 110H1120M0 346H1120M0 394H1120"/>
        <path d="M78 0v430M182 0v430M286 0v430M390 0v430M494 0v430M598 0v430M702 0v430M806 0v430M910 0v430M1014 0v430"/>
      </g>
      <g opacity=".48">
        <path d="M0 0h1120v58H0z" fill="#0a1211"/>
        <path d="M0 58 132 104v242L0 389Z" fill="#0b1513" stroke="#253c36"/>
        <path d="M1120 58 988 104v242l132 43Z" fill="#0b1513" stroke="#253c36"/>
        <path d="M132 104 190 68h740l58 36-46 208-98 54H276l-98-54Z" fill="#07100f" stroke="#314d45" strokeWidth="2"/>
      </g>

      <g className="bridge-stars" fill="#b8d4cf">
        <circle cx="420" cy="124" r="1.4"/><circle cx="462" cy="165" r="1"/><circle cx="522" cy="92" r="1.2"/><circle cx="610" cy="134" r="1.1"/><circle cx="684" cy="105" r=".9"/><circle cx="742" cy="162" r="1.4"/><circle cx="815" cy="118" r="1"/><circle cx="850" cy="202" r=".8"/><circle cx="566" cy="201" r=".8"/>
      </g>
      <circle cx="686" cy="184" r="144" fill="url(#holoGlow)" opacity=".74"/>
      <circle cx="264" cy="176" r="96" fill="url(#suitGlow)" opacity=".82"/>

      <g className="bridge-hologram" transform="translate(548 118)" opacity=".95">
        <ellipse cx="152" cy="128" rx="234" ry="60" fill="none" stroke="var(--hub-accent)" strokeOpacity=".26" strokeWidth="1.5"/>
        <ellipse cx="152" cy="128" rx="180" ry="45" fill="none" stroke="var(--hub-accent)" strokeOpacity=".18"/>
        <path d="M4 124 104 62h286l88 48-48 60H128L48 190l-62-24Z" fill="url(#shipHull)" stroke="var(--hub-accent)" strokeWidth="3"/>
        <path d="M106 66 186 26h148l44 38Z" fill="#172725" stroke="#4b6b63"/>
        <path d="M136 172h296l-52 40H106Z" fill="#0d1816" stroke="#334d47"/>
        <rect x="164" y="102" width="194" height="10" rx="5" fill="var(--hub-accent)" opacity=".68"/>
        <circle cx="190" cy="142" r="11" fill="#07100f" stroke="#8fb8b0"/>
        <circle cx="232" cy="142" r="11" fill="#07100f" stroke="#8fb8b0"/>
        <path d="M8 141h-52l-28 15 29 18H18Z" fill="#12221f" stroke="#45665e"/>
        <path d="M-40 146-82 159-39 171" fill="none" stroke="var(--hub-accent)" strokeWidth="5" opacity=".72"/>
        <text x="260" y="160" textAnchor="middle" fill="#9eb9b2" fontSize="12" fontFamily="monospace" letterSpacing="3">QUIET SIGNAL</text>
        <text x="132" y="206" fill="#6fa8b8" fontSize="11" fontFamily="monospace">LOADOUT // {compactName(weapon?.name ?? 'UNASSIGNED', 24)}</text>
        <text x="132" y="224" fill="#d3a56b" fontSize="11" fontFamily="monospace">SUIT // {compactName(suit?.name ?? 'STANDARD ISSUE', 24)}</text>
      </g>

      <g className="bridge-operator" transform="translate(136 104)">
        <ellipse cx="110" cy="252" rx="88" ry="18" fill="#000" opacity=".36"/>
        <path d="M62 108 86 78h51l32 30 22 118-34 26H72l-34-26Z" fill="#162321" stroke="var(--hub-suit)" strokeWidth="4"/>
        <path d="M80 114h78l14 85H66Z" fill="#243733"/>
        <path d="M84 126h68v28H84z" fill="#0c1514" stroke="var(--hub-rig)"/>
        <rect x="92" y="132" width="52" height="16" rx="4" fill="var(--hub-rig)" opacity=".78"/>
        <path d="M84 162h68l10 44H76Z" fill="var(--hub-suit)" opacity=".18"/>
        <circle cx="116" cy="56" r="44" fill="#243634" stroke="var(--hub-accent)" strokeWidth="4"/>
        <path d="M78 58c9-28 68-36 80 0-8 22-22 30-40 30S86 80 78 58Z" fill="url(#visor)"/>
        <path d="M48 126 14 178l28 27 38-52M182 126l34 52-28 25-36-52" fill="none" stroke="var(--hub-weapon)" strokeWidth="18" strokeLinecap="round"/>
        <path d="M90 246 74 320M148 246l16 74" stroke="#3c544e" strokeWidth="23" strokeLinecap="round"/>
        <path d="M62 324h34M148 324h36" stroke="#718f86" strokeWidth="10" strokeLinecap="round"/>
        <path d="M54 120 34 146 16 118 40 92ZM182 120l22 24 17-24-24-26Z" fill="var(--hub-weapon)" opacity=".3" stroke="var(--hub-weapon)"/>
        <path d="M188 206 258 180" stroke="var(--hub-weapon)" strokeWidth="8" strokeLinecap="round"/>
        <path d="M258 180h68l18 10-18 10h-68z" fill="#0d1716" stroke="var(--hub-weapon)" strokeWidth="3"/>
      </g>

      <g className="bridge-console" transform="translate(390 302)">
        <path d="M0 56 58 0h400l58 56-34 70H30Z" fill="#0b1513" stroke="#324d45" strokeWidth="2"/>
        <rect x="78" y="28" width="106" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <rect x="202" y="28" width="104" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <rect x="324" y="28" width="104" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <path d="M90 47h74M214 47h72M336 47h72" stroke="var(--hub-accent)" strokeWidth="3" opacity=".7"/>
        <circle cx="94" cy="92" r="5" fill="var(--hub-accent)"/><circle cx="116" cy="92" r="5" fill="var(--hub-weapon)"/><circle cx="138" cy="92" r="5" fill="var(--hub-rig)"/>
      </g>

      <g className="bridge-side-data" fontFamily="monospace">
        <text x="896" y="92" fill="#58766e" fontSize="10">TACTICAL LINK</text>
        <text x="896" y="110" fill="#b8cbc5" fontSize="13">{equipped.length}/6 SYSTEMS</text>
        <text x="896" y="150" fill="#58766e" fontSize="10">PRIMARY</text>
        <text x="896" y="168" fill="#b8cbc5" fontSize="13">{weapon?.rarity ?? 'UNSET'}</text>
        <text x="896" y="208" fill="#58766e" fontSize="10">RECOVERY INDEX</text>
        <text x="896" y="226" fill="#b8cbc5" fontSize="13">{String(campaign.contractsCompleted).padStart(3, '0')}</text>
        <text x="896" y="266" fill="#58766e" fontSize="10">FRAME QUALITY</text>
        <text x="896" y="284" fill="#b8cbc5" fontSize="13">R{bestRecovery} / Q{averageQuality}</text>
      </g>

      <g className="bridge-callouts" fontFamily="monospace">
        <path d="M342 128h96l20-20" stroke="var(--hub-suit)" strokeWidth="2" fill="none" opacity=".7"/>
        <text x="464" y="104" fill="var(--hub-suit)" fontSize="10">SUIT PROFILE</text>
        <text x="464" y="120" fill="#d5dfdc" fontSize="11">{compactName(suit?.name ?? 'STANDARD ISSUE', 21)}</text>
        <path d="M358 214h86l28 18" stroke="var(--hub-weapon)" strokeWidth="2" fill="none" opacity=".7"/>
        <text x="476" y="240" fill="var(--hub-weapon)" fontSize="10">WEAPON LINK</text>
        <text x="476" y="256" fill="#d5dfdc" fontSize="11">{compactName(weapon?.name ?? 'UNASSIGNED', 22)}</text>
      </g>
    </svg>

    <div className="bridge-gear-panel">
      <div className="bridge-gear-panel-header">
        <small>EQUIPPED OPERATOR KIT</small>
        <b>{equipped.length} ACTIVE SLOTS · R{bestRecovery}</b>
      </div>
      {featured.map(card => <article key={card.label} className={`bridge-feature-card rarity-${card.item?.rarity.toLowerCase() ?? 'empty'}`}>
        <header><span>{card.label}</span><i style={{ background: itemSignal(card.item) }} /></header>
        <b>{card.item?.name ?? card.empty}</b>
        <p>{card.item ? `${card.item.equipmentClass} · ${card.item.rarity.toUpperCase()}` : card.note}</p>
        <small>{card.item ? itemDetails(card.item) : 'Use Build Bay to assign or swap equipment.'}</small>
      </article>)}
      <div className="bridge-gear-summary">
        <span><small>MOD LATTICE</small><b>{modifierCount}</b></span>
        <span><small>AUGMENT SOCKETS</small><b>{augmentCount}/{socketCount}</b></span>
        <span><small>AVERAGE QUALITY</small><b>Q{averageQuality}</b></span>
      </div>
    </div>

    <div className="bridge-gear-strip" aria-label="Equipped operator gear">
      {loadout.map(({ slot, item }) => <article key={slot} className={`bridge-gear-slot rarity-${item?.rarity.toLowerCase() ?? 'empty'}`}>
        <div className="bridge-gear-slot-top"><small>{slotLabel[slot]}</small><span>{item?.rarity ?? 'UNSET'}</span></div>
        <b>{item?.name ?? 'No equipment assigned'}</b>
        <span>{item ? `${item.equipmentClass} · ${itemDetails(item)}` : 'Equip from Build Bay to visualize this slot.'}</span>
      </article>)}
    </div>

    <div className="command-progress" aria-label="Campaign activity">
      <span><i style={{ width: `${completion}%` }} /></span>
      <small>Operational history // {campaign.contractsCompleted} banked contracts · {equipped.length} equipped systems synchronized</small>
    </div>
  </div>;
}
