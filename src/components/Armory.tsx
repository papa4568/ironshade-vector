import { useEffect, useMemo, useRef, useState } from 'react';
import '../part3.css';
import '../part11.css';
import '../part12.css';
import '../menuOverhaul.css';
import '../classBuilds.css';
import { classAbilityKits, operatorWeaponFamilyForClass } from '../game/classSkills';
import {
  abilityMods,
  allocateNode,
  buildIdentity,
  comparisonSummary,
  deriveCombatBuild,
  discardItem,
  equipItem,
  factionSetState,
  gearResonanceForProfile,
  itemBuildAffinities,
  itemMatchesSpecializationGearSynergy,
  itemForSlot,
  isItemClassCompatible,
  operatorClassDefinitions,
  operatorClassForProfile,
  progressionNodes,
  setAbilityMod,
  setOperatorClass,
  setSpecialization,
  setSpecializationOverclock,
  specializationDefinitions,
  specializationGearSynergyDefinitions,
  specializationGearSynergyForProfile,
  capstoneInteractionFor,
  setProfileSettings,
  unequipSlot,
  xpProgress,
  type AbilityId,
  type EquipmentSlot,
  type Item,
  type PlayerProfile,
} from '../game/meta';
import { factionSetDefinition, type EquipmentFaction } from '../game/factionGear';
import { weaponConfigs, type WeaponId } from '../game/sim';
import { modifierFamilyFor, recoveryQualityLabel, type ModifierFamily } from '../game/lootQuality';
import { augmentDefinition, frameIdentityDefinition, resolveFrameIdentity } from '../game/gearDepth';
import { compareRarity, rarityClassToken, rarityDefinition, rarityDisplayLabel, rarityOrder, type ItemRarity } from '../game/rarity';
import { accessibleAugmentSlots, compatibleAugments, reconstructItem, reconstructionCost, reconstructionGradeCap, reconstructionQualityCap, type ReconstructionAction } from '../game/reconstruction';
import { resourceLabels, type CampaignState, type ResourceId, type SalvageWallet } from '../game/campaign';

type Props = {
  profile: PlayerProfile;
  campaign: CampaignState;
  newLootIds: string[];
  onProfileChange: (profile: PlayerProfile | ((current: PlayerProfile) => PlayerProfile)) => void;
  onCampaignChange: (campaign: CampaignState) => void;
  onClose: () => void;
};
type Tab = 'gear' | 'reconstruct' | 'network' | 'protocols' | 'settings';
type InventoryFilter = 'all' | 'new' | 'usable' | 'class-fit' | 'augmented' | 'build-changing' | EquipmentSlot;
type InventorySort = 'recent' | 'quality' | 'recovery' | 'rarity' | 'modifier' | 'augments' | 'level' | 'name';
type RarityFilter = 'all' | ItemRarity;
const tabLabels: Record<Tab, string> = { gear: 'Loadout', reconstruct: 'Crafting', network: 'Progression', protocols: 'Skills', settings: 'Settings' };

const slots: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];
const slotLabels: Record<EquipmentSlot, string> = { carbine: 'Carbine', breacher: 'Breacher', rail: 'Rail Lance', suit: 'Combat Suit', rig: 'Systems Rig', implant: 'Implant' };
const weaponFamilyLessons: Record<WeaponId, { title: string; detail: string }> = {
  breacher: { title: 'Close pressure + recoil movement', detail: 'Vanguard owns Breacher frames: fight close, break armor, and turn backblast into positioning.' },
  rail: { title: 'Precision + deliberate cadence', detail: 'Vector owns Rail Lance frames: create range, stabilize shots, and cash in marked weak points.' },
  carbine: { title: 'Sustained control + systems flow', detail: 'Systems owns Carbine frames: keep steady pressure while abilities route targets, heat, and capacitor.' },
};
const abilitySlotIndex: Record<AbilityId, 0 | 1 | 2> = { mag: 0, mark: 1, arc: 2 };

function rarityClass(item: Item) { return rarityClassToken(item.rarity); }
function factionClass(item: Item | undefined | null) { return item?.faction ? `faction-${item.faction}` : ''; }
function factionLabel(faction: EquipmentFaction | undefined) { return faction ? factionSetDefinition(faction).displayName : ''; }
function qualityClass(item: Item | undefined | null) { return item ? `quality-${item.recoveryQuality ?? 0}` : ''; }
function RarityText({ rarity }: { rarity: Item['rarity'] }) {
  const definition = rarityDefinition(rarity);
  return <><span className="rarity-shape" aria-hidden="true" style={{ color: definition.colorHex }}>{definition.icon}</span>{rarityDisplayLabel(rarity)}</>;
}
function primaryItemEffect(item: Item) { if (item.singularEffect) return item.singularEffect; const mechanical = item.modifiers.find(modifier => modifier.mechanical); if (mechanical) return `${mechanical.label}: ${mechanical.description}`; const first = item.modifiers[0]; return first ? `${first.label}: ${first.description}` : item.core; }
function shortItemEffect(item: Item) { const text = primaryItemEffect(item); return text.length > 118 ? `${text.slice(0, 115)}…` : text; }
function singularSurfaceRule(item: Item) { return item.rarity === 'Singular' && item.singularEffect ? `FIXED RULE // ${shortItemEffect(item)}` : ''; }
function frameIdentity(item: Item) { return resolveFrameIdentity(item.slot, item.frameIdentity, `${item.baseId}:${item.name}`); }
function highestModifierGrade(item: Item) { return item.modifiers.reduce((highest, modifier) => Math.max(highest, modifier.grade ?? 3), 0); }
function isBuildChangingItem(profile: PlayerProfile, item: Item) { return !!item.singularEffect || item.modifiers.some(modifier => modifier.mechanical) || itemMatchesSpecializationGearSynergy(profile, item); }
function inventorySearchText(item: Item) {
  const augments = (item.augments ?? []).map(augmentDefinition);
  return `${item.name} ${item.baseId} ${item.rarity} ${rarityDisplayLabel(item.rarity)} ${item.equipmentClass} ${item.core} ${item.recoverySource ?? ''} rl${item.recoveryLevel ?? 1} gen${item.frameGeneration ?? 1} q${item.equipmentQuality ?? 0} ${item.faction ?? ''} ${factionLabel(item.faction)} ${frameIdentityDefinition(frameIdentity(item)).name} ${item.modifiers.map(modifier => `g${modifier.grade ?? 3} ${modifier.label} ${modifier.description}`).join(' ')} ${augments.map(augment => `${augment.hardware} ${augment.name} ${augment.description}`).join(' ')}`.toLowerCase();
}

function RarityLegend() {
  return <div className="rarity-contract-legend" aria-label="Equipment rarity guide">{rarityOrder.map(rarity => { const definition = rarityDefinition(rarity); return <div key={rarity} className={rarityClassToken(rarity)}><span className="rarity-shape" aria-hidden="true" style={{ color: definition.colorHex }}>{definition.icon}</span><div><b>{rarityDisplayLabel(rarity)}</b><small>{definition.meaning}</small></div></div>; })}</div>;
}
function costLabel(cost: Partial<SalvageWallet>) {
  const entries = (Object.entries(cost) as Array<[ResourceId, number]>).filter(([, value]) => value > 0);
  return entries.length ? entries.map(([key, value]) => `${value} ${resourceLabels[key]}`).join(' · ') : 'No salvage cost';
}

function effectiveWeapon(profile: PlayerProfile, id: WeaponId) {
  const build = deriveCombatBuild(profile);
  const base = weaponConfigs[id];
  const mod = build.weapon[id];
  return { damage: base.damage * mod.damageMul, velocity: base.projectileSpeed * mod.speedMul, penetration: base.penetration + mod.penetrationAdd, recoil: base.recoil * mod.recoilMul, heat: base.heatPerShot * mod.heatPerShotMul, magazine: Math.max(1, Math.round(base.magazine + mod.magazineAdd)) };
}
function candidateProfile(profile: PlayerProfile, item: Item): PlayerProfile { return { ...profile, equipped: { ...profile.equipped, [item.slot]: item.id } }; }
function Delta({ label, current, candidate, lowerIsBetter = false }: { label: string; current: number; candidate: number; lowerIsBetter?: boolean }) {
  const delta = candidate - current;
  const favorable = lowerIsBetter ? delta < -0.001 : delta > 0.001;
  const unfavorable = lowerIsBetter ? delta > 0.001 : delta < -0.001;
  const digits = label === 'MAG' ? 0 : 1;
  const format = (value: number) => value.toFixed(digits);
  const deltaCopy = Math.abs(delta) < 0.001 ? 'NO CHANGE' : (delta > 0 ? '+' : '') + delta.toFixed(digits);
  return <article className={'impact-stat ' + (favorable ? 'better' : unfavorable ? 'worse' : '')}><span>{label}</span><div className="impact-values"><small>{format(current)}</small><i aria-hidden="true">→</i><b>{format(candidate)}</b></div><em>{deltaCopy}</em></article>;
}

function ModifierGroup({ item, family }: { item: Item; family: ModifierFamily }) {
  const modifiers = item.modifiers.filter(modifier => (modifier.family ?? modifierFamilyFor(modifier.id)) === family);
  return (
    <section className={`modifier-family ${family}`}>
      <header><b>{family.toUpperCase()} MODS</b><span>{modifiers.length}</span></header>
      {modifiers.length === 0 ? <p>No {family} modifiers installed.</p> : modifiers.map(modifier => (
        <div key={modifier.id} className={modifier.mechanical ? 'mechanical-mod' : ''}>
          <b>G{modifier.grade ?? 3} // {modifier.label}{modifier.mechanical ? ' // MECHANICAL' : ''}</b>
          <span>{modifier.description}</span>
        </div>
      ))}
    </section>
  );
}

function GearComparison({ profile, item, fabrication }: { profile: PlayerProfile; item: Item; fabrication: number }) {
  const equipped = itemForSlot(profile, item.slot);
  const summary = comparisonSummary(item, equipped);
  const weaponSlot = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? item.slot : null;
  const identity = frameIdentityDefinition(frameIdentity(item));
  const activeClassId = operatorClassForProfile(profile);
  const activeClass = operatorClassDefinitions.find(definition => definition.id === activeClassId)!;
  const activeWeaponFamily = operatorWeaponFamilyForClass(activeClassId);
  const classCompatible = isItemClassCompatible(profile, item);
  const weaponOwner = weaponSlot ? operatorClassDefinitions.find(definition => operatorWeaponFamilyForClass(definition.id) === weaponSlot) : null;
  const proposed = classCompatible ? candidateProfile(profile, item) : profile;
  const currentBuild = deriveCombatBuild(profile);
  const candidateBuild = deriveCombatBuild(proposed);
  const classAffinities = itemBuildAffinities(item);
  const classMatched = classAffinities.includes(activeClassId);
  const currentGearSynergy = specializationGearSynergyForProfile(profile);
  const candidateGearSynergy = specializationGearSynergyForProfile(proposed);
  const itemGearLinked = itemMatchesSpecializationGearSynergy(profile, item);
  const augments = (item.augments ?? []).map(augmentDefinition);
  const topModifierGrade = highestModifierGrade(item);
  const accessibleSockets = accessibleAugmentSlots(item, fabrication);
  const compatibleHardware = compatibleAugments(item).filter(augment => !(item.augments ?? []).includes(augment.id));
  const equipLevelReady = item.levelRequirement <= profile.level;
  const equipReady = equipLevelReady && classCompatible;
  const buildChangingEffects = [
    ...(item.singularEffect ? [{ label: 'SINGULAR SIGNATURE', detail: item.singularEffect }] : []),
    ...item.modifiers.filter(modifier => modifier.mechanical).map(modifier => ({ label: `MECHANICAL MOD // G${modifier.grade ?? 3} ${modifier.label.toUpperCase()}`, detail: modifier.description })),
    ...(itemGearLinked && candidateGearSynergy ? [{ label: `SPECIALIZATION LINK // ${candidateGearSynergy.definition.name.toUpperCase()}`, detail: candidateGearSynergy.definition.description }] : []),
  ];
  const statCards = weaponSlot ? (() => {
    const current = effectiveWeapon(profile, weaponSlot);
    const candidate = effectiveWeapon(proposed, weaponSlot);
    return <div className="compare-stats impact-grid"><Delta label="DMG" current={current.damage} candidate={candidate.damage} /><Delta label="VEL" current={current.velocity} candidate={candidate.velocity} /><Delta label="PEN" current={current.penetration} candidate={candidate.penetration} /><Delta label="RECOIL" current={current.recoil} candidate={candidate.recoil} lowerIsBetter /><Delta label="HEAT/SHOT" current={current.heat * 100} candidate={candidate.heat * 100} lowerIsBetter /><Delta label="MAG" current={current.magazine} candidate={candidate.magazine} /></div>;
  })() : <div className="compare-stats impact-grid"><Delta label="ARMOR" current={currentBuild.player.maxArmorAdd} candidate={candidateBuild.player.maxArmorAdd} /><Delta label="MOVE %" current={(currentBuild.player.moveSpeedMul - 1) * 100} candidate={(candidateBuild.player.moveSpeedMul - 1) * 100} /><Delta label="CAP REGEN %" current={(currentBuild.player.capRegenMul - 1) * 100} candidate={(candidateBuild.player.capRegenMul - 1) * 100} /><Delta label="VAC RES %" current={currentBuild.player.vacuumResistance * 100} candidate={candidateBuild.player.vacuumResistance * 100} /></div>;
  return (
    <>
      <div className="gear-summary-grid">
        {item.rarity === 'Singular' && item.singularEffect && <section className="singular-hero" aria-label="Singular fixed rule"><div><small>✦ SINGULAR // RULE-CHANGER</small><b>{item.name}</b></div><p>{item.singularEffect}</p><span>Fixed identity. Reconstruction can improve frame quality and Augments, but cannot reroll the Singular package.</span></section>}
        <section className="item-effect-panel"><header><small>PRIMARY EFFECT</small><span aria-label={rarityDefinition(item.rarity).accessibleLabel}><RarityText rarity={item.rarity} /></span></header><p>{primaryItemEffect(item)}</p><div className={`gear-class-fit ${classMatched ? 'matched' : ''}`}><small>CLASS RESONANCE</small><b>{classAffinities.map(id => operatorClassDefinitions.find(definition => definition.id === id)?.name).filter(Boolean).join(' / ')}</b><span>{classMatched ? `Counts toward ${activeClass.name} gear resonance.` : classCompatible ? `Compatible support gear; this frame currently resonates with another class path.` : `${weaponOwner?.name ?? 'Another class'} owns this weapon family; ${activeClass.name} cannot equip it.`}</span></div>{candidateGearSynergy && (itemGearLinked || currentGearSynergy?.active) && <div className={`gear-class-fit ${candidateGearSynergy.active ? 'matched' : ''}`}><small>SPECIALIZATION GEAR LINK</small><b>{candidateGearSynergy.definition.name}</b><span>{itemGearLinked ? (candidateGearSynergy.active ? `Equipping this frame activates or maintains ${candidateGearSynergy.definition.name}. ${candidateGearSynergy.definition.description}` : `Linked modifier detected. ${candidateGearSynergy.definition.requirement} to activate.`) : (currentGearSynergy?.active && !candidateGearSynergy.active ? `Equipping this frame breaks ${currentGearSynergy.definition.name}; the linked modifier leaves the active loadout.` : `Current gear link remains active. ${candidateGearSynergy.definition.description}`)}</span></div>}</section>
        <section className="gear-identity-grid" aria-label="Equipment identity and compatibility">
          <div><small>BASE</small><b>{item.baseId}</b><span>{item.equipmentClass}</span></div>
          <div><small>FRAME</small><b>{identity.name}</b><span>GEN {item.frameGeneration ?? 1} · {identity.philosophy}</span></div>
          <div><small>RECOVERY</small><b>RL {item.recoveryLevel ?? 1}</b><span>Q{item.recoveryQuality ?? 0} · {recoveryQualityLabel(item.recoveryQuality ?? 0)}</span></div>
          <div><small>FRAME QUALITY</small><b>{item.equipmentQuality ?? 0}/20</b><span>{item.frameImplicit ?? 'Neutral service geometry.'}</span></div>
          <div><small>MODIFIERS</small><b>{item.modifiers.length ? `${item.modifiers.length} · PEAK G${topModifierGrade}` : 'CLEAN BASE'}</b><span>{item.modifiers.length ? 'Core + Systems grades shown below.' : 'No explicit modifiers installed.'}</span></div>
          <div><small>AUGMENTS</small><b>{augments.length}/{item.augmentSlots ?? 0} INSTALLED</b><span>{accessibleSockets}/{item.augmentSlots ?? 0} sockets accessible · {compatibleHardware.length} compatible hardware option{compatibleHardware.length === 1 ? '' : 's'}</span></div>
          <div><small>SOURCE</small><b>{item.recoverySource ?? 'Legacy recovery'}</b><span>Recovered identity remains attached through reconstruction.</span></div>
          <div className={equipReady ? 'compatible' : 'locked'}><small>COMPATIBILITY</small><b>{!classCompatible ? `${weaponOwner?.name.toUpperCase() ?? 'OTHER CLASS'} ARMAMENT` : equipLevelReady ? 'EQUIP NOW' : `REQUIRES LV ${item.levelRequirement}`}</b><span>{!classCompatible ? `${activeClass.name} owns ${slotLabels[activeWeaponFamily]}. This off-class legacy weapon stays in ship storage and cannot be equipped.` : classMatched ? `${activeClass.name} resonance active.` : 'Universal support slot; equip permission is independent of resonance.'}</span></div>
        </section>
        {buildChangingEffects.length > 0 && <section className="build-change-panel" aria-label="Build-changing equipment effects"><header><small>BUILD-CHANGING EFFECTS</small><b>{buildChangingEffects.length} detected</b></header>{buildChangingEffects.map(effect => <div key={effect.label}><b>{effect.label}</b><span>{effect.detail}</span></div>)}</section>}
        <section className="loadout-impact"><header className="loadout-impact-heading"><div><small>LOADOUT IMPACT</small><b>{slotLabels[item.slot]}</b></div><span>{equipped ? 'VS EQUIPPED' : 'EMPTY SLOT'}</span></header><div className="compare-head"><div><small>CURRENT</small><b>{equipped?.name ?? 'Empty slot'}</b><span>{equipped ? <><RarityText rarity={equipped.rarity} /> · {summary.current}</> : summary.current}</span></div><div className="candidate-card"><small>CANDIDATE</small><b>{item.name}</b><span><RarityText rarity={item.rarity} /> · {summary.candidate}</span></div></div>{statCards}</section>
      </div>
      <details className="gear-deep-details"><summary>Technical details & modifiers</summary>
      <div className={'recovery-quality ' + qualityClass(item)}><b>RECOVERY QUALITY {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0).toUpperCase()}</b><span>SOURCE // {item.recoverySource ?? 'Legacy recovery'}</span></div>
      <div className="frame-signature"><b>FRAME // {identity.name.toUpperCase()} // GEN {item.frameGeneration ?? 1}</b><span>{identity.philosophy}</span>{(item.frameGeneration ?? 1) >= 6 && <em>GEN VI // MATURE GEN V STAT BAND · EXPANDED AUGMENT BUS. Prototype/Singular frames can carry a third socket; full access requires Microforge T2.</em>}<strong>FRAME QUALITY {item.equipmentQuality ?? 0}/20</strong></div>
      <div className="implicit-signature"><b>IMPLICIT PROPERTY</b><span>{item.frameImplicit ?? 'Service geometry // neutral frame behavior.'}</span></div>
      <div className="augment-signature"><b>AUGMENTS // {augments.length}/{item.augmentSlots ?? 0}</b>{augments.length === 0 ? <span>No hardware installed.</span> : augments.map(augment => <span key={augment.id}>{augment.hardware.toUpperCase()} // {augment.name} — {augment.description} TRADEOFF // {augment.tradeoff}</span>)}</div>
      {item.singularEffect && <div className="singular-signature"><b>SIGNATURE // FIXED SINGULAR RULE</b><span>{item.singularEffect}</span></div>}
      {item.faction && <div className={'faction-signature faction-' + item.faction}><b>FACTION FRAME // {factionLabel(item.faction).toUpperCase()}</b><span>Recovered {factionLabel(item.faction)} construction. Multi-frame interactions are only revealed here after they become active in your equipped loadout.</span></div>}
      <div className="modifier-columns"><ModifierGroup item={item} family="core" /><ModifierGroup item={item} family="systems" /></div>
      </details>
    </>
  );
}

function ReconstructionBench({ item, campaign, lockedFamily, onLockFamily, onRun }: { item: Item; campaign: CampaignState; lockedFamily: ModifierFamily; onLockFamily: (family: ModifierFamily) => void; onRun: (action: ReconstructionAction) => void }) {
  const fabrication = campaign.shipUpgrades.fabrication;
  const identity = frameIdentityDefinition(frameIdentity(item));
  const qualityAction: ReconstructionAction = { kind: 'quality' };
  const installed = item.augments ?? [];
  const accessibleSockets = accessibleAugmentSlots(item, fabrication);
  const compatible = compatibleAugments(item).filter(augment => !installed.includes(augment.id));
  const modifierLimit = item.rarity === 'Field' ? 1 : item.rarity === 'Refined' ? 3 : item.rarity === 'Prototype' ? 5 : item.modifiers.length;
  return (
    <section className="reconstruction-bench">
      <header className="bench-heading"><div><small>SELECTED FRAME</small><h2>{item.name}</h2><p>{identity.name} · GEN {item.frameGeneration ?? 1} · RL {item.recoveryLevel ?? 1} · <RarityText rarity={item.rarity} /></p></div><strong>MICROFORGE T{fabrication}</strong></header>
      <div className="bench-frame"><div><b>FRAME QUALITY // {item.equipmentQuality ?? 0}/{reconstructionQualityCap(fabrication)}</b><span>{item.frameImplicit}</span></div><button onClick={() => onRun(qualityAction)}>Improve +2<small>{costLabel(reconstructionCost(item, qualityAction, fabrication))}</small></button></div>
      <div className="bench-caps"><span>GRADE CONTROL // G{reconstructionGradeCap(fabrication)} MAX</span><span>AUGMENT ACCESS // {accessibleSockets}/{item.augmentSlots ?? 0} SOCKETS</span></div>
      {item.rarity === 'Singular' && <div className="bench-guard"><b>FIXED SINGULAR PACKAGE</b><span>Signature and fixed modifiers cannot be rerolled, rerouted, added to, or recalibrated. Frame quality and Augments remain available.</span></div>}
      <div className="lock-row"><b>FAMILY LOCK</b><button className={lockedFamily === 'core' ? 'active' : ''} onClick={() => onLockFamily('core')}>Lock Core</button><button className={lockedFamily === 'systems' ? 'active' : ''} onClick={() => onLockFamily('systems')}>Lock Systems</button><span>Tier 2 recalibration protects the locked family.</span></div>
      <div className="bench-modifiers">
        {item.modifiers.map(modifier => {
          const family = modifier.family ?? modifierFamilyFor(modifier.id);
          const gradeAction: ReconstructionAction = { kind: 'grade', modifierId: modifier.id };
          const rerouteAction: ReconstructionAction = { kind: 'reroute', modifierId: modifier.id };
          const recalibrateAction: ReconstructionAction = { kind: 'recalibrate', modifierId: modifier.id, lockedFamily };
          return <article key={modifier.id}><div><small>{family.toUpperCase()} // G{modifier.grade ?? 3}</small><b>{modifier.label}</b><span>{modifier.description}</span></div><div className="bench-actions"><button onClick={() => onRun(gradeAction)}>+ Grade<small>{costLabel(reconstructionCost(item, gradeAction, fabrication))}</small></button><button disabled={fabrication < 1 || item.rarity === 'Singular'} onClick={() => onRun(rerouteAction)}>Reroute family<small>{costLabel(reconstructionCost(item, rerouteAction, fabrication))}</small></button><button disabled={fabrication < 2 || item.rarity === 'Singular' || family === lockedFamily} onClick={() => onRun(recalibrateAction)}>Recalibrate<small>{costLabel(reconstructionCost(item, recalibrateAction, fabrication))}</small></button></div></article>;
        })}
      </div>
      <div className="add-mod-row"><b>ADD MODIFIER // {item.modifiers.length}/{modifierLimit}</b>{(['core', 'systems'] as ModifierFamily[]).map(family => { const action: ReconstructionAction = { kind: 'add', family }; return <button key={family} disabled={fabrication < 1 || item.rarity === 'Singular' || item.modifiers.length >= modifierLimit} onClick={() => onRun(action)}>Add {family}<small>{costLabel(reconstructionCost(item, action, fabrication))}</small></button>; })}</div>
      <section className="augment-bench"><header><b>AUGMENT HARDWARE</b><span>{installed.length}/{accessibleSockets} accessible sockets occupied</span></header>{installed.length > 0 && <div className="installed-augments">{installed.map(id => { const augment = augmentDefinition(id); const action: ReconstructionAction = { kind: 'removeAugment', augmentId: id }; return <article key={id}><div><small>{augment.hardware}</small><b>{augment.name}</b><span>{augment.description} TRADEOFF // {augment.tradeoff}</span></div><button onClick={() => onRun(action)}>Extract<small>{costLabel(reconstructionCost(item, action, fabrication))}</small></button></article>; })}</div>}<div className="augment-options">{compatible.map(augment => { const action: ReconstructionAction = { kind: 'installAugment', augmentId: augment.id }; return <button key={augment.id} disabled={installed.length >= accessibleSockets} onClick={() => onRun(action)}><b>{augment.name}</b><span>{augment.description}</span><small>TRADEOFF // {augment.tradeoff}</small><em>{costLabel(reconstructionCost(item, action, fabrication))}</em></button>; })}</div></section>
    </section>
  );
}

export default function Armory({ profile, campaign, newLootIds, onProfileChange, onCampaignChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('gear');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lockedFamily, setLockedFamily] = useState<ModifierFamily>('core');
  const [message, setMessage] = useState(newLootIds.length > 0 ? `${newLootIds.length} recovered equipment packages added to ship storage.` : '');
  const [gearQuery, setGearQuery] = useState('');
  const [gearFilter, setGearFilter] = useState<InventoryFilter>(newLootIds.length > 0 ? 'new' : 'all');
  const [gearSort, setGearSort] = useState<InventorySort>('recent');
  const [gearRarity, setGearRarity] = useState<RarityFilter>('all');
  const buildRef = useRef<HTMLElement>(null);
  const selected = profile.inventory.find(item => item.id === selectedId) ?? null;
  const progress = xpProgress(profile);
  const identity = buildIdentity(profile);
  const operatorClass = operatorClassForProfile(profile);
  const operatorClassDefinition = operatorClassDefinitions.find(definition => definition.id === operatorClass)!;
  const activeWeaponFamily = operatorWeaponFamilyForClass(operatorClass);
  const loadoutSlots: EquipmentSlot[] = [activeWeaponFamily, 'suit', 'rig', 'implant'];
  const classResonance = gearResonanceForProfile(profile, operatorClass);
  const activeGearSynergy = specializationGearSynergyForProfile(profile);
  const activeAbilityKit = classAbilityKits[operatorClass];
  const availableSpecializations = specializationDefinitions.filter(definition => definition.operatorClass === operatorClass);
  const classBranchAffinities = new Set<string>(operatorClassDefinition.branchAffinities);
  const doctrineStates = factionSetState(profile);
  const activeDoctrineStates = doctrineStates.filter(state => state.twoPieceActive);
  const storageItemCount = useMemo(() => profile.inventory.filter(item => profile.equipped[item.slot] !== item.id).length, [profile.inventory, profile.equipped]);
  const visibleInventory = useMemo(() => {
    const query = gearQuery.trim().toLowerCase();
    const slotFilter = slots.includes(gearFilter as EquipmentSlot) ? gearFilter as EquipmentSlot : null;
    const items = profile.inventory.filter(item => {
      if (profile.equipped[item.slot] === item.id) return false;
      if (gearFilter === 'new' && !newLootIds.includes(item.id)) return false;
      if (gearFilter === 'usable' && (item.levelRequirement > profile.level || !isItemClassCompatible(profile, item))) return false;
      if (gearFilter === 'class-fit' && !itemBuildAffinities(item).includes(operatorClass)) return false;
      if (gearFilter === 'augmented' && (item.augments ?? []).length === 0) return false;
      if (gearFilter === 'build-changing' && !isBuildChangingItem(profile, item)) return false;
      if (gearRarity !== 'all' && item.rarity !== gearRarity) return false;
      if (slotFilter && item.slot !== slotFilter) return false;
      return !query || inventorySearchText(item).includes(query);
    });
    if (gearSort === 'quality') items.sort((a, b) => (b.recoveryQuality ?? 0) - (a.recoveryQuality ?? 0) || compareRarity(b.rarity, a.rarity) || (b.equipmentQuality ?? 0) - (a.equipmentQuality ?? 0));
    if (gearSort === 'recovery') items.sort((a, b) => (b.recoveryLevel ?? 1) - (a.recoveryLevel ?? 1) || (b.frameGeneration ?? 1) - (a.frameGeneration ?? 1));
    if (gearSort === 'rarity') items.sort((a, b) => compareRarity(b.rarity, a.rarity) || (b.recoveryLevel ?? 1) - (a.recoveryLevel ?? 1) || a.name.localeCompare(b.name));
    if (gearSort === 'modifier') items.sort((a, b) => highestModifierGrade(b) - highestModifierGrade(a) || b.modifiers.length - a.modifiers.length || compareRarity(b.rarity, a.rarity));
    if (gearSort === 'augments') items.sort((a, b) => (b.augments ?? []).length - (a.augments ?? []).length || (b.augmentSlots ?? 0) - (a.augmentSlots ?? 0) || compareRarity(b.rarity, a.rarity));
    if (gearSort === 'level') items.sort((a, b) => b.levelRequirement - a.levelRequirement || compareRarity(b.rarity, a.rarity) || a.name.localeCompare(b.name));
    if (gearSort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [profile, profile.inventory, profile.equipped, profile.level, operatorClass, newLootIds, gearQuery, gearFilter, gearRarity, gearSort]);
  const groups = useMemo(() => { const result = new Map<string, typeof progressionNodes>(); for (const node of progressionNodes) result.set(node.branch, [...(result.get(node.branch) ?? []), node]); return result; }, []);
  const loadoutItems = useMemo(() => Object.fromEntries(loadoutSlots.map(slot => [slot, itemForSlot(profile, slot)])) as Record<EquipmentSlot, Item | undefined>, [profile.equipped, profile.inventory, operatorClass]);
  const equippedSlotCount = loadoutSlots.filter(slot => !!loadoutItems[slot]).length;
  const applyResult = (result: { profile: PlayerProfile; message: string }) => { onProfileChange(result.profile); setMessage(result.message); };
  const equipLatest = (item: Item) => {
    const preview = equipItem(profile, item.id);
    setMessage(preview.message);
    onProfileChange(current => equipItem(current, item.id).profile);
  };
  const unequipLatest = (slot: EquipmentSlot) => {
    const preview = unequipSlot(profile, slot);
    setMessage(preview.message);
    onProfileChange(current => unequipSlot(current, slot).profile);
  };
  const discardLatest = (item: Item) => {
    const preview = discardItem(profile, item.id);
    setMessage(preview.message);
    onProfileChange(current => discardItem(current, item.id).profile);
    if (preview.profile !== profile) setSelectedId(null);
  };
  const selectTab = (value: Tab) => {
    setTab(value);
    if (value === 'reconstruct' && !selectedId && profile.inventory[0]) setSelectedId(profile.inventory[0].id);
    requestAnimationFrame(() => buildRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  };
  useEffect(() => {
    if (!selectedId) return;
    const closeInspector = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', closeInspector);
    return () => window.removeEventListener('keydown', closeInspector);
  }, [selectedId]);
  const runReconstruction = (action: ReconstructionAction) => {
    if (!selected) return;
    const result = reconstructItem(profile, campaign.resources, campaign.shipUpgrades.fabrication, selected.id, action);
    if (result.profile !== profile) onProfileChange(result.profile);
    if (result.wallet !== campaign.resources) onCampaignChange({ ...campaign, resources: result.wallet, lastOutcome: result.message });
    setMessage(result.message);
  };

  return <main ref={buildRef} className="build-bay">
    <header className="build-header"><div><span className="card-kicker">QUIET SIGNAL // OPERATOR BUILD</span><h1>Build</h1><p>{identity} · Level {profile.level} · {profile.progressionPoints} unspent progression point{profile.progressionPoints === 1 ? '' : 's'}</p></div><button className="close-build" onClick={onClose}>Return to ship</button></header>
    <section className="xp-strip" aria-label="Experience progress"><span>LV {profile.level}</span><div><i style={{ width: `${Math.min(100, progress.current / progress.needed * 100)}%` }} /></div><b>{progress.maxed ? 'MAX LEVEL' : `${Math.round(progress.current)} / ${progress.needed} XP`}</b></section>
    <nav className="build-tabs" aria-label="Build sections">{(['gear', 'reconstruct', 'network', 'protocols', 'settings'] as Tab[]).map(value => { const badge = value === 'gear' ? newLootIds.length : value === 'network' ? profile.progressionPoints : 0; return <button key={value} className={tab === value ? 'selected' : ''} onClick={() => selectTab(value)}>{tabLabels[value]}{badge > 0 && <span className="tab-badge">{badge}</span>}</button>; })}</nav>
    {message && <div className="build-message" role="status">{message}</div>}

    {tab === 'gear' && <><section className="gear-discovery-note compact-discovery"><div><small>CLASS ARSENAL // {operatorClassDefinition.name.toUpperCase()}</small><b>{slotLabels[activeWeaponFamily]} is your weapon family.</b><span>New combat recoveries roll only your owned weapon family plus universal Combat Suit, Systems Rig, and Implant slots. Off-class weapons from older saves stay safely stored but cannot equip.</span><details><summary>How equipment discovery works</summary><p>Undiscovered frame interactions remain hidden until you recover and equip the relevant gear. The bay only reveals effects your current collection has actually discovered.</p><RarityLegend /></details></div><div className="discovered-effects" aria-label="Weapon family ownership tutorial">{operatorClassDefinitions.map(definition => { const family = operatorWeaponFamilyForClass(definition.id); const lesson = weaponFamilyLessons[family]; return <article key={definition.id} className="discovered-doctrine"><small>{definition.name.toUpperCase()} // {slotLabels[family].toUpperCase()}</small><b>{lesson.title}</b><span>{lesson.detail}</span></article>; })}{activeDoctrineStates.map(state => <article key={state.definition.id} className={`discovered-doctrine faction-${state.definition.id}`}><small>{state.definition.displayName.toUpperCase()} // DISCOVERED</small><b>Active loadout interaction</b><span>{state.definition.twoPiece}</span>{state.fourPieceActive && <span>{state.definition.fourPiece}</span>}</article>)}</div></section><div className={`gear-layout ${selected ? 'has-selection' : ''}`}>{selected && <button type="button" className="item-inspector-backdrop" aria-label="Close item inspector" onClick={() => setSelectedId(null)} />}<section className="gear-storage"><div className="loadout-heading"><div><small>LOADOUT</small><b>{equippedSlotCount}/4 equipped</b></div><span>Tap a slot to inspect or compare.</span></div><div className="equipment-slots">{loadoutSlots.map(slot => { const item = loadoutItems[slot]; return <button key={`${slot}:${profile.equipped[slot] ?? 'empty'}`} className={`equipped-card ${selectedId === item?.id ? 'selected-slot' : ''} ${item ? rarityClass(item) : ''} ${factionClass(item)}`} onClick={() => item && setSelectedId(item.id)}><small>{slotLabels[slot]}</small><b>{item?.name ?? 'Empty'}</b><span>{item ? <><RarityText rarity={item.rarity} /> · Q{item.equipmentQuality ?? 0}</> : '—'}</span>{item?.rarity === 'Singular' && item.singularEffect && <span className="singular-surface-callout" aria-label="Singular fixed rule">{singularSurfaceRule(item)}</span>}</button>; })}</div><div className="storage-heading"><h2>Ship Storage</h2><span>{visibleInventory.length} shown of {storageItemCount} stowed items</span></div><div className="inventory-tools"><input type="search" value={gearQuery} onChange={event => setGearQuery(event.target.value)} placeholder="Search base, frame, source, modifier, augment…" aria-label="Search ship storage" /><select value={gearRarity} onChange={event => setGearRarity(event.target.value as RarityFilter)} aria-label="Filter ship storage by rarity"><option value="all">All rarities</option>{rarityOrder.map(rarity => <option key={rarity} value={rarity}>{rarityDisplayLabel(rarity)}</option>)}</select><select value={gearSort} onChange={event => setGearSort(event.target.value as InventorySort)} aria-label="Sort ship storage"><option value="recent">Recent order</option><option value="quality">Recovery quality</option><option value="recovery">Recovery level</option><option value="rarity">Rarity · high to low</option><option value="modifier">Top modifier grade</option><option value="augments">Augments installed</option><option value="level">Equip level · high to low</option><option value="name">Name</option></select>{(gearQuery || gearFilter !== 'all' || gearRarity !== 'all' || gearSort !== 'recent') && <button className="inventory-reset" aria-label="Clear storage filters" onClick={() => { setGearQuery(''); setGearFilter('all'); setGearRarity('all'); setGearSort('recent'); }}>Clear</button>}<div className="inventory-filter-scroll" aria-label="Equipment filters"><button className={gearFilter === 'all' ? 'selected' : ''} onClick={() => setGearFilter('all')}>All</button><button className={gearFilter === 'new' ? 'selected' : ''} onClick={() => setGearFilter('new')}>New · {newLootIds.length}</button><button className={gearFilter === 'usable' ? 'selected' : ''} onClick={() => setGearFilter('usable')}>Usable now</button><button className={gearFilter === 'class-fit' ? 'selected' : ''} onClick={() => setGearFilter('class-fit')}>{operatorClassDefinition.name} fit</button><button className={gearFilter === 'augmented' ? 'selected' : ''} onClick={() => setGearFilter('augmented')}>Augmented</button><button className={gearFilter === 'build-changing' ? 'selected' : ''} onClick={() => setGearFilter('build-changing')}>Build-changing</button>{slots.map(slot => <button key={slot} className={gearFilter === slot ? 'selected' : ''} onClick={() => setGearFilter(slot)}>{slotLabels[slot]}</button>)}</div></div><div className="inventory-grid">{visibleInventory.map(item => { const fresh = newLootIds.includes(item.id); const identityDef = frameIdentityDefinition(frameIdentity(item)); return <button key={item.id} className={`inventory-card ${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${factionClass(item)} ${qualityClass(item)}`} onClick={() => setSelectedId(item.id)}><div><small>{slotLabels[item.slot]} · EQUIP LV {item.levelRequirement}</small><em className="rarity-pill" aria-label={rarityDefinition(item.rarity).accessibleLabel}><RarityText rarity={item.rarity} /></em>{item.faction && <em className="faction-mark">{item.faction.toUpperCase()}</em>}{itemBuildAffinities(item).includes(operatorClass) && <em className="class-resonance-pill">{operatorClassDefinition.name.toUpperCase()} FIT</em>}{itemMatchesSpecializationGearSynergy(profile, item) && <em className="class-resonance-pill">SPEC GEAR LINK</em>}{fresh && <em>NEW</em>}</div><b>{item.name}</b><span className={`item-effect-preview ${item.rarity === 'Singular' ? 'singular-rule-preview' : ''}`}>{item.rarity === 'Singular' ? singularSurfaceRule(item) : shortItemEffect(item)}</span><small className="item-depth-line">{identityDef.name} · RL {item.recoveryLevel ?? 1} · G{highestModifierGrade(item) || '—'} PEAK · FRAME Q {item.equipmentQuality ?? 0}/20 · {(item.augments ?? []).length}/{item.augmentSlots ?? 0} AUG</small></button>; })}{visibleInventory.length === 0 && <div className="inventory-empty"><b>{storageItemCount === 0 ? 'Ship storage is empty' : 'No matching equipment'}</b><span>{storageItemCount === 0 ? 'Equipped frames are shown in the operator kit above and return here when unequipped.' : 'Clear filters or search to show the rest of ship storage.'}</span>{storageItemCount > 0 && <button onClick={() => { setGearFilter('all'); setGearRarity('all'); setGearSort('recent'); setGearQuery(''); }}>Clear filters</button>}</div>}</div></section><aside className={'item-inspector ' + (selected ? 'open ' + rarityClass(selected) + ' ' + factionClass(selected) + ' ' + qualityClass(selected) : '')} aria-label="Item comparison">{selected ? <><header className="inspector-header"><div className="inspector-heading"><div className="inspector-badges"><span className="inspector-rarity" aria-label={rarityDefinition(selected.rarity).accessibleLabel}><RarityText rarity={selected.rarity} /></span><span>{slotLabels[selected.slot]}</span><span>EQUIP LV {selected.levelRequirement}</span>{selected.faction && <span>{factionLabel(selected.faction).toUpperCase()}</span>}{profile.equipped[selected.slot] === selected.id && <span className="equipped-badge">EQUIPPED</span>}</div><h2>{selected.name}</h2><p>{selected.equipmentClass}. {selected.core}</p></div><button className="sheet-close" aria-label="Back to ship storage" onClick={() => setSelectedId(null)}>Back to storage</button></header><div className="inspector-scroll" tabIndex={0}><GearComparison profile={profile} item={selected} fabrication={campaign.shipUpgrades.fabrication} /></div><footer className="inspector-actions">{profile.equipped[selected.slot] === selected.id ? <button onClick={() => unequipLatest(selected.slot)}>Unequip</button> : <button className="primary" disabled={!isItemClassCompatible(profile, selected) || selected.levelRequirement > profile.level} onClick={() => equipLatest(selected)}>{!isItemClassCompatible(profile, selected) ? 'Class-locked armament' : selected.levelRequirement > profile.level ? `Requires LV ${selected.levelRequirement}` : `Equip ${slotLabels[selected.slot]}`}</button>}<button className="danger" onClick={() => discardLatest(selected)}>Discard</button></footer></> : <div className="empty-inspector"><b>Select equipment</b><span>Tap an item to compare it against the currently equipped piece.</span></div>}</aside></div></>}

    {tab === 'reconstruct' && <section className="reconstruction-panel"><div className="reconstruction-top"><div><span className="card-kicker">QUIET SIGNAL // RECONSTRUCTION BENCH</span><h2>Controlled equipment work</h2><p>Choose the property you want to change. Recovery Quality affects only the original drop; reconstruction uses salvage and Microforge control.</p></div><div className="resource-ribbon">{(['credits', 'alloys', 'electronics', 'components'] as ResourceId[]).map(key => <span key={key}><small>{resourceLabels[key]}</small><b>{campaign.resources[key]}</b></span>)}</div></div><div className="reconstruct-layout"><aside className="reconstruct-storage">{profile.inventory.map(item => <button key={item.id} className={`${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${qualityClass(item)}`} onClick={() => setSelectedId(item.id)}><small>{slotLabels[item.slot]} · <RarityText rarity={item.rarity} /></small><b>{item.name}</b><span>{frameIdentityDefinition(frameIdentity(item)).name} · Q{item.equipmentQuality ?? 0} · {(item.augments ?? []).length}/{item.augmentSlots ?? 0} AUG</span>{item.rarity === 'Singular' && item.singularEffect && <span className="singular-surface-callout" aria-label="Singular fixed rule">{singularSurfaceRule(item)}</span>}</button>)}</aside>{selected ? <ReconstructionBench item={selected} campaign={campaign} lockedFamily={lockedFamily} onLockFamily={setLockedFamily} onRun={runReconstruction} /> : <div className="empty-inspector"><b>Select equipment</b><span>Choose an item from ship storage to open the reconstruction controls.</span></div>}</div></section>}

    {tab === 'network' && <section className="network-panel">
      <div className="section-copy"><h2>Operator Class & Progression</h2><p>Your class owns one weapon family and establishes an early combat identity plus gear-resonance path. Progression branches, Skill Lenses, and support equipment remain open.</p></div>
      <section className="operator-class-panel" aria-label="Operator classes">
        <header className="operator-class-heading"><div><small>OPERATOR CLASS // FIELD DOCTRINE</small><b>{operatorClassDefinition.name} · {operatorClassDefinition.identity}</b><span>{operatorClassDefinition.description}</span></div><div className="resonance-meter"><small>GEAR RESONANCE</small><b>{classResonance.count}/4</b><span>{classResonance.tier === 2 ? 'TIER II ACTIVE' : classResonance.tier === 1 ? 'TIER I ACTIVE' : 'BUILDING'}</span></div></header>
        <div className="operator-class-grid">{operatorClassDefinitions.map(definition => { const active = definition.id === operatorClass; const resonance = gearResonanceForProfile(profile, definition.id); const kit = classAbilityKits[definition.id]; return <button key={definition.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => applyResult(setOperatorClass(profile, definition.id))}><small>{definition.identity}</small><b>{definition.name}</b><span><strong>{definition.signatureName}</strong> // {definition.signatureDescription}</span><em>{definition.combatLoop}</em><strong>LV1 KIT // {kit.map(ability => ability.shortName).join(' · ')}</strong><strong>{definition.branchAffinities.join(' + ')} affinity · {resonance.count}/4 resonant frames</strong></button>; })}</div>
        <div className="class-resonance-strip"><div className={classResonance.tier >= 1 ? 'active' : ''}><small>TIER I // 2 FRAMES</small><b>{operatorClassDefinition.resonanceTier1}</b></div><div className={classResonance.tier >= 2 ? 'active' : ''}><small>TIER II // 4 FRAMES</small><b>{operatorClassDefinition.resonanceTier2}</b></div></div>
        <p className="class-freedom-note">Vanguard owns Breacher, Vector owns Rail Lance, and Systems owns Carbine. Combat Suit, Systems Rig, and Implant slots are universal; resonance still describes build synergy across those support slots and their modifiers.</p>
      </section>
      <section className={`specialization-panel ${profile.level < 15 ? 'locked' : ''}`}>
        <header><div><small>LV15+ // {operatorClassDefinition.name.toUpperCase()} SPECIALIZATIONS</small><b>Choose a deep class path with an explicit tradeoff</b><span>Specializations deepen your active class while the wider progression tree and universal support gear stay open. Switching operator class clears an incompatible specialization, stows the previous class armament, and restores the newly owned weapon family without rewriting progression nodes.</span></div>{profile.specialization && profile.level >= 15 && <button onClick={() => { onProfileChange(setSpecialization(profile, null)); setMessage('Specialization cleared; class, Network allocations, and equipment are unchanged.'); }}>Clear specialization</button>}</header>
        {profile.level < 15 ? <div className="specialization-lock"><b>REACH OPERATOR LEVEL 15</b><span>Your class, gear resonance, Lenses, and Network remain fully active before specialization unlocks.</span></div> : <div className="specialization-grid">{availableSpecializations.map(definition => { const selectedSpec = profile.specialization === definition.id; const gearLink = specializationGearSynergyDefinitions.find(entry => entry.specialization === definition.id); return <article key={definition.id} className={selectedSpec ? 'selected' : ''}><button className="specialization-select" onClick={() => { onProfileChange(setSpecialization(profile, definition.id)); setMessage(`${definition.name} specialization active // ${definition.tradeoff}`); }}><small>{definition.identity}</small><b>{definition.name}</b><span>{definition.description}</span><em>TRADEOFF // {definition.tradeoff}</em></button>{selectedSpec && <div className="overclock-row"><div><b>LV16 OVERCLOCK</b><span>{profile.level >= 16 ? definition.overclock : 'Reach level 16 to unlock the optional overclock.'}</span><small>{profile.level >= 16 ? `TRADEOFF // ${definition.overclockTradeoff}` : 'LOCKED'}</small></div><button disabled={profile.level < 16} className={profile.specializationOverclock ? 'active' : ''} onClick={() => { const next = !profile.specializationOverclock; onProfileChange(setSpecializationOverclock(profile, next)); setMessage(`${definition.name} overclock ${next ? 'enabled' : 'disabled'}.`); }}>{profile.specializationOverclock ? 'Overclock on' : 'Enable overclock'}</button></div>}{selectedSpec && gearLink && <div className="overclock-row gear-link-row"><div><b>GEAR LINK // {gearLink.name}</b><span>{gearLink.description}</span><small>{activeGearSynergy?.active ? `ACTIVE // ${activeGearSynergy.matchingItemIds.length} LINKED FRAME${activeGearSynergy.matchingItemIds.length === 1 ? '' : 'S'}` : `REQUIRES // ${gearLink.requirement}`}</small></div><strong>{activeGearSynergy?.active ? 'ONLINE' : 'BUILDING'}</strong></div>}</article>; })}</div>}
      </section>
      <div className="network-grid">{[...groups.entries()].map(([branch, nodes]) => <article key={branch} className={`network-branch ${classBranchAffinities.has(branch) ? 'class-affinity' : ''}`}><h3>{branch}{classBranchAffinities.has(branch) && <small>{operatorClassDefinition.name} affinity</small>}</h3>{nodes.map(node => { const allocated = profile.allocatedNodes.includes(node.id); const locked = !!node.requires && !profile.allocatedNodes.includes(node.requires); return <button key={node.id} className={`${allocated ? 'allocated' : ''} ${node.major ? 'major' : ''}`} disabled={allocated || locked || profile.progressionPoints <= 0} onClick={() => applyResult(allocateNode(profile, node.id))}><span>{node.major ? 'MAJOR // ' : ''}{node.name}</span><small>{node.description}</small>{locked && <em>Requires previous node</em>}</button>; })}</article>)}</div>
    </section>}
    {tab === 'protocols' && <section className="protocol-panel">
      <div className="section-copy"><h2>Skill Lenses</h2><p>Your three active skills are class-specific from level 1. Shared Lenses remain open to every class; LV16 class evolutions appear here when your active doctrine supports them.</p></div>
      <div className="protocol-grid">{(['mag', 'mark', 'arc'] as AbilityId[]).map(ability => {
        const kitAbility = activeAbilityKit[abilitySlotIndex[ability]];
        const compatibleMods = abilityMods.filter(mod => mod.ability === ability && (!mod.operatorClass || mod.operatorClass === operatorClass));
        return <article key={ability}>
          <h3>{kitAbility.name} // {kitAbility.shortName}</h3>
          <p className="protocol-skill-copy">{kitAbility.description}</p>
          <button className={!profile.abilityMods[ability] ? 'selected' : ''} onClick={() => onProfileChange(setAbilityMod(profile, ability, null))}><b>{operatorClassDefinition.name} Standard</b><span>Use the native {kitAbility.name} behavior with no additional lens tradeoff.</span></button>
          {compatibleMods.map(mod => {
            const locked = profile.level < (mod.minLevel ?? 1);
            const capstone = capstoneInteractionFor(profile, mod.id);
            return <button key={mod.id} disabled={locked} className={profile.abilityMods[ability] === mod.id ? 'selected' : ''} onClick={() => { onProfileChange(setAbilityMod(profile, ability, mod.id)); setMessage(`${mod.name} installed on ${kitAbility.name}.`); }}>
              <b>{mod.name}</b>
              <span>{locked ? `Unlocks at LV${mod.minLevel}. ${mod.description}` : mod.description}</span>
              <small>{mod.evolution ? `LV${mod.minLevel} ${operatorClassDefinition.name.toUpperCase()} EVOLUTION // ` : ''}TRADEOFF // {mod.tradeoff}</small>
              {capstone && <small>CAPSTONE LINK // {capstone.name} // {capstone.description}</small>}
            </button>;
          })}
        </article>;
      })}</div>
    </section>}
    {tab === 'settings' && <section className="settings-panel"><div className="section-copy"><h2>Controls & Feedback</h2><p>Combat accessibility and feedback preferences save with the local operator profile.</p></div><label><span><b>Touch aim assistance</b><small>Sets how readily assisted FIRE acquires a nearby visible threat.</small></span><select value={profile.settings.aimAssist} onChange={event => onProfileChange(setProfileSettings(profile, { aimAssist: event.target.value as PlayerProfile['settings']['aimAssist'] }))}><option value="light">Light</option><option value="balanced">Balanced</option></select></label><label><span><b>Assisted fire tracking</b><small>When on, holding FIRE tracks a nearby threat. Turn it off for fully manual touch aiming.</small></span><input type="checkbox" checked={profile.settings.rightStickFire} onChange={event => onProfileChange(setProfileSettings(profile, { rightStickFire: event.target.checked }))} /></label><label><span><b>Screen shake</b><small>Applies only to the combat canvas, never the HUD.</small></span><input type="checkbox" checked={profile.settings.screenShake} onChange={event => onProfileChange(setProfileSettings(profile, { screenShake: event.target.checked }))} /></label><label><span><b>Effect intensity</b><small>Reduced lowers debris, glow and pressure streak density without changing simulation rules.</small></span><select value={profile.settings.effectIntensity} onChange={event => onProfileChange(setProfileSettings(profile, { effectIntensity: event.target.value as PlayerProfile['settings']['effectIntensity'] }))}><option value="full">Full</option><option value="reduced">Reduced</option></select></label><label><span><b>Combat effects volume</b><small>Weapons, impacts, breaches, abilities and enemy cues.</small></span><input type="range" min="0" max="1" step="0.05" value={profile.settings.effectsVolume} onChange={event => onProfileChange(setProfileSettings(profile, { effectsVolume: Number(event.target.value) }))} /></label><label><span><b>Interface volume</b><small>Ship controls and recovery confirmation.</small></span><input type="range" min="0" max="1" step="0.05" value={profile.settings.uiVolume} onChange={event => onProfileChange(setProfileSettings(profile, { uiVolume: Number(event.target.value) }))} /></label><label><span><b>Mobile haptics</b><small>Restrained vibration for heavy fire, damage, dodges and breaches when supported.</small></span><input type="checkbox" checked={profile.settings.haptics} onChange={event => onProfileChange(setProfileSettings(profile, { haptics: event.target.checked }))} /></label><label><span><b>Share anonymous run telemetry</b><small>Uploads anonymous balance telemetry and one-second position checkpoints after extractions or failed attempts. No account or device identifier is stored with a run.</small></span><input type="checkbox" checked={profile.settings.telemetrySharing} onChange={event => onProfileChange(setProfileSettings(profile, { telemetrySharing: event.target.checked }))} /></label><div className="control-reference"><div><b>Desktop</b><span>WASD move · mouse aim · LMB fire · class armament · Q/E/F {activeAbilityKit.map(ability => ability.shortName).join('/')} · Space dodge · X interact · R reload · V vent</span></div><div><b>Mobile</b><span>Left stick move · hold FIRE for assisted tracking · drag the right battlefield for precision aim · class armament · {activeAbilityKit.map(ability => ability.shortName).join('/')} · DODGE · ACT nearby systems · VENT when hot</span></div><button onClick={() => { onProfileChange(setProfileSettings(profile, { tutorialComplete: false })); setMessage('Field tutorial will replay on the next deployment.'); }}>Replay field tutorial</button></div></section>}
  </main>;
}
