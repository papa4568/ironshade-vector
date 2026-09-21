import type { EnemyProtocolId } from './eliteProtocols';

type EliteProtocolPresentation = { shortName: string; tell: string; counter: string };

const presentation: Record<EnemyProtocolId, EliteProtocolPresentation> = {
  reactivePlating: { shortName: 'PLATING', tell: 'Armor panels flash and re-knit between pressure cycles.', counter: 'Sustain armor pressure or disrupt the unit before the repair pulse.' },
  pressureHunter: { shortName: 'PRESSURE', tell: 'Suit vents flare when local atmosphere drops.', counter: 'Repressurize the room, seal the breach, or stagger the pursuer.' },
  vacuumAdapted: { shortName: 'VAC-ADAPT', tell: 'Hard-vac trim remains stable during decompression.', counter: 'Restore pressure or use Magnetic Impulse to break its line.' },
  breachmaker: { shortName: 'BREACH', tell: 'Demolition hardware locks onto nearby cover.', counter: 'Disrupt the carrier or reposition before the firing lane opens.' },
  magneticLock: { shortName: 'MAG-LOCK', tell: 'A blue mass-reference reticle forms on the operator vector.', counter: 'Sensor Spike or Arc disruption prevents the lock; move clear of the well.' },
  gravityAnchor: { shortName: 'ANCHOR', tell: 'Anchor vanes flare and the unit resists pressure and impulse.', counter: 'Arc Tap or Sensor Spike disables the anchor before Magnetic Impulse.' },
  countermassMobility: { shortName: 'COUNTERMASS', tell: 'Countermass pods precess before a lateral vector burst.', counter: 'Magnetic Impulse interrupts committed movement; walls limit the escape.' },
  arcConduit: { shortName: 'ARC-LINK', tell: 'Visible arcs bridge the unit to floor hardware.', counter: 'Arc Tap turns the conductive network into a disruption path.' },
  repairMesh: { shortName: 'REPAIR', tell: 'Green repair tracers link damaged armor and machinery.', counter: 'Disrupt the mesh or destroy repaired hardware faster than it cycles.' },
  droneEscort: { shortName: 'ESCORT', tell: 'Docking lights open on a limited support-drone rack.', counter: 'Kill the finite drones or disrupt the carrier before launch.' },
  emergencyShutters: { shortName: 'SHUTTERS', tell: 'Amber lane markers illuminate before portable shutters rise.', counter: 'Destroy or penetrate the shutters, or reposition before closure.' },
  sensorGhost: { shortName: 'GHOST', tell: 'The silhouette doubles on assisted targeting returns.', counter: 'Sensor Spike resolves the true return; manual aim remains available.' },
  signalJammer: { shortName: 'JAMMER', tell: 'A violet interference ring expands around the unit.', counter: 'Break range or Arc-disrupt the jammer before its pulse.' },
  thermalOverrun: { shortName: 'REDLINE', tell: 'Weapon coils glow before a committed burst and forced cooldown.', counter: 'Break line of sight or interrupt the telegraph, then punish self-stagger.' },
  suppressionCoordinator: { shortName: 'COORD', tell: 'Squad firing markers synchronize around the coordinator.', counter: 'Disrupt or kill the coordinator to break the synchronized window.' },
  penetratorVolley: { shortName: 'PEN-VOLLEY', tell: 'A long straight-line firing solution locks before the volley.', counter: 'Dodge the visible solution, use hard cover, or interrupt it.' },
  salvageInterdictor: { shortName: 'INTERDICT', tell: 'Recovery-tag telemetry is copied to the hostile unit.', counter: 'Intercept the carrier; death restores the package tag.' },
  recoveryDenial: { shortName: 'DENIAL', tell: 'A denial grid forms around tagged objective hardware.', counter: 'Disrupt the projector, isolate the grid, or approach from another lane.' },
};

export function protocolPresentationFor(id: EnemyProtocolId) { return presentation[id]; }
