import type { AffixId, EquipmentSlot } from './meta';

export type EquipmentFaction = 'meridian' | 'heliostat' | 'longarc';

export type FactionFrameDefinition = {
  baseId: string;
  name: string;
  equipmentClass: string;
  core: string;
  preferredAffixes: AffixId[];
};

export type FactionSetDefinition = {
  id: EquipmentFaction;
  displayName: string;
  setName: string;
  philosophy: string;
  twoPiece: string;
  fourPiece: string;
  combatIdentity: string;
};

export const factionSetDefinitions: FactionSetDefinition[] = [
  {
    id: 'meridian',
    displayName: 'Meridian Compact',
    setName: 'Palisade Standard',
    philosophy: 'Pressure integrity, layered survivability, certified armor work, and recoil that behaves the same way every time.',
    twoPiece: '+16 max armor and improved vacuum resistance.',
    fourPiece: 'Additional armor reserve and 14% lower recoil across all weapons.',
    combatIdentity: 'Meridian Palisade Operator',
  },
  {
    id: 'heliostat',
    displayName: 'Heliostat League',
    setName: 'Redline Array',
    philosophy: 'Capacitor headroom, aggressive thermal routing, sensors, and high-output hardware that deliberately lives near the redline.',
    twoPiece: '+14 max capacitor and +14% capacitor regeneration.',
    fourPiece: '+8% weapon damage, much faster cooling, shorter ability cycles, but +10% heat per shot.',
    combatIdentity: 'Heliostat Redline Specialist',
  },
  {
    id: 'longarc',
    displayName: 'Long Arc Assembly',
    setName: 'Wayfarer Retrofit',
    philosophy: 'Low-mass mobility, reclaimed hardware, recoil as propulsion, salvage logic, and useful interactions conventional designers would avoid.',
    twoPiece: '+6% movement speed and stronger low-g control.',
    fourPiece: 'Recoil Vectoring, Dodge Heat Shunt, and low-g Breacher propulsion become active.',
    combatIdentity: 'Long Arc Vector Rigger',
  },
];

export const factionFrames: Record<EquipmentFaction, Record<EquipmentSlot, FactionFrameDefinition>> = {
  meridian: {
    carbine: { baseId: 'meridian-compliance-m7', name: 'Compact M-7 Compliance Spine', equipmentClass: 'Meridian certified coil-carbine frame', core: 'Pressure-rated receiver with conservative impulse timing and repeatable recoil geometry.', preferredAffixes: ['countermass', 'tungsten', 'extendedFeed', 'hypervelocity'] },
    breacher: { baseId: 'meridian-palisade-b4', name: 'Palisade B-4 Breach Cage', equipmentClass: 'Meridian boarding scatter frame', core: 'A reinforced close-quarters cage built to stay predictable when firing from sealed lanes and hard cover.', preferredAffixes: ['countermass', 'tungsten', 'extendedFeed', 'cryoloop'] },
    rail: { baseId: 'meridian-bondhouse-r2', name: 'Bondhouse R-2 Stabilized Rails', equipmentClass: 'Meridian stabilized rail assembly', core: 'Certified rail alignment and heavy counter-recoil hardware favor repeatability over peak output.', preferredAffixes: ['countermass', 'tungsten', 'hypervelocity', 'markShear'] },
    suit: { baseId: 'meridian-rated-mantle', name: 'Compact Rated Pressure Mantle', equipmentClass: 'Meridian combat pressure suit', core: 'Layered seal architecture and redundant plate interfaces prioritize survival in damaged habitats.', preferredAffixes: ['vacuumSeal', 'servoWeave', 'capacitorRecycler', 'dodgeVent'] },
    rig: { baseId: 'meridian-redundant-bus', name: 'Meridian Redundant Systems Bus', equipmentClass: 'Meridian power and thermal rig', core: 'Conservative parallel routing keeps capacitor and thermal systems functional after partial damage.', preferredAffixes: ['capacitorRecycler', 'cryoloop', 'magRedirect', 'dodgeVent'] },
    implant: { baseId: 'meridian-certified-link', name: 'Certified Threat-Control Link', equipmentClass: 'Meridian tactical implant', core: 'A procedural targeting layer that favors verified armor paths and controlled machinery interaction.', preferredAffixes: ['markShear', 'magRedirect', 'capacitorRecycler', 'servoWeave'] },
  },
  heliostat: {
    carbine: { baseId: 'heliostat-flux-m7', name: 'Heliostat Flux M-7', equipmentClass: 'Heliostat high-output coil frame', core: 'An open-coil receiver that trades thermal comfort for projectile energy and sensor-grade timing.', preferredAffixes: ['overdrive', 'hypervelocity', 'cryoloop', 'magRedirect'] },
    breacher: { baseId: 'heliostat-sunforge-b4', name: 'Sunforge B-4 Injector', equipmentClass: 'Heliostat thermal scatter frame', core: 'A hot-running experimental injector with aggressive heat rejection and unusually high close-range output.', preferredAffixes: ['overdrive', 'cryoloop', 'dodgeVent', 'tungsten'] },
    rail: { baseId: 'heliostat-redline-r2', name: 'Heliostat Redline R-2', equipmentClass: 'Heliostat precision rail assembly', core: 'Fast-switching capacitor rails designed around extreme muzzle energy and active thermal management.', preferredAffixes: ['hypervelocity', 'overdrive', 'cryoloop', 'railFracture'] },
    suit: { baseId: 'heliostat-radiant-shell', name: 'Radiant Works EVA Shell', equipmentClass: 'Heliostat prototype pressure suit', core: 'Light composite protection with integrated heat paths and high-bandwidth suit telemetry.', preferredAffixes: ['servoWeave', 'capacitorRecycler', 'dodgeVent', 'vacuumSeal'] },
    rig: { baseId: 'heliostat-open-cycle-rig', name: 'Open-Cycle Thermal Bus', equipmentClass: 'Heliostat power and thermal rig', core: 'An experimental bus that assumes the operator will deliberately manage heat instead of avoiding it.', preferredAffixes: ['cryoloop', 'capacitorRecycler', 'arcDrone', 'overdrive'] },
    implant: { baseId: 'heliostat-vector-array', name: 'Heliostat Vector Array', equipmentClass: 'Heliostat sensor implant', core: 'A high-rate prediction layer that couples targeting, disruption, and capacitor scheduling.', preferredAffixes: ['markShear', 'arcDrone', 'capacitorRecycler', 'magRedirect'] },
  },
  longarc: {
    carbine: { baseId: 'longarc-patchline-m7', name: 'Long Arc Patchline M-7', equipmentClass: 'Long Arc reclaimed coil frame', core: 'A field-serviceable carbine built from interoperable convoy parts and tuned around moving fire.', preferredAffixes: ['countermass', 'hypervelocity', 'magRedirect', 'extendedFeed'] },
    breacher: { baseId: 'longarc-backblast-b4', name: 'Long Arc Backblast B-4', equipmentClass: 'Long Arc recoil-mobility scatter frame', core: 'A deliberately lively scatter frame that treats recoil as another maneuvering input.', preferredAffixes: ['breachPropulsion', 'dodgeVent', 'countermass', 'overdrive'] },
    rail: { baseId: 'longarc-deadreckon-r2', name: 'Deadreckon R-2 Retrofit', equipmentClass: 'Long Arc field rail assembly', core: 'Reclaimed rails with practical optics and modular penetrator hardware for remote-route repairability.', preferredAffixes: ['hypervelocity', 'markShear', 'countermass', 'railFracture'] },
    suit: { baseId: 'longarc-convoy-skin', name: 'Convoy Countermass Skin', equipmentClass: 'Long Arc maneuvering pressure suit', core: 'Patchable pressure layers and oversized maneuvering authority favor survival through motion rather than mass.', preferredAffixes: ['servoWeave', 'vacuumSeal', 'dodgeVent', 'countermass'] },
    rig: { baseId: 'longarc-mutual-aid-rig', name: 'Mutual-Aid Dynamo Rig', equipmentClass: 'Long Arc salvage systems rig', core: 'A repair-friendly bus built to reclaim useful charge and heat margin from improvised field interactions.', preferredAffixes: ['capacitorRecycler', 'dodgeVent', 'arcDrone', 'magRedirect'] },
    implant: { baseId: 'longarc-routefinder-link', name: 'Routefinder Relay Link', equipmentClass: 'Long Arc distributed sensor implant', core: 'A convoy-derived prediction layer that treats machinery, movement, and local sensor relays as one network.', preferredAffixes: ['markShear', 'magRedirect', 'servoWeave', 'capacitorRecycler'] },
  },
};

export function factionEquipmentNames(faction: EquipmentFaction) {
  return Object.values(factionFrames[faction]).map(frame => frame.name);
}

export function factionGearChance(reputation: number, deep: boolean) {
  const base = reputation >= 12 ? 1 : reputation >= 8 ? 0.72 : reputation >= 6 ? 0.56 : reputation >= 0 ? 0.38 : 0.26;
  return Math.min(1, base + (deep && base < 1 ? 0.1 : 0));
}

export function factionSetDefinition(faction: EquipmentFaction) {
  return factionSetDefinitions.find(definition => definition.id === faction)!;
}
