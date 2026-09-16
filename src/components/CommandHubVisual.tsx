import { buildIdentity, dominantEquipmentFaction, type PlayerProfile } from '../game/meta';
import type { CampaignState } from '../game/campaign';

type Props = { profile: PlayerProfile; campaign: CampaignState };

const factionAccent = { meridian: '#79b09d', heliostat: '#d8a35c', longarc: '#79a9c6' } as const;

export default function CommandHubVisual({ profile, campaign }: Props) {
  const faction = dominantEquipmentFaction(profile);
  const accent = faction ? factionAccent[faction] : '#88b7aa';
  const shipTier = Object.values(campaign.shipUpgrades).reduce((sum, value) => sum + Number(value || 0), 0);
  return <div className="command-visual" style={{ '--hub-accent': accent } as React.CSSProperties}>
    <div className="command-visual-copy"><span className="card-kicker">QUIET SIGNAL // READY ROOM</span><h2>MV Quiet Signal</h2><p>{buildIdentity(profile)}</p><div className="command-visual-tags"><span>OPERATOR LV {profile.level}</span><span>SHIP SYS {shipTier}</span><span>{faction ? `${faction.toUpperCase()} LOADOUT` : 'MIXED LOADOUT'}</span></div></div>
    <svg className="command-diorama" viewBox="0 0 900 360" role="img" aria-label="Quiet Signal ship and current operator">
      <title>MV Quiet Signal with current operator</title>
      <defs><linearGradient id="shipHull" x1="0" x2="1"><stop offset="0" stopColor="#172321"/><stop offset="0.55" stopColor="#263734"/><stop offset="1" stopColor="#0d1514"/></linearGradient><linearGradient id="visor" x1="0" x2="1"><stop offset="0" stopColor="#2b4147"/><stop offset="1" stopColor="#88b6c0"/></linearGradient></defs>
      <g opacity=".35"><path d="M0 304H900" stroke="#48645d"/><path d="M90 0v360M210 0v360M330 0v360M450 0v360M570 0v360M690 0v360M810 0v360" stroke="#29413c" strokeWidth="1"/><path d="M0 78h900M0 156h900M0 234h900" stroke="#29413c" strokeWidth="1"/></g>
      <g className="hub-ship" transform="translate(300 58)"><path d="M20 126 132 55 447 55 548 113 489 163 179 163 84 198 14 173Z" fill="url(#shipHull)" stroke="var(--hub-accent)" strokeWidth="3"/><path d="M126 72 222 26 384 26 447 55H132Z" fill="#1a2a28" stroke="#55726b" strokeWidth="2"/><path d="M238 39h122l43 16H212Z" fill="#0a1111"/><path d="M171 163h322l-52 45H147Z" fill="#101b1a" stroke="#36504a" strokeWidth="2"/><path d="M94 113h73v42H73Z" fill="#0a1010" stroke="#46635d"/><path d="M503 94 548 113 490 163h-42Z" fill="#233c38"/><rect x="176" y="87" width="247" height="12" rx="6" fill="var(--hub-accent)" opacity=".58"/><circle cx="203" cy="131" r="13" fill="#0a0f10" stroke="#8fb8b0"/><circle cx="246" cy="131" r="13" fill="#0a0f10" stroke="#8fb8b0"/><path d="M18 145h-48l-22 17 24 18h60Z" fill="#152522" stroke="#46665f"/><path d="M-28 149-68 162-26 176" fill="none" stroke="#7dd9c5" strokeWidth="7" opacity=".65"/><text x="290" y="142" textAnchor="middle" fill="#91aaa4" fontSize="15" fontFamily="monospace" letterSpacing="4">QUIET SIGNAL</text></g>
      <g className="hub-operator" transform="translate(112 86)"><ellipse cx="83" cy="222" rx="74" ry="19" fill="#000" opacity=".3"/><path d="M42 85 68 60h33l29 26 18 92-29 20H55l-30-21Z" fill="#1b2927" stroke="var(--hub-accent)" strokeWidth="4"/><path d="M55 90h62l12 70H44Z" fill="#2b3b38"/><rect x="66" y="104" width="41" height="18" rx="4" fill="var(--hub-accent)" opacity=".65"/><circle cx="84" cy="46" r="39" fill="#263532" stroke="var(--hub-accent)" strokeWidth="4"/><path d="M53 46c8-24 54-31 64 0-6 18-18 25-33 25S61 63 53 46Z" fill="url(#visor)"/><path d="M28 103-1 143l22 22 31-38M132 102l29 45-22 20-29-41" fill="none" stroke="#344844" strokeWidth="18" strokeLinecap="round"/><path d="M62 191 50 254M106 191l13 63" stroke="#344844" strokeWidth="23" strokeLinecap="round"/><path d="M45 256h34M103 256h35" stroke="var(--hub-accent)" strokeWidth="9" strokeLinecap="round"/><rect x="29" y="73" width="20" height="49" rx="7" fill="#263734"/><rect x="119" y="73" width="20" height="49" rx="7" fill="#263734"/></g>
      <g transform="translate(20 22)" fill="none" stroke="var(--hub-accent)" opacity=".7"><path d="M0 34V0h34M866 0h34v34M0 304v34h34M866 338h34v-34" strokeWidth="2"/></g>
    </svg>
  </div>;
}
