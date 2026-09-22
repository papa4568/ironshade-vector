import type { ShipUpgradeId } from './campaign';

export type ShipHardwarePresentation = {
  hardwareName: string;
  location: string;
  mechanism: 'power' | 'drive' | 'armor' | 'cargo' | 'sensor' | 'forge' | 'medical' | 'drone';
  audioProfile: 'power' | 'drive' | 'armor' | 'cargo' | 'sensor' | 'forge' | 'medical' | 'drone';
  tierStates: readonly [string, string, string, string, string, string];
};

export const shipSystemPresentation: Record<ShipUpgradeId, ShipHardwarePresentation> = {
  reactor: {
    hardwareName: 'Heliostat segmented bus stack',
    location: 'AFT POWER SPINE',
    mechanism: 'power',
    audioProfile: 'power',
    tierStates: ['Single bus online', 'Twin bus synchronized', 'Ceramic shunt bank added', 'Thermal bridge hardened', 'Quarantined overdrive mesh', 'Six-stage power spine realized'],
  },
  drive: {
    hardwareName: 'Long Arc vector trim assembly',
    location: 'THRUSTER CONTROL RACK',
    mechanism: 'drive',
    audioProfile: 'drive',
    tierStates: ['Trim rail aligned', 'Dual rail coupled', 'Low-g resolver added', 'Reaction lattice reinforced', 'Predictive trim stack', 'Full vector-control spine'],
  },
  armor: {
    hardwareName: 'Meridian deployment plate carousel',
    location: 'SUIT LOCKER BULKHEAD',
    mechanism: 'armor',
    audioProfile: 'armor',
    tierStates: ['Primary plate rack', 'Twin rack reserve', 'Segmented hardplate cradle', 'Impact baffle layer', 'Command-grade plate bank', 'Full deployment shell reserve'],
  },
  cargo: {
    hardwareName: 'Long Arc recovery sorting lattice',
    location: 'CARGO RECOVERY BAY',
    mechanism: 'cargo',
    audioProfile: 'cargo',
    tierStates: ['Tag sorter online', 'Dual sorting lane', 'Magnetic recovery grid', 'Adaptive salvage routing', 'Deep-field retention cage', 'Full recovery lattice'],
  },
  sensors: {
    hardwareName: 'Long-baseline aperture cluster',
    location: 'FORWARD SENSOR MAST',
    mechanism: 'sensor',
    audioProfile: 'sensor',
    tierStates: ['Primary aperture', 'Twin aperture baseline', 'Phase-corrected cluster', 'Penetration solver online', 'Long-arc calibration cage', 'Full firing-solution array'],
  },
  fabrication: {
    hardwareName: 'Heliostat microforge tool crown',
    location: 'FABRICATION CELL',
    mechanism: 'forge',
    audioProfile: 'forge',
    tierStates: ['Tool head commissioned', 'Precision bed stabilized', 'Reroute tooling expanded', 'Family-lock controller', 'Trace-assisted calibration', 'Full reconstruction crown'],
  },
  medical: {
    hardwareName: 'Meridian trauma reserve cradle',
    location: 'TRAUMA BAY',
    mechanism: 'medical',
    audioProfile: 'medical',
    tierStates: ['Primary reserve cradle', 'Dual reserve manifold', 'Stabilization rack', 'Extended life-support loop', 'Command reserve stack', 'Full trauma continuity bay'],
  },
  drones: {
    hardwareName: 'Heliostat relay drone carousel',
    location: 'ELECTRONIC SUPPORT RACK',
    mechanism: 'drone',
    audioProfile: 'drone',
    tierStates: ['Relay cradle active', 'Rapid-cycle cradle', 'Twin service rail', 'Amplified relay bus', 'Trace-hardened control rack', 'Full support-drone carousel'],
  },
};

export function shipHardwareState(id: ShipUpgradeId, tier: number) {
  const level = Math.max(0, Math.min(6, Math.trunc(tier)));
  if (level === 0) return 'Uncommissioned frame';
  return shipSystemPresentation[id].tierStates[level - 1]!;
}

const audioBaseHz: Record<ShipHardwarePresentation['audioProfile'], number> = {
  power: 92,
  drive: 116,
  armor: 74,
  cargo: 98,
  sensor: 164,
  forge: 132,
  medical: 122,
  drone: 148,
};

export function playShipCommissionAudio(id: ShipUpgradeId, tier: number) {
  if (typeof window === 'undefined') return;
  const AudioCtor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  const context = new AudioCtor();
  const master = context.createGain();
  const now = context.currentTime;
  const base = audioBaseHz[shipSystemPresentation[id].audioProfile];
  const tierLift = Math.max(0, Math.min(5, tier - 1)) * 5;

  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
  master.connect(context.destination);

  const pulses = [
    { offset: 0, multiplier: 1, duration: 0.2, type: 'triangle' as OscillatorType },
    { offset: 0.12, multiplier: 1.5, duration: 0.24, type: 'sine' as OscillatorType },
    { offset: 0.24, multiplier: 2, duration: 0.22, type: 'triangle' as OscillatorType },
  ];

  for (const pulse of pulses) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = pulse.type;
    oscillator.frequency.setValueAtTime(base * pulse.multiplier + tierLift, now + pulse.offset);
    gain.gain.setValueAtTime(0.0001, now + pulse.offset);
    gain.gain.exponentialRampToValueAtTime(0.11, now + pulse.offset + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + pulse.offset + pulse.duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now + pulse.offset);
    oscillator.stop(now + pulse.offset + pulse.duration + 0.01);
  }

  window.setTimeout(() => void context.close(), 650);
}
