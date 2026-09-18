import { buildIdentity, dominantEquipmentFaction, type PlayerProfile } from '../game/meta';
import type { CampaignState } from '../game/campaign';

type Props = { profile: PlayerProfile; campaign: CampaignState };

const factionAccent = { meridian: '#79b09d', heliostat: '#d8a35c', longarc: '#79a9c6' } as const;

export default function CommandHubVisual({ profile, campaign }: Props) {
  const faction = dominantEquipmentFaction(profile);
  const accent = faction ? factionAccent[faction] : '#88b7aa';
  const shipTier = Object.values(campaign.shipUpgrades).reduce((sum, value) => sum + Number(value || 0), 0);
  const completion = Math.min(100, Math.max(8, campaign.contractsCompleted * 4));
  return <div className="command-visual command-bridge" style={{ '--hub-accent': accent } as React.CSSProperties}>
    <div className="command-bridge-copy">
      <span className="card-kicker">QUIET SIGNAL // COMMAND DECK</span>
      <h2>Ready for tasking.</h2>
      <p>{buildIdentity(profile)}</p>
      <div className="command-visual-tags"><span>OPERATOR LV {profile.level}</span><span>SHIP SYS {shipTier}</span><span>{faction ? `${faction.toUpperCase()} LOADOUT` : 'MIXED LOADOUT'}</span></div>
    </div>

    <div className="bridge-status-stack" aria-label="Command readiness">
      <span><small>VESSEL</small><b>MV Quiet Signal</b></span>
      <span><small>COMBAT CORE</small><b>Nominal</b></span>
      <span><small>RECOVERY LOG</small><b>{campaign.contractsCompleted} contracts</b></span>
    </div>

    <svg className="command-diorama command-bridge-scene" viewBox="0 0 1120 430" role="img" aria-label="MV Quiet Signal command deck with current operator">
      <title>MV Quiet Signal command deck with current operator</title>
      <defs>
        <linearGradient id="bridgeGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#101c1b"/><stop offset=".55" stopColor="#081110"/><stop offset="1" stopColor="#030706"/></linearGradient>
        <linearGradient id="shipHull" x1="0" x2="1"><stop offset="0" stopColor="#172321"/><stop offset=".55" stopColor="#263734"/><stop offset="1" stopColor="#0d1514"/></linearGradient>
        <linearGradient id="visor" x1="0" x2="1"><stop offset="0" stopColor="#1e3439"/><stop offset="1" stopColor="#8dbbc3"/></linearGradient>
        <radialGradient id="holoGlow"><stop offset="0" stopColor="var(--hub-accent)" stopOpacity=".32"/><stop offset="1" stopColor="var(--hub-accent)" stopOpacity="0"/></radialGradient>
        <filter id="softGlow"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>

      <rect width="1120" height="430" fill="url(#bridgeGlass)"/>
      <g opacity=".28" stroke="#38534c" strokeWidth="1">
        <path d="M0 346H1120M0 394H1120"/>
        <path d="M78 0v430M182 0v430M286 0v430M390 0v430M494 0v430M598 0v430M702 0v430M806 0v430M910 0v430M1014 0v430"/>
      </g>
      <g opacity=".46">
        <path d="M0 0h1120v58H0z" fill="#0a1211"/>
        <path d="M0 58 132 104v242L0 389Z" fill="#0b1513" stroke="#253c36"/>
        <path d="M1120 58 988 104v242l132 43Z" fill="#0b1513" stroke="#253c36"/>
        <path d="M132 104 190 68h740l58 36-46 208-98 54H276l-98-54Z" fill="#07100f" stroke="#314d45" strokeWidth="2"/>
      </g>

      <g className="bridge-stars" fill="#b8d4cf">
        <circle cx="420" cy="124" r="1.4"/><circle cx="462" cy="165" r="1"/><circle cx="522" cy="92" r="1.2"/><circle cx="610" cy="134" r="1.1"/><circle cx="684" cy="105" r=".9"/><circle cx="742" cy="162" r="1.4"/><circle cx="815" cy="118" r="1"/><circle cx="850" cy="202" r=".8"/><circle cx="566" cy="201" r=".8"/>
      </g>
      <circle cx="686" cy="190" r="138" fill="url(#holoGlow)" opacity=".72"/>

      <g className="bridge-hologram" transform="translate(570 132)" opacity=".92">
        <ellipse cx="130" cy="116" rx="205" ry="52" fill="none" stroke="var(--hub-accent)" strokeOpacity=".3" strokeWidth="1.5"/>
        <ellipse cx="130" cy="116" rx="154" ry="37" fill="none" stroke="var(--hub-accent)" strokeOpacity=".2"/>
        <path d="M4 112 88 63h246l82 42-42 53H114L42 180l-62-26Z" fill="url(#shipHull)" stroke="var(--hub-accent)" strokeWidth="3"/>
        <path d="M86 66 164 28h130l40 35Z" fill="#172725" stroke="#4b6b63"/>
        <path d="M112 158h262l-47 39H84Z" fill="#0d1816" stroke="#334d47"/>
        <rect x="146" y="94" width="168" height="9" rx="4" fill="var(--hub-accent)" opacity=".62"/>
        <circle cx="165" cy="132" r="10" fill="#07100f" stroke="#8fb8b0"/>
        <circle cx="203" cy="132" r="10" fill="#07100f" stroke="#8fb8b0"/>
        <path d="M6 127h-42l-22 13 25 16H18Z" fill="#12221f" stroke="#45665e"/>
        <path d="M-34 130-66 141-31 151" fill="none" stroke="var(--hub-accent)" strokeWidth="5" opacity=".72"/>
        <text x="215" y="146" textAnchor="middle" fill="#9eb9b2" fontSize="12" fontFamily="monospace" letterSpacing="3">QUIET SIGNAL</text>
      </g>

      <g className="bridge-operator" transform="translate(154 124)">
        <ellipse cx="100" cy="234" rx="74" ry="16" fill="#000" opacity=".36"/>
        <path d="M50 94 75 68h49l30 28 19 112-31 24H58l-32-24Z" fill="#1a2926" stroke="var(--hub-accent)" strokeWidth="4"/>
        <path d="M67 101h72l12 78H55Z" fill="#293b37"/>
        <path d="M72 114h62v22H72z" fill="#0c1514" stroke="#4d6962"/>
        <rect x="83" y="118" width="40" height="14" rx="3" fill="var(--hub-accent)" opacity=".72"/>
        <circle cx="102" cy="48" r="42" fill="#263733" stroke="var(--hub-accent)" strokeWidth="4"/>
        <path d="M65 49c9-26 62-34 75 0-7 21-21 28-38 28S73 70 65 49Z" fill="url(#visor)"/>
        <path d="M36 112 4 161l25 25 35-47M160 112l31 50-25 23-34-47" fill="none" stroke="#344a44" strokeWidth="19" strokeLinecap="round"/>
        <path d="M76 226 63 292M132 226l14 66" stroke="#3c544e" strokeWidth="23" strokeLinecap="round"/>
        <path d="M52 295h29M130 295h31" stroke="#718f86" strokeWidth="10" strokeLinecap="round"/>
        <path d="M45 104 27 128 11 103 32 80ZM159 104l20 23 15-23-22-24Z" fill="#223530" stroke="#4d6a62"/>
      </g>

      <g className="bridge-console" transform="translate(385 302)">
        <path d="M0 56 58 0h400l58 56-34 70H30Z" fill="#0b1513" stroke="#324d45" strokeWidth="2"/>
        <rect x="78" y="28" width="106" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <rect x="202" y="28" width="104" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <rect x="324" y="28" width="104" height="38" rx="5" fill="#0e1e1b" stroke="#456b60"/>
        <path d="M90 47h74M214 47h72M336 47h72" stroke="var(--hub-accent)" strokeWidth="3" opacity=".7"/>
        <circle cx="94" cy="92" r="5" fill="var(--hub-accent)"/><circle cx="116" cy="92" r="5" fill="#d59b5c"/><circle cx="138" cy="92" r="5" fill="#607f76"/>
      </g>

      <g className="bridge-side-data" fontFamily="monospace">
        <text x="908" y="92" fill="#58766e" fontSize="10">NAV / VECTOR</text>
        <text x="908" y="110" fill="#b8cbc5" fontSize="13">TASKING READY</text>
        <text x="908" y="150" fill="#58766e" fontSize="10">HULL</text>
        <text x="908" y="168" fill="#b8cbc5" fontSize="13">NOMINAL</text>
        <text x="908" y="208" fill="#58766e" fontSize="10">RECOVERY INDEX</text>
        <text x="908" y="226" fill="#b8cbc5" fontSize="13">{String(campaign.contractsCompleted).padStart(3, '0')}</text>
      </g>
    </svg>

    <div className="command-progress" aria-label="Campaign activity"><span><i style={{ width: `${completion}%` }} /></span><small>Operational history // {campaign.contractsCompleted} banked contracts</small></div>
  </div>;
}
