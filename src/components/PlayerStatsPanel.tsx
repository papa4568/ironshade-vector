import { useMemo } from 'react';
import '../classBuilds.css';
import { applyShipBonuses, type CampaignState } from '../game/campaign';
import { getAbilityKitForClass } from '../game/classSkills';
import { buildIdentity, deriveCombatBuild, gearResonanceForProfile, operatorClassDefinitions, operatorClassForProfile, specializationDefinitions, vanguardCapstoneInteractionFor, xpProgress, type PlayerProfile } from '../game/meta';
import { createSimulation, type WeaponId } from '../game/sim';

type Props = { profile: PlayerProfile; campaign: CampaignState };
type StatDatum = { label: string; value: string; hint: string };

const weaponLabels: Record<WeaponId, string> = { carbine: 'Carbine', breacher: 'Breacher', rail: 'Rail Lance' };
const mechanicLabels: Record<string, string> = {
  railFragment: 'Rail Fragment Cascade', dodgeVent: 'Dodge Heat Vent', magRedirect: 'MAG Redirect', breacherPropulsion: 'Breacher Propulsion',
  markWeakArmor: 'MARK Weak-Armor Mapping', arcDrone: 'ARC Relay Drone', recoilVectoring: 'Recoil Vectoring', breachDoctrine: 'Breach Doctrine',
  sensorPenetration: 'Sensor Penetration', widebandMark: 'Wideband MARK', magOverdriveKick: 'MAG Overdrive Kick', arcGroundLoop: 'ARC Ground Loop',
  magBoundarySink: 'MAG Boundary Sink', markExecutionTrace: 'MARK Execution Trace', arcCascadeLattice: 'ARC Cascade Lattice',
  vanguardSiegeRam: 'Vanguard Evolution // Siege Ram', vanguardFaultlineTag: 'Vanguard Evolution // Faultline Tag', vanguardReprisalPulse: 'Vanguard Evolution // Reprisal Pulse',
};

function pct(value: number) { return `${Math.round(value * 100)}%`; }
function signedPct(multiplier: number) { const value = Math.round((multiplier - 1) * 100); return `${value >= 0 ? '+' : ''}${value}%`; }
function number(value: number, digits = 1) { return value.toFixed(digits).replace(/\.0$/, ''); }

function StatCard({ stat }: { stat: StatDatum }) {
  return <article className="player-stat-card"><div><small>{stat.label}</small><b>{stat.value}</b></div><p>{stat.hint}</p></article>;
}

export default function PlayerStatsPanel({ profile, campaign }: Props) {
  const build = useMemo(() => applyShipBonuses(deriveCombatBuild(profile), campaign), [profile, campaign]);
  const sim = useMemo(() => createSimulation(build), [build]);
  const progress = xpProgress(profile);
  const operatorClass = operatorClassForProfile(profile);
  const classDefinition = operatorClassDefinitions.find(definition => definition.id === operatorClass)!;
  const abilityKit = getAbilityKitForClass(operatorClass);
  const resonance = gearResonanceForProfile(profile, operatorClass);
  const specialization = specializationDefinitions.find(definition => definition.id === profile.specialization);
  const activeCapstone = Object.values(profile.abilityMods).map(modId => vanguardCapstoneInteractionFor(profile, modId)).find(Boolean);
  const survival: StatDatum[] = [
    { label: 'Health', value: number(sim.player.maxHp, 0), hint: 'Your life pool. Damage that gets through armor reduces health; reaching 0 ends the attempt.' },
    { label: 'Armor', value: number(sim.player.maxArmor, 0), hint: 'Protective plating that absorbs incoming hits before health. Armor can be broken and restored independently.' },
    { label: 'Capacitor', value: number(sim.player.maxCapacitor, 0), hint: 'Energy available for MAG, MARK, ARC and Rail Lance capacitor costs.' },
    { label: 'Move speed', value: signedPct(build.player.moveSpeedMul), hint: 'Movement modifier from equipped gear, ship systems and progression. 0% is the standard operator pace.' },
    { label: 'Cap recharge', value: signedPct(build.player.capRegenMul), hint: 'How quickly capacitor energy comes back relative to the standard recharge rate.' },
    { label: 'Vacuum resistance', value: pct(build.player.vacuumResistance), hint: 'Reduces exposure damage and decompression danger. Higher values make damaged pressure environments safer.' },
    { label: 'Low-G control', value: `+${Math.round(build.player.lowGControl * 100)}%`, hint: 'Improves braking and directional control in low gravity, where momentum otherwise carries you farther.' },
    { label: 'Vent speed', value: signedPct(build.player.ventSpeedMul), hint: 'Changes how quickly manual weapon venting clears heat. Positive values shorten dangerous overheat windows.' },
  ];
  const activeMechanics = Object.entries(build.mechanics).filter(([, value]) => value === true).map(([key]) => mechanicLabels[key] ?? key);

  return <section className="stats-panel" aria-label="Player statistics">
    <header className="stats-hero"><div><span className="card-kicker">FINAL COMBAT VALUES</span><h2>Current build</h2><p>{buildIdentity(profile)} · Level {profile.level} · {profile.runsCompleted} completed runs</p></div><div className="stats-level"><small>NEXT LEVEL</small><b>{progress.maxed ? 'MAX' : `${Math.round(progress.current)} / ${progress.needed} XP`}</b><span>{profile.progressionPoints} unspent progression point{profile.progressionPoints === 1 ? '' : 's'}</span></div></header>
    <div className="build-class-summary" aria-label="Class and gear build summary"><article className="active"><small>OPERATOR CLASS // {classDefinition.signatureName}</small><b>{classDefinition.name}</b><span>{classDefinition.signatureDescription}</span></article><article className={resonance.tier > 0 ? 'active' : ''}><small>GEAR RESONANCE</small><b>{resonance.count}/6 · TIER {resonance.tier === 2 ? 'II' : resonance.tier === 1 ? 'I' : '0'}</b><span>{resonance.tier === 2 ? classDefinition.resonanceTier2 : resonance.tier === 1 ? classDefinition.resonanceTier1 : 'Equip two resonant frames to activate the first class threshold.'}</span></article><article className={specialization ? 'active' : ''}><small>SPECIALIZATION</small><b>{specialization?.name ?? (profile.level >= 15 ? 'Available' : 'Locked until LV15')}</b><span>{specialization ? `${specialization.identity}${activeCapstone ? ` · CAPSTONE ${activeCapstone.name}` : ''}` : `Class paths: ${classDefinition.specializationIds.map(id => specializationDefinitions.find(definition => definition.id === id)?.name).filter(Boolean).join(' · ')}`}</span></article></div>
    <section className="stats-section"><div className="stats-section-heading"><div><small>SURVIVAL + MOVEMENT</small><h3>Operator frame</h3></div><p>Includes equipped gear, progression and ship bonuses.</p></div><div className="player-stat-grid">{survival.map(stat => <StatCard key={stat.label} stat={stat} />)}</div></section>
    <section className="stats-section"><div className="stats-section-heading"><div><small>WEAPONS</small><h3>Weapon telemetry</h3></div><p>Damage is per projectile. Burst DPS is an estimate before armor, misses, reloads or heat downtime.</p></div><div className="weapon-stat-grid">{(Object.keys(sim.weapons) as WeaponId[]).map(id => { const weapon = sim.weapons[id]; const burst = weapon.damage * weapon.pellets * weapon.rate * weapon.healthMultiplier; return <article className="weapon-stat-card" key={id}><header><small>{weaponLabels[id]}</small><b>{weapon.shortName}</b></header><div className="weapon-stat-values"><span><small>DMG / PROJECTILE</small><b>{number(weapon.damage)}</b></span><span><small>BURST DPS</small><b>{number(burst, 0)}</b></span><span><small>PENETRATION</small><b>{number(weapon.penetration, 0)}</b></span><span><small>ARMOR FACTOR</small><b>{number(weapon.armorDamage, 2)}×</b></span><span><small>MAGAZINE</small><b>{weapon.magazine}</b></span><span><small>RELOAD</small><b>{number(weapon.reloadSeconds, 2)}s</b></span><span><small>HEAT / SHOT</small><b>{Math.round(weapon.heatPerShot * 100)}%</b></span><span><small>RECOIL</small><b>{number(weapon.recoil, 0)}</b></span></div></article>; })}</div><details className="stats-help"><summary>Weapon stat glossary</summary><p><b>Penetration</b> helps shots punch through armor and hard targets. <b>Armor factor</b> multiplies damage dealt specifically to armor. <b>Recoil</b> changes weapon push and handling. Heat accumulation can force venting or downtime.</p></details></section>
    <section className="stats-section"><div className="stats-section-heading"><div><small>CLASS SKILLS</small><h3>{classDefinition.name} active kit</h3></div><p>Power, capacitor cost and cooldown include your current equipment, Lenses, evolutions, and build modifiers.</p></div><div className="ability-stat-grid">{abilityKit.map((ability, index) => { const mod = build.abilities[index]; return <article key={ability.shortName}><small>{ability.shortName}</small><b>{ability.name}</b><div><span>Power <strong>{pct(mod.powerMul)}</strong></span><span>Cost <strong>{number(ability.cost * mod.costMul, 0)} CAP</strong></span><span>Cooldown <strong>{number(ability.cooldown * mod.cooldownMul, 2)}s</strong></span></div></article>; })}</div></section>
    <section className="stats-section mechanics-section"><div className="stats-section-heading"><div><small>BUILD RULES</small><h3>Active behavior changes</h3></div><p>Mechanics that change how attacks or abilities behave, beyond ordinary numerical bonuses.</p></div>{activeMechanics.length || build.singularTraits.length ? <div className="mechanic-chip-grid">{activeMechanics.map(label => <span key={label}>{label}</span>)}{build.singularTraits.map(trait => <span key={trait}>Singular // {trait.replace(/([A-Z])/g, ' $1').trim()}</span>)}</div> : <div className="stats-empty"><b>No rule-changing mechanics active.</b><span>Acquire and equip mechanical modifiers or Singular gear to add behavior-changing effects.</span></div>}</section>
  </section>;
}
