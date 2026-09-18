import { buildIdentity, dominantEquipmentFaction, type EquipmentSlot, type PlayerProfile } from '../game/meta';
import type { CampaignState } from '../game/campaign';

type Props = { profile: PlayerProfile; campaign: CampaignState };

const factionAccent = { meridian: '#79b09d', heliostat: '#d8a35c', longarc: '#79a9c6' } as const;
const slotOrder: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];

function equippedItem(profile: PlayerProfile, slot: EquipmentSlot) {
  const id = profile.equipped[slot];
  return id ? profile.inventory.find(item => item.id === id) ?? null : null;
}

export default function CommandHubVisual({ profile, campaign }: Props) {
  const faction = dominantEquipmentFaction(profile);
  const accent = faction ? factionAccent[faction] : '#88b7aa';
  const shipTier = Object.values(campaign.shipUpgrades).reduce((sum, value) => sum + Number(value || 0), 0);
  const equipped = slotOrder.map(slot => equippedItem(profile, slot)).filter(Boolean);
  const averageQuality = equipped.length
    ? Math.round(equipped.reduce((sum, item) => sum + (item?.equipmentQuality ?? 0), 0) / equipped.length)
    : 0;
  const bestRecovery = equipped.reduce((best, item) => Math.max(best, item?.recoveryQuality ?? 0), 0);
  const augmentCount = equipped.reduce((sum, item) => sum + (item?.augments?.length ?? 0), 0);
  const socketCount = equipped.reduce((sum, item) => sum + (item?.augmentSlots ?? 0), 0);

  const style = { '--hub-accent': accent } as React.CSSProperties;

  return <div className="command-visual command-bridge command-bridge-compact" style={style}>
    <div className="command-bridge-copy">
      <span className="card-kicker">QUIET SIGNAL // COMMAND READY</span>
      <h2>Tasking nexus online.</h2>
      <p>{buildIdentity(profile)}</p>
      <div className="command-visual-tags">
        <span>OPERATOR LV {profile.level}</span>
        <span>SHIP SYS {shipTier}</span>
        <span>{faction ? `${faction.toUpperCase()} LOADOUT` : 'MIXED LOADOUT'}</span>
      </div>
    </div>

    <div className="bridge-compact-readiness" aria-label="Command readiness">
      <span><small>GEAR LINK</small><b>{equipped.length}/6 ACTIVE</b></span>
      <span><small>FRAME QUALITY</small><b>Q{averageQuality}</b></span>
      <span><small>RECOVERY GRADE</small><b>R{bestRecovery}</b></span>
      <span><small>AUGMENTS</small><b>{augmentCount}/{socketCount} LIVE</b></span>
    </div>

    <svg className="command-bridge-schematic" viewBox="0 0 620 300" aria-hidden="true">
      <defs>
        <linearGradient id="compactBridgeHull" x1="0" x2="1">
          <stop offset="0" stopColor="#101d1b" />
          <stop offset=".55" stopColor="#243632" />
          <stop offset="1" stopColor="#0b1413" />
        </linearGradient>
        <radialGradient id="compactBridgeGlow">
          <stop offset="0" stopColor="var(--hub-accent)" stopOpacity=".22" />
          <stop offset="1" stopColor="var(--hub-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="620" height="300" rx="18" fill="#050b0a" />
      <g opacity=".24" stroke="#38534c" strokeWidth="1">
        <path d="M0 58H620M0 236H620" />
        <path d="M70 0v300M170 0v300M270 0v300M370 0v300M470 0v300M570 0v300" />
      </g>
      <ellipse cx="344" cy="148" rx="236" ry="126" fill="url(#compactBridgeGlow)" />
      <g transform="translate(84 76)">
        <path d="M20 78 118 24h244l90 51-52 72H126l-92 22-56-34Z" fill="url(#compactBridgeHull)" stroke="var(--hub-accent)" strokeWidth="3" />
        <path d="M124 27 196 0h118l42 24Z" fill="#172724" stroke="#4a6a62" />
        <path d="M112 150h294l-46 40H76Z" fill="#0b1513" stroke="#314a44" />
        <rect x="148" y="72" width="184" height="9" rx="4.5" fill="var(--hub-accent)" opacity=".66" />
        <circle cx="174" cy="111" r="10" fill="#06100e" stroke="#89b1a8" />
        <circle cx="212" cy="111" r="10" fill="#06100e" stroke="#89b1a8" />
        <path d="M18 113h-48l-24 14 25 17H30Z" fill="#11211e" stroke="#45645c" />
        <path d="M-26 118-62 130-25 141" fill="none" stroke="var(--hub-accent)" strokeWidth="5" opacity=".68" />
      </g>
      <g transform="translate(430 44)" fill="none" stroke="var(--hub-accent)" opacity=".46">
        <circle cx="66" cy="66" r="50" />
        <circle cx="66" cy="66" r="34" />
        <path d="M66 5v18M66 109v18M5 66h18M109 66h18" />
      </g>
      <g transform="translate(430 196)">
        <rect width="128" height="48" rx="8" fill="#081211" stroke="#315047" />
        <path d="M18 17h92M18 31h58" stroke="var(--hub-accent)" strokeWidth="3" opacity=".62" />
      </g>
    </svg>
  </div>;
}
