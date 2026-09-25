import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../part3.css';
import '../part11.css';
import '../part12.css';
import '../menuOverhaul.css';
import '../classBuilds.css';
import '../guide.css';
import { ActionRequirement, ProgressiveDisclosure, type RequirementPresentation } from './UiPrimitives';
import { classAbilityKits, operatorWeaponFamilyForClass } from '../game/classSkills';
import { normalizeOperatorNetworkState, operatorNetworkMilestoneActive, operatorNetworkPlan, operatorNetworkRespecCreditCost, operatorNetworkRouteToNode, type OperatorNetworkUnlockContext } from '../game/operatorNetwork';
import { classSkillIconAssets, weaponIconAssets } from '../game/mobileUiAssets';
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
  hudLayoutPresetPatch,
  itemBuildAffinities,
  itemBuildTags,
  itemStatDefinitions,
  itemMatchesSpecializationGearSynergy,
  itemForSlot,
  isItemClassCompatible,
  operatorClassDefinitions,
  operatorClassForProfile,
  progressionNodes,
  rebuildOperatorNetwork,
  refundNode,
  setAbilityMod,
  setOperatorClass,
  setSpecialization,
  setSpecializationOverclock,
  specializationDefinitions,
  specializationGearSynergyDefinitions,
  specializationGearSynergyForProfile,
  capstoneInteractionFor,
  setProfileSettings,
  setOperatorNetworkPlanTargets,
  unequipSlot,
  xpProgress,
  type AbilityId,
  type EquipmentSlot,
  type Item,
  type PlayerProfile,
} from '../game/meta';
import { factionSetDefinition, type EquipmentFaction } from '../game/factionGear';
import { weaponConfigs, type WeaponId } from '../game/sim';
import { modifierFamilyFor, recoveryQualityLabel, type ModifierFamily, type ModifierGrade } from '../game/lootQuality';
import { augmentDefinition, frameIdentityDefinition, resolveFrameIdentity } from '../game/gearDepth';
import { compareRarity, rarityClassToken, rarityDefinition, rarityDisplayLabel, rarityOrder, type ItemRarity } from '../game/rarity';
import { accessibleAugmentSlots, compatibleAugments, craftingBuildIntegration, reconstructItem, reconstructionCost, reconstructionGradeCap, reconstructionPreview, reconstructionQualityCap, type ReconstructionAction } from '../game/reconstruction';
import { craftingFamilyDefinitions, craftingRulesForItem } from '../game/craftingRules';
import { resourceLabels, type CampaignState, type ResourceId, type SalvageWallet } from '../game/campaign';
import type { GuideSectionId } from '../game/guideContent';

type Props = {
  profile: PlayerProfile;
  campaign: CampaignState;
  newLootIds: string[];
  onProfileChange: (profile: PlayerProfile | ((current: PlayerProfile) => PlayerProfile)) => void;
  onCampaignChange: (campaign: CampaignState) => void;
  onOpenGuide: (section: GuideSectionId, returnTab: BuildTab, selectedItemId: string | null) => void;
  guideReturnFocus?: { section: GuideSectionId; tab: BuildTab; selectedItemId: string | null } | null;
  onGuideFocusRestored?: () => void;
  onClose: () => void;
};
export type BuildTab = 'gear' | 'reconstruct' | 'network' | 'protocols' | 'settings';
type Tab = BuildTab;
type InventoryFilter = 'all' | 'new' | 'usable' | 'class-fit' | 'augmented' | 'build-changing' | EquipmentSlot;
type InventorySort = 'recent' | 'quality' | 'recovery' | 'rarity' | 'modifier' | 'augments' | 'level' | 'name';
type RarityFilter = 'all' | ItemRarity;
const tabLabels: Record<Tab, string> = { gear: 'Loadout', reconstruct: 'Crafting', network: 'Progression', protocols: 'Skills', settings: 'Settings' };

const slots: EquipmentSlot[] = ['carbine', 'breacher', 'rail', 'suit', 'rig', 'implant'];
const slotLabels: Record<EquipmentSlot, string> = { carbine: 'Carbine', breacher: 'Breacher', rail: 'Rail Lance', suit: 'Combat Suit', rig: 'Systems Rig', implant: 'Implant' };
const abilitySlotIndex: Record<AbilityId, 0 | 1 | 2> = { mag: 0, mark: 1, arc: 2 };

function specializationNetworkUnlockKeys(campaign: CampaignState) {
  const keys: string[] = [];
  if (campaign.story.blackLattice.status === 'complete') keys.push('boss:khepri');
  if (campaign.story.postKhepri.status === 'complete') keys.push('campaign:dead-reckoning');
  if (campaign.story.interdiction.status === 'complete') keys.push('campaign:interdiction', 'boss:teth');
  if (campaign.story.parallaxDebt.status === 'complete') keys.push('campaign:parallax-debt');
  if (campaign.escalation.status === 'complete') keys.push('boss:oro-7');
  if (campaign.reputation.meridian >= 6) keys.push('faction:meridian:6');
  if (campaign.reputation.longarc >= 6) keys.push('faction:longarc:6');
  if (campaign.reputation.heliostat >= 6) keys.push('faction:heliostat:6');
  return keys;
}

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
  const semanticTags = itemBuildTags(item);
  const semanticStats = itemStatDefinitions(item);
  return `${item.name} ${item.baseId} ${item.rarity} ${rarityDisplayLabel(item.rarity)} ${item.equipmentClass} ${item.core} ${item.recoverySource ?? ''} rl${item.recoveryLevel ?? 1} gen${item.frameGeneration ?? 1} q${item.equipmentQuality ?? 0} ${item.faction ?? ''} ${factionLabel(item.faction)} ${frameIdentityDefinition(frameIdentity(item)).name} ${item.modifiers.map(modifier => `g${modifier.grade ?? 3} ${modifier.label} ${modifier.description}`).join(' ')} ${augments.map(augment => `${augment.hardware} ${augment.name} ${augment.description}`).join(' ')} ${semanticTags.join(' ')} ${semanticStats.map(stat => `${stat.label} ${stat.scope}`).join(' ')}`.toLowerCase();
}

function GuideLink({ section, label, onOpenGuide }: { section: GuideSectionId; label: string; onOpenGuide: (section: GuideSectionId) => void }) {
  return <button type="button" className="guide-context-link" data-guide-link={section} onClick={() => onOpenGuide(section)}>Open Guide // {label}</button>;
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
function itemEquipRequirement(profile: PlayerProfile, item: Item): RequirementPresentation {
  const activeClassId = operatorClassForProfile(profile);
  const activeClass = operatorClassDefinitions.find(definition => definition.id === activeClassId)!;
  const activeWeaponFamily = operatorWeaponFamilyForClass(activeClassId);
  const weaponSlot = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? item.slot : null;
  const weaponOwner = weaponSlot ? operatorClassDefinitions.find(definition => operatorWeaponFamilyForClass(definition.id) === weaponSlot) : null;
  const classCompatible = isItemClassCompatible(profile, item);
  const equipped = itemForSlot(profile, item.slot);
  if (profile.equipped[item.slot] === item.id) {
    return { state: 'active', label: `Equipped in ${slotLabels[item.slot]}`, detail: 'This frame is active now. Unequip returns it to ship storage.' };
  }
  if (!classCompatible) {
    return {
      state: 'blocked',
      label: 'Class-family armament locked',
      reason: `${weaponOwner?.name ?? 'Another operator class'} owns ${slotLabels[item.slot]}; ${activeClass.name} owns ${slotLabels[activeWeaponFamily]}.`,
      nextRequirement: weaponOwner ? `Switch operator class to ${weaponOwner.name} before equipping this armament.` : `Choose equipment compatible with ${activeClass.name}.`,
    };
  }
  if (item.levelRequirement > profile.level) {
    return {
      state: 'blocked',
      label: `Requires operator level ${item.levelRequirement}`,
      reason: `This frame requires LV ${item.levelRequirement}; the current operator is LV ${profile.level}.`,
      nextRequirement: `Reach operator level ${item.levelRequirement} to equip this frame.`,
    };
  }
  return {
    state: 'ready',
    label: `Ready to equip ${slotLabels[item.slot]}`,
    detail: equipped ? `Equipping replaces ${equipped.name}.` : `The ${slotLabels[item.slot]} slot is empty.`,
  };
}

function itemBuildFitLabel(profile: PlayerProfile, item: Item) {
  const activeClassId = operatorClassForProfile(profile);
  const activeClass = operatorClassDefinitions.find(definition => definition.id === activeClassId)!;
  const weaponSlot = item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail' ? item.slot : null;
  if (!isItemClassCompatible(profile, item)) {
    const owner = weaponSlot ? operatorClassDefinitions.find(definition => operatorWeaponFamilyForClass(definition.id) === weaponSlot) : null;
    return owner ? `${owner.name.toUpperCase()} ONLY` : 'CLASS LOCKED';
  }
  if (itemMatchesSpecializationGearSynergy(profile, item)) return 'SPECIALIZATION LINK';
  if (weaponSlot) return `${activeClass.name.toUpperCase()} ARSENAL`;
  if (itemBuildAffinities(item).includes(activeClassId)) return `${activeClass.name.toUpperCase()} FIT`;
  return 'UNIVERSAL SUPPORT';
}

function conciseItemDelta(profile: PlayerProfile, item: Item) {
  const equipped = itemForSlot(profile, item.slot);
  if (!equipped) return 'VS EMPTY SLOT // NEW OPTION';
  if (equipped.id === item.id) return 'CURRENT LOADOUT';
  if (!isItemClassCompatible(profile, item)) return `VS ${equipped.name} // CLASS LOCKED`;
  const proposed = candidateProfile(profile, item);
  const format = (label: string, delta: number, digits = 1, suffix = '') => Math.abs(delta) < 0.001 ? null : `${label} ${delta > 0 ? '+' : ''}${delta.toFixed(digits)}${suffix}`;
  let changes: Array<string | null>;
  if (item.slot === 'carbine' || item.slot === 'breacher' || item.slot === 'rail') {
    const current = effectiveWeapon(profile, item.slot);
    const candidate = effectiveWeapon(proposed, item.slot);
    changes = [
      format('DMG', candidate.damage - current.damage),
      format('RECOIL', candidate.recoil - current.recoil),
      format('HEAT', (candidate.heat - current.heat) * 100, 1, '%'),
    ];
  } else {
    const current = deriveCombatBuild(profile);
    const candidate = deriveCombatBuild(proposed);
    changes = [
      format('ARMOR', candidate.player.maxArmorAdd - current.player.maxArmorAdd, 0),
      format('MOVE', (candidate.player.moveSpeedMul - current.player.moveSpeedMul) * 100, 1, '%'),
      format('CAP', (candidate.player.capRegenMul - current.player.capRegenMul) * 100, 1, '%'),
    ];
  }
  const visibleChanges = changes.filter((value): value is string => !!value).slice(0, 2);
  return `VS ${equipped.name} // ${visibleChanges.length ? visibleChanges.join(' · ') : 'NO CORE STAT CHANGE'}`;
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

function BuildLinkDiff({ label, gained, lost, note }: { label: string; gained: string[]; lost: string[]; note?: string }) {
  const changed = gained.length > 0 || lost.length > 0;
  return (
    <article className={'build-link-row ' + (changed ? 'changed' : 'steady')}>
      <b>{label}</b>
      <div className="build-link-diffs">
        {gained.map(value => <span key={'gain:' + value} className="build-link-diff gain">GAIN // {value}</span>)}
        {lost.map(value => <span key={'loss:' + value} className="build-link-diff loss">LOSE // {value}</span>)}
        {!changed && <span className="build-link-diff steady">NO EQUIPPED CHANGE</span>}
      </div>
      {note && <small>{note}</small>}
    </article>
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
  const semanticTags = itemBuildTags(item);
  const semanticStats = itemStatDefinitions(item);
  const equippedStats = equipped ? itemStatDefinitions(equipped) : [];
  const semanticScopes = [...new Set(semanticStats.map(stat => stat.scope))];
  const equippedStatIds = new Set(equippedStats.map(stat => stat.id));
  const candidateStatIds = new Set(semanticStats.map(stat => stat.id));
  const localCandidateStats = semanticStats.filter(stat => stat.scope === 'local-base' || stat.scope === 'local-affix');
  const localEquippedStats = equippedStats.filter(stat => stat.scope === 'local-base' || stat.scope === 'local-affix');
  const globalCandidateStats = semanticStats.filter(stat => stat.scope === 'global' || stat.scope === 'environment');
  const globalEquippedStats = equippedStats.filter(stat => stat.scope === 'global' || stat.scope === 'environment');
  const skillCandidateStats = semanticStats.filter(stat => stat.scope === 'skill-family');
  const skillEquippedStats = equippedStats.filter(stat => stat.scope === 'skill-family');
  const localGained = localCandidateStats.filter(stat => !equippedStatIds.has(stat.id)).map(stat => stat.label);
  const localLost = localEquippedStats.filter(stat => !candidateStatIds.has(stat.id)).map(stat => stat.label);
  const globalGained = globalCandidateStats.filter(stat => !equippedStatIds.has(stat.id)).map(stat => stat.label);
  const globalLost = globalEquippedStats.filter(stat => !candidateStatIds.has(stat.id)).map(stat => stat.label);
  const skillGained = skillCandidateStats.filter(stat => !equippedStatIds.has(stat.id)).map(stat => stat.label);
  const skillLost = skillEquippedStats.filter(stat => !candidateStatIds.has(stat.id)).map(stat => stat.label);
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
    ...(itemGearLinked && candidateGearSynergy ? [{ label: `SPECIALIZATION GEAR LINK // ${candidateGearSynergy.definition.name.toUpperCase()}`, detail: candidateGearSynergy.definition.description }] : []),
  ];
  const equipRequirement: RequirementPresentation = itemEquipRequirement(profile, item);

  const currentSkillSources = new Set(currentBuild.classSkillFamily.sources);
  const candidateSkillSources = new Set(candidateBuild.classSkillFamily.sources);
  const gainedSkillSources = candidateBuild.classSkillFamily.sources.filter(source => !currentSkillSources.has(source)).map(source => source.replace(':', ' // ').replaceAll('-', ' ').toUpperCase());
  const lostSkillSources = currentBuild.classSkillFamily.sources.filter(source => !candidateSkillSources.has(source)).map(source => source.replace(':', ' // ').replaceAll('-', ' ').toUpperCase());
  const skillTuningChanges = [
    ['POWER', currentBuild.classSkillFamily.powerMul, candidateBuild.classSkillFamily.powerMul, true],
    ['RANGE', currentBuild.classSkillFamily.rangeMul, candidateBuild.classSkillFamily.rangeMul, true],
    ['CONTROL', currentBuild.classSkillFamily.controlMul, candidateBuild.classSkillFamily.controlMul, true],
    ['ARMOR', currentBuild.classSkillFamily.armorMul, candidateBuild.classSkillFamily.armorMul, true],
    ['RECOVERY', currentBuild.classSkillFamily.recoveryMul, candidateBuild.classSkillFamily.recoveryMul, true],
    ['COST', currentBuild.classSkillFamily.costMul, candidateBuild.classSkillFamily.costMul, true],
    ['CHAIN', currentBuild.classSkillFamily.chainBonus, candidateBuild.classSkillFamily.chainBonus, false],
  ].filter(([, current, candidate]) => Math.abs(Number(candidate) - Number(current)) > 0.0001).map(([label, current, candidate, percent]) => {
    const delta = Number(candidate) - Number(current);
    const value = percent ? (delta * 100).toFixed(1) + '%' : delta.toFixed(0);
    return String(label) + ' ' + (delta > 0 ? '+' : '') + value;
  });
  const currentSpecializationName = currentGearSynergy?.active ? currentGearSynergy.definition.name : null;
  const candidateSpecializationName = candidateGearSynergy?.active ? candidateGearSynergy.definition.name : null;
  const specializationGained = candidateSpecializationName && candidateSpecializationName !== currentSpecializationName ? [candidateSpecializationName] : [];
  const specializationLost = currentSpecializationName && currentSpecializationName !== candidateSpecializationName ? [currentSpecializationName] : [];
  const specializationNote = itemGearLinked && candidateGearSynergy
    ? (candidateGearSynergy.active ? 'MATCHED FRAME // Tag threshold met on this frame. Candidate activates or maintains ' + candidateGearSynergy.definition.name + '.' : 'MATCHED FRAME // Tag threshold met on this frame. ' + candidateGearSynergy.definition.requirement + ' to activate.')
    : (candidateGearSynergy?.active ? 'Current specialization link remains online.' : 'No active specialization gear link from this swap.');
  const singularGained = item.singularEffect && item.singularEffect !== equipped?.singularEffect ? [item.singularEffect] : [];
  const singularLost = equipped?.singularEffect && equipped.singularEffect !== item.singularEffect ? [equipped.singularEffect] : [];
  const skillNoteParts = [
    ...gainedSkillSources.map(source => 'source +' + source),
    ...lostSkillSources.map(source => 'source -' + source),
    ...skillTuningChanges,
  ];
  const skillNote = skillNoteParts.length ? skillNoteParts.join(' · ') : 'No class-skill family tuning changes from this swap.';
  const classAffinityNames = classAffinities.map(id => operatorClassDefinitions.find(definition => definition.id === id)?.name).filter(Boolean).join(' / ');

  const statComparisons: Array<{ label: string; current: number; candidate: number; lowerIsBetter?: boolean }> = weaponSlot ? (() => {
    const current = effectiveWeapon(profile, weaponSlot);
    const candidate = effectiveWeapon(proposed, weaponSlot);
    return [
      { label: 'DMG', current: current.damage, candidate: candidate.damage },
      { label: 'VEL', current: current.velocity, candidate: candidate.velocity },
      { label: 'PEN', current: current.penetration, candidate: candidate.penetration },
      { label: 'RECOIL', current: current.recoil, candidate: candidate.recoil, lowerIsBetter: true },
      { label: 'HEAT/SHOT', current: current.heat * 100, candidate: candidate.heat * 100, lowerIsBetter: true },
      { label: 'MAG', current: current.magazine, candidate: candidate.magazine },
    ];
  })() : [
    { label: 'ARMOR', current: currentBuild.player.maxArmorAdd, candidate: candidateBuild.player.maxArmorAdd },
    { label: 'MOVE %', current: (currentBuild.player.moveSpeedMul - 1) * 100, candidate: (candidateBuild.player.moveSpeedMul - 1) * 100 },
    { label: 'CAP REGEN %', current: (currentBuild.player.capRegenMul - 1) * 100, candidate: (candidateBuild.player.capRegenMul - 1) * 100 },
    { label: 'VAC RES %', current: currentBuild.player.vacuumResistance * 100, candidate: candidateBuild.player.vacuumResistance * 100 },
  ];
  const quickStatLabels = new Set(weaponSlot ? ['DMG', 'RECOIL', 'HEAT/SHOT'] : ['ARMOR', 'MOVE %', 'CAP REGEN %']);
  const quickStatComparisons = statComparisons.filter(stat => quickStatLabels.has(stat.label));
  const renderStats = (comparisons: typeof statComparisons, className = '') => <div className={`compare-stats impact-grid ${className}`}>{comparisons.map(stat => <Delta key={stat.label} label={stat.label} current={stat.current} candidate={stat.candidate} lowerIsBetter={stat.lowerIsBetter} />)}</div>;

  return (
    <div className="gear-summary-grid gear-summary-grid--quick">
      <ActionRequirement presentation={equipRequirement} />

      <section className="gear-quick-read" aria-label="Primary equipment effect">
        <small>PRIMARY EFFECT</small>
        <b>{primaryItemEffect(item)}</b>
        <span>{item.singularEffect ? 'Fixed Singular rule; this identity cannot be rerolled.' : item.modifiers.some(modifier => modifier.mechanical) ? 'This effect changes behavior, not only a numeric stat.' : 'Main effect shown first; modifier and registry detail stays under Details.'}</span>
      </section>

      <section className="loadout-impact quick-loadout-impact" aria-label="Key loadout changes">
        <header className="loadout-impact-heading"><div><small>KEY LOADOUT CHANGES</small><b>{slotLabels[item.slot]}</b></div><span>{equipped ? 'VS EQUIPPED' : 'EMPTY SLOT'}</span></header>
        <div className="compare-head"><div><small>CURRENT</small><b>{equipped?.name ?? 'Empty slot'}</b><span>{equipped ? <><RarityText rarity={equipped.rarity} /> · {summary.current}</> : summary.current}</span></div><div className="candidate-card"><small>CANDIDATE</small><b>{item.name}</b><span><RarityText rarity={item.rarity} /> · {summary.candidate}</span></div></div>
        {renderStats(quickStatComparisons, 'impact-grid--quick')}
      </section>

      {buildChangingEffects.length > 0 && <section className="build-change-panel gear-build-change-quick" aria-label="Build-changing equipment effects"><header><small>BUILD-CHANGING EFFECTS</small><b>{buildChangingEffects.length === 1 ? 'Rule that changes the build' : `${buildChangingEffects.length} rules that change the build`}</b></header>{buildChangingEffects.map(effect => <div key={effect.label}><b>{effect.label}</b><span>{effect.detail}</span></div>)}</section>}

      <ProgressiveDisclosure triggerLabel="Details" eyebrow="Gear details" heading={`${item.name} details`} className="gear-details-sheet">
        {item.rarity === 'Singular' && item.singularEffect && <section className="singular-hero" aria-label="Singular fixed rule"><div><small>✦ SINGULAR // RULE-CHANGER</small><b>{item.name}</b></div><p>{item.singularEffect}</p><span>Fixed identity. Reconstruction can improve frame quality and Augments, but cannot reroll the Singular package.</span></section>}

        <section className="item-layer-panel base-implicit-panel" aria-label="Base and implicit">
          <header className="item-layer-heading"><div><small>FRAME / IMPLICIT</small><b>{identity.name}</b></div><span>FRAME Q {item.equipmentQuality ?? 0}/20</span></header>
          <div className="base-implicit-grid">
            <div><small>BASE</small><b>{item.equipmentClass}</b><span>{item.core}</span></div>
            <div><small>IMPLICIT</small><b>{item.frameImplicit ?? 'Neutral service geometry.'}</b><span>{identity.philosophy}</span></div>
          </div>
          <div className="primary-effect-inline"><small>PRIMARY EFFECT</small><p>{primaryItemEffect(item)}</p></div>
        </section>

        <section className="item-layer-panel explicit-modifiers-panel" aria-label="Explicit modifiers">
          <header className="item-layer-heading"><div><small>EXPLICIT MODIFIERS</small><b>{item.modifiers.length ? item.modifiers.length + ' INSTALLED' : 'CLEAN BASE'}</b></div><span>{item.modifiers.length ? 'PEAK G' + topModifierGrade : 'NO MODS'}</span></header>
          <div className="modifier-columns"><ModifierGroup item={item} family="core" /><ModifierGroup item={item} family="systems" /></div>
        </section>

        <section className="item-layer-panel augment-layer-panel" aria-label="Augments">
          <header className="item-layer-heading"><div><small>AUGMENTS</small><b>{augments.length}/{item.augmentSlots ?? 0} INSTALLED</b></div><span>{accessibleSockets}/{item.augmentSlots ?? 0} ACCESSIBLE</span></header>
          <div className="augment-stack">
            {augments.length === 0 ? <p>No hardware installed.</p> : augments.map(augment => <div key={augment.id}><b>{augment.hardware.toUpperCase()} // {augment.name}</b><span>{augment.description}</span><small>TRADEOFF // {augment.tradeoff}</small></div>)}
            <small className="augment-availability">{compatibleHardware.length} compatible hardware option{compatibleHardware.length === 1 ? '' : 's'} remain for this frame.</small>
          </div>
        </section>

        <section className="loadout-impact gear-details-impact" aria-label="Full loadout comparison">
          <header className="loadout-impact-heading"><div><small>FULL STAT COMPARISON</small><b>{slotLabels[item.slot]}</b></div><span>{statComparisons.length} TRACKED</span></header>
          {renderStats(statComparisons, 'impact-grid--full')}
        </section>

        <section className="build-links-panel" aria-label="Generated build links">
          <header><div><small>GENERATED BUILD LINKS</small><b>What this frame connects to</b></div><span>Generated from shared item stat + tag registries</span></header>
          <div className="build-link-tags">{semanticTags.length ? semanticTags.map(tag => <span key={tag}>{tag.toUpperCase()}</span>) : <span>UNCLASSIFIED</span>}</div>
          <div className="build-link-grid">
            <BuildLinkDiff label="LOCAL STATS" gained={localGained} lost={localLost} note="Base + explicit local properties compared with the currently equipped frame." />
            <BuildLinkDiff label="GLOBAL STATS" gained={globalGained} lost={globalLost} note="Operator-wide and environment-facing stat links." />
            <BuildLinkDiff label="SKILL LINKS" gained={skillGained} lost={skillLost} note={skillNote} />
            <BuildLinkDiff label="SPECIALIZATION GEAR LINK" gained={specializationGained} lost={specializationLost} note={specializationNote} />
            <BuildLinkDiff label="SINGULAR RULE" gained={singularGained} lost={singularLost} note={item.rarity === 'Singular' ? 'Fixed rule-changing package; reconstruction cannot reroll it.' : 'No candidate Singular rule.'} />
          </div>
        </section>

        <section className="gear-expert-section" aria-label="Recovery, frame, and registry metadata">
          <header className="gear-details-label"><small>PROVENANCE / REGISTRY</small><b>Recovery, frame, compatibility, and generated metadata</b></header>
          <div className="gear-identity-grid advanced-identity-grid" aria-label="Equipment identity and compatibility">
            <div><small>BASE</small><b>{item.baseId}</b><span>{item.equipmentClass}</span></div>
            <div><small>FRAME</small><b>{identity.name}</b><span>GEN {item.frameGeneration ?? 1} · {identity.philosophy}</span></div>
            <div><small>RECOVERY</small><b>RL {item.recoveryLevel ?? 1}</b><span>Q{item.recoveryQuality ?? 0} · {recoveryQualityLabel(item.recoveryQuality ?? 0)}</span></div>
            <div><small>FRAME QUALITY</small><b>{item.equipmentQuality ?? 0}/20</b><span>Improves the base/inherent frame only.</span></div>
            <div><small>MODIFIERS</small><b>{item.modifiers.length ? item.modifiers.length + ' · PEAK G' + topModifierGrade : 'CLEAN BASE'}</b><span>Explicit strength remains owned by modifier grade.</span></div>
            <div><small>AUGMENTS</small><b>{augments.length}/{item.augmentSlots ?? 0} INSTALLED</b><span>Bounded utility/specialization hardware.</span></div>
            <div><small>SOURCE</small><b>{item.recoverySource ?? 'Legacy recovery'}</b><span>SOURCE / PROVENANCE // recovered identity remains attached through reconstruction.</span></div>
            <div><small>CLASS RESONANCE</small><b>{classAffinityNames || 'UNIVERSAL'}</b><span>{classMatched ? activeClass.name + ' resonance active.' : classCompatible ? 'Compatible support gear; this frame currently resonates with another class path.' : (weaponOwner?.name ?? 'Another class') + ' owns this weapon family.'}</span></div>
            <div><small>STAT SCOPE</small><b>{semanticScopes.length ? semanticScopes.map(scope => scope.replace('-', ' ').toUpperCase()).join(' · ') : 'NONE'}</b><span>{semanticStats.length} registry-defined stat{semanticStats.length === 1 ? '' : 's'} on this package.</span></div>
            <div><small>BUILD TAGS</small><b>{semanticTags.length ? semanticTags.map(tag => tag.toUpperCase()).join(' · ') : 'UNCLASSIFIED'}</b><span>Shared by combat, loot, crafting, and specialization routes.</span></div>
            <div className={equipReady ? 'compatible' : 'locked'}><small>COMPATIBILITY</small><b>{!classCompatible ? (weaponOwner?.name.toUpperCase() ?? 'OTHER CLASS') + ' ARMAMENT' : equipLevelReady ? 'EQUIP NOW' : 'REQUIRES LV ' + item.levelRequirement}</b><span>{!classCompatible ? activeClass.name + ' owns ' + slotLabels[activeWeaponFamily] + '. This legacy weapon stays in storage.' : classMatched ? activeClass.name + ' resonance active.' : 'Universal support slot; equip permission is independent of resonance.'}</span></div>
          </div>
          <div className={'recovery-quality ' + qualityClass(item)}><b>RECOVERY QUALITY {item.recoveryQuality ?? 0} // {recoveryQualityLabel(item.recoveryQuality ?? 0).toUpperCase()}</b><span>SOURCE // {item.recoverySource ?? 'Legacy recovery'}</span></div>
          <div className="frame-signature"><b>FRAME // {identity.name.toUpperCase()} // GEN {item.frameGeneration ?? 1}</b><span>{identity.philosophy}</span>{(item.frameGeneration ?? 1) >= 6 && <em>GEN VI // MATURE GEN V STAT BAND · EXPANDED AUGMENT BUS. Prototype/Singular frames can carry a third socket; full access requires Microforge T2.</em>}<strong>FRAME QUALITY {item.equipmentQuality ?? 0}/20</strong></div>
          {item.faction && <div className={'faction-signature faction-' + item.faction}><b>FACTION FRAME // {factionLabel(item.faction).toUpperCase()}</b><span>Recovered {factionLabel(item.faction)} construction. Multi-frame interactions are only revealed after they become active in your equipped loadout.</span></div>}
        </section>
      </ProgressiveDisclosure>
    </div>
  );
}

function ReconstructionBench({ item, profile, campaign, lockedFamily, onLockFamily, pendingAction, onPreview, onConfirm, onCancelPreview, onOpenGuide }: { item: Item; profile: PlayerProfile; campaign: CampaignState; lockedFamily: ModifierFamily; onLockFamily: (family: ModifierFamily) => void; pendingAction: ReconstructionAction | null; onPreview: (action: ReconstructionAction) => void; onConfirm: (action: ReconstructionAction) => void; onCancelPreview: () => void; onOpenGuide: (section: GuideSectionId) => void }) {
  const fabrication = campaign.shipUpgrades.fabrication;
  const identity = frameIdentityDefinition(frameIdentity(item));
  const rules = craftingRulesForItem(item, fabrication, profile);
  const buildIntegration = craftingBuildIntegration(profile, item, fabrication);
  const craftLocked = !buildIntegration.classOwned;
  const familyOrder: ModifierFamily[] = ['core', 'systems'];
  const qualityAction: ReconstructionAction = { kind: 'quality' };
  const installed = item.augments ?? [];
  const accessibleSockets = accessibleAugmentSlots(item, fabrication);
  const compatible = compatibleAugments(item, profile).filter(augment => !installed.includes(augment.id));
  const modifierLimit = rules.rarity.maxExplicit;
  const specializationCraftingLink = buildIntegration.specializationHookActive && (itemMatchesSpecializationGearSynergy(profile, item) || buildIntegration.recipeAffixIds.length > 0 || buildIntegration.recipeAugmentIds.length > 0);
  const preview = pendingAction ? reconstructionPreview(profile, campaign.resources, fabrication, item, pendingAction) : null;
  const craftHistory = profile.craftHistory ?? [];
  const craftingAccessRequirement: RequirementPresentation = craftLocked
    ? {
        state: 'blocked',
        label: 'Class-family Reconstruction unavailable',
        reason: buildIntegration.classRule,
        nextRequirement: `Select ${slotLabels[buildIntegration.activeWeaponFamily]} or class-compatible support equipment before using modifier Reconstruction. Augment extraction remains available.`,
      }
    : {
        state: 'ready',
        label: 'Frame ready for Reconstruction',
        detail: 'Choose an action to review its exact cost, outcome, and risk before any salvage is spent.',
      };
  const controlTierRequirement: RequirementPresentation = fabrication >= 2
    ? {
        state: 'active',
        label: 'Microforge T2 control online',
        detail: 'Precision Add, protected Replace, and volatile control are available when the frame rules allow them.',
      }
    : {
        state: 'blocked',
        label: 'Protected control requires Microforge T2',
        reason: `Microforge T${fabrication} cannot use Precision Add, protected Replace, or volatile control.`,
        nextRequirement: 'Upgrade the ship Microforge to tier 2 for deterministic premium control.',
      };
  const modifierCapacityRequirement: RequirementPresentation = item.rarity === 'Singular'
    ? {
        state: 'blocked',
        label: 'Singular modifier package is fixed',
        reason: 'Singular explicit modifiers cannot be added, removed, rerouted, replaced, or elevated.',
        nextRequirement: 'Use frame Improve or compatible Augment socket/extract, or choose a non-Singular frame for modifier work.',
      }
    : fabrication < 1
      ? {
          state: 'blocked',
          label: 'Adding modifiers requires Microforge T1',
          reason: 'The current Microforge cannot add or reroute explicit modifiers.',
          nextRequirement: 'Upgrade the ship Microforge to tier 1.',
        }
      : item.modifiers.length >= modifierLimit
        ? {
            state: 'blocked',
            label: 'Explicit modifier capacity full',
            reason: `${item.rarity} equipment is at its ${modifierLimit}-modifier Reconstruction limit.`,
            nextRequirement: 'Remove or replace an explicit modifier before adding another.',
          }
        : {
            state: 'ready',
            label: 'Modifier slot available',
            detail: `${modifierLimit - item.modifiers.length} explicit modifier slot${modifierLimit - item.modifiers.length === 1 ? '' : 's'} remain on this frame.`,
          };
  const augmentSocketRequirement: RequirementPresentation = craftLocked
    ? {
        state: 'blocked',
        label: 'Augment installation is class-family locked',
        reason: buildIntegration.classRule,
        nextRequirement: 'Use class-compatible equipment to install Augments. Installed Augments may still be extracted.',
      }
    : installed.length >= accessibleSockets
      ? {
          state: 'blocked',
          label: 'No open Augment socket',
          reason: `${installed.length}/${accessibleSockets} currently accessible sockets are occupied.`,
          nextRequirement: accessibleSockets < (item.augmentSlots ?? 0) && fabrication < 2
            ? `Extract an installed Augment or upgrade the Microforge to unlock another socket.`
            : 'Extract an installed Augment before installing another.',
        }
      : {
          state: 'ready',
          label: 'Augment socket available',
          detail: `${accessibleSockets - installed.length} of ${accessibleSockets} accessible socket${accessibleSockets === 1 ? '' : 's'} available now.`,
        };
  const craftingPreviewRequirement: RequirementPresentation | null = preview
    ? preview.blockedReason
      ? {
          state: 'blocked',
          label: 'Selected craft is blocked',
          reason: preview.blockedReason,
          nextRequirement: /microforge tier 2/i.test(preview.blockedReason)
            ? 'Upgrade the ship Microforge to tier 2, then review this action again.'
            : /microforge tier 1/i.test(preview.blockedReason)
              ? 'Upgrade the ship Microforge to tier 1, then review this action again.'
              : /socket/i.test(preview.blockedReason)
                ? 'Free or unlock the required Augment socket, then review this action again.'
                : /recovery level/i.test(preview.blockedReason)
                  ? 'Choose a legal lower grade/target or recover a higher-Recovery-Level frame.'
                  : /class-family/i.test(preview.blockedReason)
                    ? 'Use class-compatible equipment for this Reconstruction action.'
                    : 'Resolve the listed restriction, then review this action again.',
        }
      : !preview.canAfford
        ? {
            state: 'blocked',
            label: 'Missing salvage',
            reason: `This craft costs ${costLabel(preview.cost)}, and current stock cannot cover it.`,
            nextRequirement: `Recover enough salvage to cover ${costLabel(preview.cost)} before confirming.`,
          }
        : {
            state: 'active',
            label: 'Selected for review',
            detail: `Exact cost: ${costLabel(preview.cost)}. Nothing is spent until you confirm.`,
          }
    : null;
  return (
    <section className="reconstruction-bench" data-crafting-surface="true">
      <header className="bench-heading"><div><small>SELECTED FRAME</small><h2>{item.name}</h2><p>{identity.name} · GEN {item.frameGeneration ?? 1} · RL {item.recoveryLevel ?? 1} · <RarityText rarity={item.rarity} /></p></div><strong>MICROFORGE T{fabrication}</strong></header>
      <ActionRequirement presentation={craftingAccessRequirement} />
      <div className="bench-frame"><div><b>FRAME QUALITY // {item.equipmentQuality ?? 0}/{reconstructionQualityCap(fabrication)}</b><span>{item.frameImplicit}</span><small>BASE FRAME ONLY // Improves the inherent frame property; explicit modifier grades and Augments do not scale with quality.</small></div><button disabled={craftLocked} onClick={() => onPreview(qualityAction)}>Improve +2<small>{costLabel(reconstructionCost(item, qualityAction, fabrication, profile))}</small></button></div>
      <div className="bench-caps"><span>GRADE CONTROL // G{reconstructionGradeCap(fabrication)} MAX</span><span>AUGMENT ACCESS // {accessibleSockets}/{item.augmentSlots ?? 0} SOCKETS</span></div>
      <ActionRequirement presentation={controlTierRequirement} />
      <section className="craft-trust-contract" aria-label="Crafting trust review">
        <header><div><small>P10-E // CRAFT REVIEW</small><b>Review first. Salvage spends only after confirmation.</b></div><span>EXACT COST · RESULT SPACE · BEFORE / AFTER</span></header>
        {!preview && <div className="craft-review-empty"><b>Select any crafting action to review it.</b><span>The bench will show exact costs, guaranteed and possible outcomes, exclusions, risk, and the resulting frame state before anything is spent.</span></div>}
        {preview && <div className={`craft-review ${preview.volatile ? 'volatile' : ''}`}>
          <header><div><small>SELECTED ACTION</small><h3>{preview.title}</h3></div><div className="craft-review-cost"><small>EXACT COST</small><b>{costLabel(preview.cost)}</b><span>{preview.canAfford ? 'SALVAGE AVAILABLE' : 'INSUFFICIENT SALVAGE'}</span></div></header>
          <div className="craft-trust-grid">
            <article className="guaranteed"><small>GUARANTEED</small>{preview.guaranteed.length ? preview.guaranteed.map(line => <span key={line}>{line}</span>) : <span>No guaranteed state change while this action is blocked.</span>}</article>
            <article className="possible"><small>POSSIBLE</small>{preview.possible.length ? preview.possible.map(line => <span key={line}>{line}</span>) : <span>None — this legal action resolves deterministically.</span>}</article>
            <article className="risk"><small>EXCLUSIONS / RISK</small>{preview.exclusions.map(line => <span key={line}>{line}</span>)}{preview.risk.map(line => <span key={line}>{line}</span>)}</article>
          </div>
          <div className="craft-before-after"><article><small>BEFORE</small><b>{preview.before}</b></article><article><small>AFTER</small><b>{preview.after}</b></article></div>
          {craftingPreviewRequirement && <ActionRequirement presentation={craftingPreviewRequirement} />}
          <div className="craft-review-actions"><button type="button" data-crafting-back="true" onClick={onCancelPreview}>Back to bench</button><button type="button" data-crafting-confirm="true" className="primary" disabled={!!preview.blockedReason || !preview.canAfford} onClick={() => pendingAction && onConfirm(pendingAction)}>{preview.blockedReason ? 'Action blocked' : !preview.canAfford ? 'Need more salvage' : 'Confirm craft'}</button></div>
        </div>}
      </section>
      <section className="crafting-salvage-loop" aria-label="Crafting salvage loop">
        <div><small>P10-E // SALVAGE LOOP</small><b>Deploy → bank salvage → review → confirm → iterate</b><span>Current material stock stays local. Select an action for its exact cost and result space; durable material, control, and stability rules live in Intel → Guide.</span></div>
        <div className="salvage-loop-balances"><span><small>COMMON STOCK</small><b>{campaign.resources.alloys} Alloy · {campaign.resources.electronics} Circuit · {campaign.resources.components} Components</b></span><span><small>CHASE CONTROL</small><b>{campaign.resources.rareTech} Quarantined Trace</b></span></div>
      </section>
      <section className="crafting-input-contract" aria-label="Crafting input controls">
        <div><small>P10-F // TOUCH + CONTROLLER</small><b>D-pad moves · A confirms · B backs out</b><span>Reconstruction controls keep native button semantics for keyboard and touch. Controller focus stays inside the crafting surface, A activates the focused legal action, and B returns from a pending craft review without spending salvage.</span></div>
      </section>
      <section className="crafting-rules-contract" aria-label="Crafting rules and legal modifier pool">
        <header>
          <div><small>P10-A // CRAFTING CONTRACT</small><b>Know the result space before spending</b></div>
          <span>BASE → POOL · RARITY → COUNT · RECOVERY + MICROFORGE → GRADE</span>
        </header>
        <div className="crafting-rule-grid">
          <article>
            <small>BASE FRAME // POOL OWNER</small>
            <b>{rules.base?.name ?? item.name}</b>
            <span>{rules.base?.core ?? item.core}</span>
            <em>{rules.base?.tradeoff ? 'TRADEOFF // ' + rules.base.tradeoff : 'FIXED / LEGACY FRAME CONTRACT'}</em>
          </article>
          <article>
            <small>RARITY // EXPLICIT BUDGET</small>
            <b>{rules.rarity.currentExplicit}/{rules.rarity.maxExplicit} MODIFIERS</b>
            <span>{item.rarity === 'Singular' ? 'Curated fixed package. Random modifier crafting is disabled.' : rules.rarity.remainingExplicit + ' open explicit slot' + (rules.rarity.remainingExplicit === 1 ? '' : 's') + ' remain.'}</span>
            <em>{item.rarity === 'Singular' ? 'SIGNATURE PACKAGE' : 'DROP CONTRACT // ' + rules.rarity.minGenerated + '–' + rules.rarity.maxExplicit + ' EXPLICIT'}</em>
          </article>
          <article>
            <small>GRADE ACCESS</small>
            <b>G{rules.gradeCeiling} CURRENT CEILING</b>
            <span>Recovery RL {rules.recoveryLevel} permits through G{rules.recoveryGradeCap}; Microforge T{fabrication} permits through G{rules.forgeGradeCap}.</span>
            <em>LOWER CEILING WINS</em>
          </article>
        </div>
        <div className="crafting-family-guide">
          {familyOrder.map(family => <article key={family}><small>{craftingFamilyDefinitions[family].label} FAMILY</small><span>{craftingFamilyDefinitions[family].role}</span><b>{rules.familyCounts[family]} INSTALLED</b></article>)}
        </div>
        <GuideLink section="crafting" label="Crafting" onOpenGuide={onOpenGuide} />
        <div className="crafting-legal-pool">
          {familyOrder.map(family => {
            const entries = rules.pool.filter(entry => entry.family === family);
            const legalCount = entries.filter(entry => entry.status === 'legal').length;
            return <article key={family} className={'crafting-pool-family ' + family}>
              <header><div><small>{craftingFamilyDefinitions[family].label} LEGAL POOL</small><b>{legalCount} READY / {entries.length} FRAME OPTIONS</b></div><span>Base frame + class-family ownership decide this list.</span></header>
              <div>{entries.map(entry => {
                const precisionAdd: ReconstructionAction = { kind: 'add', family, targetAffixId: entry.id };
                const specializationRecipeTarget = buildIntegration.recipeAffixIds.includes(entry.id);
                return <div key={entry.id} className={'crafting-pool-entry ' + entry.status}>
                  <small>{entry.group.toUpperCase()} · RL {entry.minimumRecoveryLevel}+{specializationRecipeTarget ? ' · SPECIALIZATION RECIPE' : ''}</small>
                  <b>{entry.name}</b>
                  <span>{entry.reason}</span>
                  <em>{entry.eligibleGrades.length ? 'ACCESS // ' + entry.eligibleGrades.map(grade => 'G' + grade).join(' / ') : 'NO GRADE ACCESS'}</em>
                  {entry.status === 'legal' && <button className="precision-target" disabled={craftLocked || fabrication < 2 || item.rarity === 'Singular' || item.modifiers.length >= modifierLimit} onClick={() => onPreview(precisionAdd)}>{specializationRecipeTarget ? 'Recipe Add' : 'Precision Add'}<small>{costLabel(reconstructionCost(item, precisionAdd, fabrication, profile))}</small></button>}
                </div>;
              })}</div>
            </article>;
          })}
        </div>
      </section>
      {specializationCraftingLink && <div className="bench-guard"><b>SPECIALIZATION RECIPE LINK</b><span>Matching frames, legal recipe modifier targets, and recommended Augments receive a 12% resource discount while the field-integration node remains active. The recipe never bypasses base legality or class-family ownership.</span></div>}
      {craftLocked && <div className="bench-guard"><b>CLASS-FAMILY RECONSTRUCTION LOCK</b><span>{buildIntegration.classRule} Installed Augments may still be extracted so a class change never traps utility hardware.</span></div>}
      {item.rarity === 'Singular' && <div className="bench-guard"><b>FIXED SINGULAR PACKAGE</b><span>Signature and fixed modifiers cannot be added, removed, rerouted, replaced, or elevated. Improve and compatible Augment socket/extract remain available.</span></div>}
      <div className="lock-row"><b>LOCK FAMILY</b><button className={lockedFamily === 'core' ? 'active' : ''} onClick={() => onLockFamily('core')}>Lock Core</button><button className={lockedFamily === 'systems' ? 'active' : ''} onClick={() => onLockFamily('systems')}>Lock Systems</button><span>Microforge T2 // Protected Replace guarantees the chosen target for 1 Quarantined Trace. Volatile Replace preserves the lock, spends no Trace, drains stability, and can fail.</span></div>
      <div className="bench-modifiers">
        {item.modifiers.map(modifier => {
          const family = modifier.family ?? modifierFamilyFor(modifier.id);
          const currentGrade = (modifier.grade ?? 3) as ModifierGrade;
          const gradeAction: ReconstructionAction = { kind: 'grade', modifierId: modifier.id };
          const volatileGradeAction: ReconstructionAction = { kind: 'grade', modifierId: modifier.id, targetGrade: Math.min(rules.gradeCeiling, currentGrade + 1) as ModifierGrade, mode: 'volatile' };
          const rerouteAction: ReconstructionAction = { kind: 'reroute', modifierId: modifier.id };
          const removeAction: ReconstructionAction = { kind: 'remove', modifierId: modifier.id };
          const replaceAction: ReconstructionAction = { kind: 'recalibrate', modifierId: modifier.id, lockedFamily };
          const elevationGrades = ([2, 3, 4, 5] as ModifierGrade[]).filter(grade => grade > currentGrade && grade <= rules.gradeCeiling);
          const legalReplacements = rules.pool.filter(entry => entry.family === family && entry.status === 'legal');
          return <article key={modifier.id}>
            <div><small>{family.toUpperCase()} // G{currentGrade}</small><b>{modifier.label}</b><span>{modifier.description}</span></div>
            <div className="bench-actions"><button disabled={craftLocked || item.rarity === 'Singular' || currentGrade >= rules.gradeCeiling} onClick={() => onPreview(gradeAction)}>Elevate<small>{costLabel(reconstructionCost(item, gradeAction, fabrication, profile))}</small></button><button disabled={craftLocked || fabrication < 1 || item.rarity === 'Singular'} onClick={() => onPreview(rerouteAction)}>Reroute<small>{costLabel(reconstructionCost(item, rerouteAction, fabrication, profile))}</small></button><button disabled={craftLocked || fabrication < 2 || item.rarity === 'Singular' || family === lockedFamily} onClick={() => onPreview(replaceAction)}>Replace<small>{costLabel(reconstructionCost(item, replaceAction, fabrication, profile))}</small></button><button className="destructive" disabled={craftLocked || item.rarity === 'Singular'} onClick={() => onPreview(removeAction)}>Remove<small>{costLabel(reconstructionCost(item, removeAction, fabrication, profile))}</small></button></div>
            {elevationGrades.length > 0 && <div className="elevation-choice-row"><small>ELEVATION CHOICE</small>{elevationGrades.map(targetGrade => { const action: ReconstructionAction = { kind: 'grade', modifierId: modifier.id, targetGrade }; return <button key={targetGrade} disabled={craftLocked || item.rarity === 'Singular'} onClick={() => onPreview(action)}>Controlled → G{targetGrade}<small>{costLabel(reconstructionCost(item, action, fabrication, profile))}</small></button>; })}{fabrication >= 2 && <button className="volatile" disabled={craftLocked || item.rarity === 'Singular' || currentGrade >= rules.gradeCeiling} onClick={() => onPreview(volatileGradeAction)}>Volatile → G{Math.min(rules.gradeCeiling, currentGrade + 1)}<small>{Math.round(rules.volatileSuccessChance * 100)}% · {costLabel(reconstructionCost(item, volatileGradeAction, fabrication, profile))}</small></button>}</div>}
            {fabrication >= 2 && family !== lockedFamily && legalReplacements.length > 0 && <div className="targeted-replace-row"><small>TARGETED REPLACE // {lockedFamily.toUpperCase()} LOCKED</small>{legalReplacements.map(entry => { const protectedAction: ReconstructionAction = { kind: 'recalibrate', modifierId: modifier.id, lockedFamily, targetAffixId: entry.id, mode: 'protected' }; const volatileAction: ReconstructionAction = { kind: 'recalibrate', modifierId: modifier.id, lockedFamily, targetAffixId: entry.id, mode: 'volatile' }; return <span key={entry.id}><b>{entry.name}</b><button disabled={craftLocked || item.rarity === 'Singular'} onClick={() => onPreview(protectedAction)}>Protected<small>{costLabel(reconstructionCost(item, protectedAction, fabrication, profile))}</small></button><button className="volatile" disabled={craftLocked || item.rarity === 'Singular'} onClick={() => onPreview(volatileAction)}>Risk Replace<small>{Math.round(rules.volatileSuccessChance * 100)}% · {costLabel(reconstructionCost(item, volatileAction, fabrication, profile))}</small></button></span>; })}</div>}
          </article>;
        })}
      </div>
      <ActionRequirement presentation={modifierCapacityRequirement} />
      <div className="add-mod-row"><b>ADD MODIFIER // {item.modifiers.length}/{modifierLimit}</b>{(['core', 'systems'] as ModifierFamily[]).map(family => { const action: ReconstructionAction = { kind: 'add', family }; return <button key={family} disabled={craftLocked || fabrication < 1 || item.rarity === 'Singular' || item.modifiers.length >= modifierLimit} onClick={() => onPreview(action)}>Add {family}<small>{costLabel(reconstructionCost(item, action, fabrication, profile))}</small></button>; })}</div>
      <ActionRequirement presentation={augmentSocketRequirement} />
      <section className="augment-bench"><header><b>AUGMENT HARDWARE // SOCKET / EXTRACT</b><span>{installed.length}/{accessibleSockets} accessible sockets occupied · max 2 normal sockets · no grades</span></header>{installed.length > 0 && <div className="installed-augments">{installed.map(id => { const augment = augmentDefinition(id); const action: ReconstructionAction = { kind: 'removeAugment', augmentId: id }; return <article key={id}><div><small>{augment.hardware}</small><b>{augment.name}</b><span>{augment.description} TRADEOFF // {augment.tradeoff}</span></div><button onClick={() => onPreview(action)}>Extract<small>{costLabel(reconstructionCost(item, action, fabrication, profile))}</small></button></article>; })}</div>}<div className="augment-options">{compatible.map(augment => { const action: ReconstructionAction = { kind: 'installAugment', augmentId: augment.id }; return <button key={augment.id} disabled={craftLocked || installed.length >= accessibleSockets} onClick={() => onPreview(action)}><small>{buildIntegration.recipeAugmentIds.includes(augment.id) ? 'SPECIALIZATION RECIPE' : 'SOCKET'}</small><b>{augment.name}</b><span>{augment.description}</span><small>TRADEOFF // {augment.tradeoff}</small><em>{costLabel(reconstructionCost(item, action, fabrication, profile))}</em></button>; })}</div></section>
      <section className="craft-history" aria-label="Craft history">
        <header><div><small>P10-E // CRAFT HISTORY</small><b>Last {Math.min(12, craftHistory.length)} confirmed action{craftHistory.length === 1 ? '' : 's'}</b></div><span>Receipts persist with the operator save.</span></header>
        {craftHistory.length ? <div className="craft-history-list">{craftHistory.slice(0, 12).map(entry => <article key={entry.id} className={entry.volatile ? 'volatile' : ''}><div><small>{entry.volatile ? 'VOLATILE RECEIPT' : 'CONTROLLED RECEIPT'} // {entry.itemName}</small><b>{entry.action}</b><span>{entry.outcome}</span></div><div><small>COST</small><b>{entry.cost}</b><span>BEFORE // {entry.before}</span><span>AFTER // {entry.after}</span></div></article>)}</div> : <div className="craft-history-empty"><b>No confirmed crafts yet.</b><span>Your first completed Reconstruction action will leave a persistent before/after receipt here.</span></div>}
      </section>
    </section>
  );
}

export default function Armory({ profile, campaign, newLootIds, onProfileChange, onCampaignChange, onOpenGuide, guideReturnFocus, onGuideFocusRestored, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('gear');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!guideReturnFocus) return;
    setTab(guideReturnFocus.tab);
    setSelectedId(guideReturnFocus.selectedItemId);
  }, [guideReturnFocus]);
  useEffect(() => {
    if (!guideReturnFocus || tab !== guideReturnFocus.tab || selectedId !== guideReturnFocus.selectedItemId) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLButtonElement>('button[data-guide-link="' + guideReturnFocus.section + '"]');
      target?.focus();
      onGuideFocusRestored?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [guideReturnFocus, onGuideFocusRestored, selectedId, tab]);
  const [lockedFamily, setLockedFamily] = useState<ModifierFamily>('core');
  const [pendingCraft, setPendingCraft] = useState<ReconstructionAction | null>(null);
  const [message, setMessage] = useState(newLootIds.length > 0 ? `${newLootIds.length} recovered equipment packages added to ship storage.` : '');
  const [gearQuery, setGearQuery] = useState('');
  const [gearFilter, setGearFilter] = useState<InventoryFilter>(newLootIds.length > 0 ? 'new' : 'all');
  const [gearSort, setGearSort] = useState<InventorySort>('recent');
  const [gearRarity, setGearRarity] = useState<RarityFilter>('all');
  const [networkQuery, setNetworkQuery] = useState('');
  const [networkFocusId, setNetworkFocusId] = useState<string | null>(() => {
    const initialWeaponFamily = operatorWeaponFamilyForClass(operatorClassForProfile(profile));
    return progressionNodes.find(node => !node.specialization && (!node.weaponFamily || node.weaponFamily === initialWeaponFamily))?.id ?? null;
  });
  const buildRef = useRef<HTMLElement>(null);
  const selected = profile.inventory.find(item => item.id === selectedId) ?? null;
  const progress = xpProgress(profile);
  const identity = buildIdentity(profile);
  const operatorClass = operatorClassForProfile(profile);
  const operatorClassDefinition = operatorClassDefinitions.find(definition => definition.id === operatorClass)!;
  const activeWeaponFamily = operatorWeaponFamilyForClass(operatorClass);
  const activeWeaponItem = itemForSlot(profile, activeWeaponFamily);
  const loadoutSlots: EquipmentSlot[] = [activeWeaponFamily, 'suit', 'rig', 'implant'];
  const classResonance = gearResonanceForProfile(profile, operatorClass);
  const activeGearSynergy = specializationGearSynergyForProfile(profile);
  const activeAbilityKit = classAbilityKits[operatorClass];
  const currentCombatBuild = useMemo(() => deriveCombatBuild(profile), [profile]);
  const activeSkillBuild = currentCombatBuild.classSkillFamily;
  const activeSpecializationDefinition = profile.level >= 15 ? specializationDefinitions.find(definition => definition.id === profile.specialization) : undefined;
  const activeCapstoneCount = Object.values(profile.abilityMods).filter(modId => !!capstoneInteractionFor(profile, modId)).length;
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
  const groups = useMemo(() => { const result = new Map<string, typeof progressionNodes>(); for (const node of progressionNodes.filter(entry => !entry.specialization)) result.set(node.branch, [...(result.get(node.branch) ?? []), node]); return result; }, []);
  const operatorNetwork = useMemo(() => normalizeOperatorNetworkState({ operatorClass, level: profile.level, specialization: profile.specialization, state: profile.operatorNetwork, legacyAllocatedNodes: profile.allocatedNodes, legacyUnspentPoints: profile.progressionPoints }), [operatorClass, profile.level, profile.specialization, profile.operatorNetwork, profile.allocatedNodes, profile.progressionPoints]);
  const networkPlanTargets = operatorNetwork.plannedTargetNodeIds;
  const operatorNetworkContext = useMemo<OperatorNetworkUnlockContext>(() => ({ level: profile.level, specialization: profile.specialization, unlockKeys: specializationNetworkUnlockKeys(campaign) }), [profile.level, profile.specialization, campaign.story.blackLattice.status, campaign.story.postKhepri.status, campaign.story.interdiction.status, campaign.story.parallaxDebt.status, campaign.escalation.status, campaign.reputation.meridian, campaign.reputation.longarc, campaign.reputation.heliostat]);
  const specializationNetworkNodes = useMemo(() => progressionNodes.filter(node => node.specialization === profile.specialization), [profile.specialization]);
  const networkSearchResults = useMemo(() => {
    const query = networkQuery.trim().toLowerCase();
    if (!query) return [];
    return progressionNodes
      .filter(node => (!node.specialization || node.specialization === profile.specialization) && (!node.weaponFamily || node.weaponFamily === activeWeaponFamily))
      .filter(node => [node.name, node.description, node.branch, node.kind, node.sector, node.unlockLabel ?? ''].join(' ').toLowerCase().includes(query))
      .slice(0, 8);
  }, [networkQuery, profile.specialization, activeWeaponFamily]);
  const networkFocusedNode = progressionNodes.find(node => node.id === networkFocusId) ?? null;
  const networkFocusedRoute = networkFocusedNode ? operatorNetworkRouteToNode(operatorNetwork, networkFocusedNode.id, operatorNetworkContext) : null;
  const networkPlan = useMemo(() => operatorNetworkPlan(operatorNetwork, networkPlanTargets, operatorNetworkContext), [operatorNetwork, networkPlanTargets, operatorNetworkContext]);
  const networkPlannedProfile = useMemo<PlayerProfile>(() => {
    const allocatedNodes = [...new Set([...profile.allocatedNodes, ...networkPlan.nodeIds])];
    const unspentPoints = Math.max(0, profile.progressionPoints - networkPlan.pointCost);
    return { ...profile, allocatedNodes, progressionPoints: unspentPoints, operatorNetwork: { ...operatorNetwork, allocatedNodeIds: allocatedNodes, unspentPoints } };
  }, [profile, operatorNetwork, networkPlan.nodeIds, networkPlan.pointCost]);
  const plannedCombatBuild = useMemo(() => deriveCombatBuild(networkPlannedProfile), [networkPlannedProfile]);
  const networkPlanShortfall = Math.max(0, networkPlan.pointCost - profile.progressionPoints);
  const networkPlanNodeNames = networkPlan.nodeIds.map(id => progressionNodes.find(node => node.id === id)?.name ?? id);
  const networkPlannerMetrics = [
    { label: 'Weapon output', before: `${Math.round((currentCombatBuild.weapon[activeWeaponFamily].damageMul - 1) * 100)}%`, after: `${Math.round((plannedCombatBuild.weapon[activeWeaponFamily].damageMul - 1) * 100)}%` },
    { label: 'Armor bonus', before: `+${Math.round(currentCombatBuild.player.maxArmorAdd)}`, after: `+${Math.round(plannedCombatBuild.player.maxArmorAdd)}` },
    { label: 'Movement', before: `${Math.round((currentCombatBuild.player.moveSpeedMul - 1) * 100)}%`, after: `${Math.round((plannedCombatBuild.player.moveSpeedMul - 1) * 100)}%` },
    { label: 'Attack Speed', before: `${Math.round((currentCombatBuild.attackSpeedMul - 1) * 100)}%`, after: `${Math.round((plannedCombatBuild.attackSpeedMul - 1) * 100)}%` },
    { label: 'Cap regen', before: `${Math.round((currentCombatBuild.player.capRegenMul - 1) * 100)}%`, after: `${Math.round((plannedCombatBuild.player.capRegenMul - 1) * 100)}%` },
    { label: 'Class skill power', before: `${Math.round((currentCombatBuild.classSkillFamily.powerMul - 1) * 100)}%`, after: `${Math.round((plannedCombatBuild.classSkillFamily.powerMul - 1) * 100)}%` },
    { label: 'Vacuum resist', before: `${Math.round(currentCombatBuild.player.vacuumResistance * 100)}%`, after: `${Math.round(plannedCombatBuild.player.vacuumResistance * 100)}%` },
  ];
  const focusedRefundCost = networkFocusedNode && profile.allocatedNodes.includes(networkFocusedNode.id) ? operatorNetworkRespecCreditCost(profile.level, 1, 'node') : 0;
  const networkRequirementFor = (node: (typeof progressionNodes)[number], route: ReturnType<typeof operatorNetworkRouteToNode>): RequirementPresentation => {
    if (node.milestone) {
      const active = operatorNetworkMilestoneActive(operatorNetwork, node.id, operatorNetworkContext);
      return active
        ? { state: 'active', label: 'Milestone online', detail: 'This milestone condition is satisfied and its effect is active now.' }
        : {
            state: 'blocked',
            label: 'Milestone condition not met',
            reason: 'Milestones activate through their authored unlock condition instead of spending a progression point.',
            nextRequirement: node.unlockLabel ? `Meet ${node.unlockLabel}.` : 'Meet the listed milestone condition and required Network route.',
          };
    }
    if (profile.allocatedNodes.includes(node.id)) {
      return { state: 'active', label: 'Node allocated', detail: 'This node is part of the active Operator Network build.' };
    }
    if (node.minLevel && profile.level < node.minLevel) {
      return {
        state: 'blocked',
        label: `Requires operator level ${node.minLevel}`,
        reason: `This node requires LV ${node.minLevel}; the current operator is LV ${profile.level}.`,
        nextRequirement: `Reach operator level ${node.minLevel}.`,
      };
    }
    if (node.weaponFamily && node.weaponFamily !== activeWeaponFamily) {
      const owner = operatorClassDefinitions.find(definition => operatorWeaponFamilyForClass(definition.id) === node.weaponFamily);
      return {
        state: 'blocked',
        label: `${slotLabels[node.weaponFamily]} belongs to another class family`,
        reason: `${operatorClassDefinition.name} owns ${slotLabels[activeWeaponFamily]}, not the ${slotLabels[node.weaponFamily]} sector.`,
        nextRequirement: owner
          ? `Switch operator class to ${owner.name}, or choose a ${slotLabels[activeWeaponFamily]} / universal Network route.`
          : `Choose a ${slotLabels[activeWeaponFamily]} or universal Network route.`,
      };
    }
    if (node.exclusiveGroup) {
      const committedAlternative = progressionNodes.find(other => other.id !== node.id && other.exclusiveGroup === node.exclusiveGroup && profile.allocatedNodes.includes(other.id));
      if (committedAlternative) {
        return {
          state: 'blocked',
          label: 'Exclusive Keystone choice already active',
          reason: `${committedAlternative.name} already occupies this exclusive Keystone choice.`,
          nextRequirement: `Refund ${committedAlternative.name} or rebuild the Operator Network before allocating ${node.name}.`,
        };
      }
    }
    if (!route) {
      return {
        state: 'blocked',
        label: 'No legal route',
        reason: 'Your current Operator Network cannot reach this node through a legal connected path.',
        nextRequirement: 'Choose a class-compatible adjacent node that extends the route toward this target.',
      };
    }
    if (route.nodeIds.length !== 1) {
      const nextNodeId = route.nodeIds[0];
      const nextNode = progressionNodes.find(candidate => candidate.id === nextNodeId);
      return {
        state: 'blocked',
        label: 'Route not adjacent',
        reason: `This target is ${route.nodeIds.length} nodes away and cannot be allocated directly.`,
        nextRequirement: nextNode ? `Allocate ${nextNode.name} next, or keep this target in the planner.` : 'Allocate the next node in the previewed route, or keep this target in the planner.',
      };
    }
    const pointShortfall = Math.max(0, node.allocationCost - profile.progressionPoints);
    if (pointShortfall > 0) {
      return {
        state: 'blocked',
        label: 'More progression points needed',
        reason: `${node.allocationCost} pt required · ${profile.progressionPoints} pt available.`,
        nextRequirement: `Gain ${pointShortfall} more progression point${pointShortfall === 1 ? '' : 's'}.`,
      };
    }
    return {
      state: 'ready',
      label: 'Ready to allocate',
      detail: `Spend ${node.allocationCost} progression point${node.allocationCost === 1 ? '' : 's'} to activate this node now.`,
    };
  };
  const focusedAllocationRequirement: RequirementPresentation | null = networkFocusedNode
    ? networkRequirementFor(networkFocusedNode, networkFocusedRoute)
    : null;
  const networkRebuildCost = operatorNetworkRespecCreditCost(profile.level, operatorNetwork.allocatedNodeIds.length, 'rebuild');
  const experimentationIsFree = profile.level <= 8;
  const networkRebuildRequirement: RequirementPresentation = operatorNetwork.allocatedNodeIds.length === 0
    ? {
        state: 'blocked',
        label: 'Operator Network already clear',
        reason: 'There are no allocated nodes to refund.',
        nextRequirement: 'Allocate at least one progression node before using a full rebuild.',
      }
    : campaign.resources.credits < networkRebuildCost
      ? {
          state: 'blocked',
          label: 'More credits needed for rebuild',
          reason: `${networkRebuildCost} credits required · ${campaign.resources.credits} available.`,
          nextRequirement: `Recover ${networkRebuildCost - campaign.resources.credits} more credits before rebuilding.`,
        }
      : {
          state: 'ready',
          label: 'Full rebuild ready',
          detail: networkRebuildCost > 0 ? `Spend ${networkRebuildCost} credits to refund every allocated progression node.` : 'Field-trial rebuild is free at this level.',
        };
  const allocatedBuildDefiningNodes = progressionNodes.filter(node => (node.kind === 'mastery' || node.kind === 'keystone' || node.kind === 'capstone') && profile.allocatedNodes.includes(node.id)).length;
  const ownedWeaponSectorNodes = progressionNodes.filter(node => node.weaponFamily === activeWeaponFamily).length;
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
  const setNetworkPlanTargets = (next: string[] | ((current: string[]) => string[])) => {
    onProfileChange(current => {
      const currentNetwork = normalizeOperatorNetworkState({
        operatorClass: operatorClassForProfile(current),
        level: current.level,
        specialization: current.specialization,
        state: current.operatorNetwork,
        legacyAllocatedNodes: current.allocatedNodes,
        legacyUnspentPoints: current.progressionPoints,
      });
      const nextTargets = typeof next === 'function' ? next(currentNetwork.plannedTargetNodeIds) : next;
      return setOperatorNetworkPlanTargets(current, nextTargets, {
        ...operatorNetworkContext,
        level: current.level,
        specialization: current.specialization,
      });
    });
  };
  const toggleNetworkPlanTarget = (nodeId: string) => {
    setNetworkPlanTargets(current => current.includes(nodeId) ? current.filter(id => id !== nodeId) : [...current, nodeId]);
  };
  const focusNetworkNodeByOffset = (offset: number, edge?: 'start' | 'end') => {
    const buttons = [...(buildRef.current?.querySelectorAll<HTMLButtonElement>('[data-network-node="true"]') ?? [])];
    if (!buttons.length) return;
    const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = edge === 'start' ? 0 : edge === 'end' ? buttons.length - 1 : activeIndex < 0 ? (offset < 0 ? buttons.length - 1 : 0) : (activeIndex + offset + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const focusCraftControlByOffset = (offset: number, edge?: 'start' | 'end') => {
    const buttons = [...(buildRef.current?.querySelectorAll<HTMLButtonElement>('[data-crafting-surface="true"] button:not(:disabled)') ?? [])];
    if (!buttons.length) return;
    const activeIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = edge === 'start' ? 0 : edge === 'end' ? buttons.length - 1 : activeIndex < 0 ? (offset < 0 ? buttons.length - 1 : 0) : (activeIndex + offset + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const handleNetworkNavigation = (event: React.KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); focusNetworkNodeByOffset(1); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); focusNetworkNodeByOffset(-1); }
    if (event.key === 'Home') { event.preventDefault(); focusNetworkNodeByOffset(0, 'start'); }
    if (event.key === 'End') { event.preventDefault(); focusNetworkNodeByOffset(0, 'end'); }
  };
  useEffect(() => {
    if (!selectedId) return;
    const closeInspector = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', closeInspector);
    return () => window.removeEventListener('keydown', closeInspector);
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId || tab !== 'gear') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedId, tab]);
  useEffect(() => {
    const nextFocus = progressionNodes.find(node => !node.specialization && (!node.weaponFamily || node.weaponFamily === activeWeaponFamily));
    setNetworkFocusId(nextFocus?.id ?? null);
    setNetworkQuery('');
  }, [operatorClass, profile.specialization, activeWeaponFamily]);
  useEffect(() => {
    if (tab !== 'network' || typeof navigator.getGamepads !== 'function') return;
    let frame = 0;
    let previousDirection = 0;
    const poll = () => {
      const pad = [...navigator.getGamepads()].find(Boolean);
      let direction = 0;
      if (pad?.buttons[12]?.pressed || pad?.buttons[14]?.pressed) direction = -1;
      else if (pad?.buttons[13]?.pressed || pad?.buttons[15]?.pressed) direction = 1;
      if (direction && direction !== previousDirection) focusNetworkNodeByOffset(direction);
      previousDirection = direction;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  useEffect(() => {
    if (tab !== 'reconstruct' || typeof navigator.getGamepads !== 'function') return;
    let frame = 0;
    let previousDirection = 0;
    let previousConfirm = false;
    let previousBack = false;
    const poll = () => {
      const pad = [...navigator.getGamepads()].find(Boolean);
      let direction = 0;
      if (pad?.buttons[12]?.pressed || pad?.buttons[14]?.pressed) direction = -1;
      else if (pad?.buttons[13]?.pressed || pad?.buttons[15]?.pressed) direction = 1;
      if (direction && direction !== previousDirection) focusCraftControlByOffset(direction);
      previousDirection = direction;

      const confirm = !!pad?.buttons[0]?.pressed;
      if (confirm && !previousConfirm) {
        const active = document.activeElement;
        if (active instanceof HTMLButtonElement && active.closest('[data-crafting-surface="true"]') && !active.disabled) active.click();
        else focusCraftControlByOffset(1, 'start');
      }
      previousConfirm = confirm;

      const back = !!pad?.buttons[1]?.pressed;
      if (back && !previousBack) buildRef.current?.querySelector<HTMLButtonElement>('[data-crafting-back="true"]')?.click();
      previousBack = back;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  useEffect(() => { setPendingCraft(null); }, [selectedId, tab]);
  const runReconstruction = (action: ReconstructionAction) => {
    if (!selected) return;
    const result = reconstructItem(profile, campaign.resources, campaign.shipUpgrades.fabrication, selected.id, action);
    if (result.profile !== profile) onProfileChange(result.profile);
    if (result.wallet !== campaign.resources) onCampaignChange({ ...campaign, resources: result.wallet, lastOutcome: result.message });
    setPendingCraft(null);
    setMessage(result.message);
  };
  const spendNetworkRecalibrationCredits = (cost: number, outcome: string) => {
    if (cost <= 0) return;
    onCampaignChange({
      ...campaign,
      resources: { ...campaign.resources, credits: Math.max(0, campaign.resources.credits - cost) },
      lastOutcome: outcome,
    });
  };
  const runNetworkRefund = (nodeId: string) => {
    const cost = operatorNetworkRespecCreditCost(profile.level, 1, 'node');
    if (campaign.resources.credits < cost) {
      setMessage(`Recalibration requires ${cost} credits; ${campaign.resources.credits} available.`);
      return;
    }
    const result = refundNode(profile, nodeId, operatorNetworkContext);
    if (result.profile === profile) {
      setMessage(result.message);
      return;
    }
    const outcome = `${result.message}${cost > 0 ? ` // ${cost} credits consumed.` : ' // Field-trial recalibration is free.'}`;
    onProfileChange(result.profile);
    spendNetworkRecalibrationCredits(cost, outcome);
    setMessage(outcome);
  };
  const openGuide = (section: GuideSectionId) => onOpenGuide(section, tab, selectedId);
  const runNetworkRebuild = () => {
    if (operatorNetwork.allocatedNodeIds.length === 0) {
      setMessage('Operator Network already clear.');
      return;
    }
    if (campaign.resources.credits < networkRebuildCost) {
      setMessage(`Full Network rebuild requires ${networkRebuildCost} credits; ${campaign.resources.credits} available.`);
      return;
    }
    const result = rebuildOperatorNetwork(profile);
    if (result.profile === profile || result.refundedNodeIds.length === 0) {
      setMessage(result.message);
      return;
    }
    const outcome = `${result.message}${networkRebuildCost > 0 ? ` // ${networkRebuildCost} credits consumed.` : ' // Field-trial rebuild is free.'}`;
    onProfileChange(result.profile);
    spendNetworkRecalibrationCredits(networkRebuildCost, outcome);
    setNetworkFocusId(null);
    setMessage(outcome);
  };

  const inspectorPanel = (<aside className={'item-inspector ' + (selected ? 'open ' + rarityClass(selected) + ' ' + factionClass(selected) + ' ' + qualityClass(selected) : '')} role="dialog" aria-modal="true" aria-labelledby="armory-item-inspector-title" aria-label="Item comparison">{selected ? <><header className="inspector-header"><div className="inspector-heading"><div className="inspector-badges"><span className="inspector-rarity" aria-label={rarityDefinition(selected.rarity).accessibleLabel}><RarityText rarity={selected.rarity} /></span><span>{slotLabels[selected.slot]}</span><span>EQUIP LV {selected.levelRequirement}</span>{selected.faction && <span>{factionLabel(selected.faction).toUpperCase()}</span>}{profile.equipped[selected.slot] === selected.id && <span className="equipped-badge">EQUIPPED</span>}</div><h2 id="armory-item-inspector-title">{selected.name}</h2><p>{selected.equipmentClass}. {selected.core}</p></div><button className="sheet-close" aria-label="Back to ship storage" onClick={() => setSelectedId(null)}>Back to storage</button></header><div className="inspector-scroll" tabIndex={0}><GearComparison profile={profile} item={selected} fabrication={campaign.shipUpgrades.fabrication} /></div><footer className="inspector-actions">{profile.equipped[selected.slot] === selected.id ? <button onClick={() => unequipLatest(selected.slot)}>Unequip</button> : <button className="primary" disabled={!isItemClassCompatible(profile, selected) || selected.levelRequirement > profile.level} onClick={() => equipLatest(selected)}>{!isItemClassCompatible(profile, selected) ? 'Class-locked armament' : selected.levelRequirement > profile.level ? `Requires LV ${selected.levelRequirement}` : `Equip ${slotLabels[selected.slot]}`}</button>}<button className="danger" onClick={() => discardLatest(selected)}>Discard</button></footer></> : <div className="empty-inspector"><b>Select equipment</b><span>Tap an item to compare it against the currently equipped piece.</span></div>}</aside>);

  return <main ref={buildRef} className="build-bay iv-view">
    <header className="build-header iv-panel iv-panel--glass"><div><span className="card-kicker">QUIET SIGNAL // OPERATOR BUILD</span><h1>Build</h1><p>{identity} · Level {profile.level} · {profile.progressionPoints} unspent progression point{profile.progressionPoints === 1 ? '' : 's'}</p></div><button className="close-build" onClick={onClose}>Return to ship</button></header>
    <section className="xp-strip" aria-label="Experience progress"><span>LV {profile.level}</span><div><i style={{ width: `${Math.min(100, progress.current / progress.needed * 100)}%` }} /></div><b>{progress.maxed ? 'MAX LEVEL' : `${Math.round(progress.current)} / ${progress.needed} XP`}</b></section>
    <nav className="build-tabs" aria-label="Build sections">{(['gear', 'reconstruct', 'network', 'protocols', 'settings'] as Tab[]).map(value => { const badge = value === 'gear' ? newLootIds.length : value === 'network' ? profile.progressionPoints : 0; return <button key={value} className={tab === value ? 'selected' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => selectTab(value)}>{tabLabels[value]}{badge > 0 && <span className="tab-badge">{badge}</span>}</button>; })}</nav>
    {message && <div className="build-message" role="status">{message}</div>}

    {tab === 'gear' && <><section className="gear-discovery-note compact-discovery"><div><small>CLASS ARSENAL // {operatorClassDefinition.name.toUpperCase()}</small><b>{slotLabels[activeWeaponFamily]} is your weapon family.</b><span>New combat recoveries roll only your owned weapon family plus universal Combat Suit, Systems Rig, and Implant slots. Off-class weapons from older saves stay safely stored but cannot equip.</span><ProgressiveDisclosure triggerLabel="How equipment discovery works" eyebrow="Equipment discovery" heading="How equipment discovery works"><p>Class arsenal ownership, discovery rules, rarity language, frame depth, and Singular identity now have one canonical home in Intel → Guide. Current equip eligibility and item-specific effects remain in this bay.</p></ProgressiveDisclosure><GuideLink section="equipment-rarity" label="Equipment & Rarity" onOpenGuide={openGuide} /></div><div className="discovered-effects" aria-label="Discovered loadout interactions">{activeDoctrineStates.map(state => <article key={state.definition.id} className={`discovered-doctrine faction-${state.definition.id}`}><small>{state.definition.displayName.toUpperCase()} // DISCOVERED</small><b>Active loadout interaction</b><span>{state.definition.twoPiece}</span>{state.fourPieceActive && <span>{state.definition.fourPiece}</span>}</article>)}</div></section><div className="gear-layout"><section className="gear-storage"><div className="loadout-heading"><div><small>LOADOUT</small><b>{equippedSlotCount}/4 equipped</b></div><span>Tap a slot to inspect or compare.</span></div><div className="equipment-slots">{loadoutSlots.map(slot => { const item = loadoutItems[slot]; const requirement = item ? itemEquipRequirement(profile, item) : null; const fit = item ? itemBuildFitLabel(profile, item) : 'EMPTY SLOT'; return <button key={`${slot}:${profile.equipped[slot] ?? 'empty'}`} className={`equipped-card ${selectedId === item?.id ? 'selected-slot' : ''} ${item ? rarityClass(item) : ''} ${factionClass(item)}`} data-requirement-state={requirement?.state ?? 'ready'} onClick={() => item && setSelectedId(item.id)}><div className="equipment-card-heading"><small>{slotLabels[slot]}</small>{item && <em className="rarity-pill" aria-label={rarityDefinition(item.rarity).accessibleLabel}><RarityText rarity={item.rarity} /></em>}</div><b>{item?.name ?? 'Empty'}</b><span className={`item-effect-preview ${item?.rarity === 'Singular' ? 'singular-rule-preview' : ''}`}>{item ? (item.rarity === 'Singular' ? singularSurfaceRule(item) : shortItemEffect(item)) : 'No frame installed.'}</span><div className="inventory-card-decision" data-requirement-state={requirement?.state ?? 'ready'}><span>{requirement ? `${requirement.state.toUpperCase()} // ${requirement.label}` : `EMPTY // Ready for ${slotLabels[slot]}`}</span><small>{fit}</small></div>{item && <small className="inventory-card-delta">{conciseItemDelta(profile, item)}</small>}</button>; })}</div><div className="storage-heading"><h2>Ship Storage</h2><span>{visibleInventory.length} shown of {storageItemCount} stowed items</span></div><div className="inventory-tools"><input type="search" value={gearQuery} onChange={event => setGearQuery(event.target.value)} placeholder="Search base, frame, source, modifier, augment…" aria-label="Search ship storage" /><select value={gearRarity} onChange={event => setGearRarity(event.target.value as RarityFilter)} aria-label="Filter ship storage by rarity"><option value="all">All rarities</option>{rarityOrder.map(rarity => <option key={rarity} value={rarity}>{rarityDisplayLabel(rarity)}</option>)}</select><select value={gearSort} onChange={event => setGearSort(event.target.value as InventorySort)} aria-label="Sort ship storage"><option value="recent">Recent order</option><option value="quality">Recovery quality</option><option value="recovery">Recovery level</option><option value="rarity">Rarity · high to low</option><option value="modifier">Top modifier grade</option><option value="augments">Augments installed</option><option value="level">Equip level · high to low</option><option value="name">Name</option></select>{(gearQuery || gearFilter !== 'all' || gearRarity !== 'all' || gearSort !== 'recent') && <button className="inventory-reset" aria-label="Clear storage filters" onClick={() => { setGearQuery(''); setGearFilter('all'); setGearRarity('all'); setGearSort('recent'); }}>Clear</button>}<div className="inventory-filter-scroll" aria-label="Equipment filters"><button className={gearFilter === 'all' ? 'selected' : ''} onClick={() => setGearFilter('all')}>All</button><button className={gearFilter === 'new' ? 'selected' : ''} onClick={() => setGearFilter('new')}>New · {newLootIds.length}</button><button className={gearFilter === 'usable' ? 'selected' : ''} onClick={() => setGearFilter('usable')}>Usable now</button><button className={gearFilter === 'class-fit' ? 'selected' : ''} onClick={() => setGearFilter('class-fit')}>{operatorClassDefinition.name} fit</button><button className={gearFilter === 'augmented' ? 'selected' : ''} onClick={() => setGearFilter('augmented')}>Augmented</button><button className={gearFilter === 'build-changing' ? 'selected' : ''} onClick={() => setGearFilter('build-changing')}>Build-changing</button>{slots.map(slot => <button key={slot} className={gearFilter === slot ? 'selected' : ''} onClick={() => setGearFilter(slot)}>{slotLabels[slot]}</button>)}</div></div><div className="inventory-grid">{visibleInventory.map(item => { const fresh = newLootIds.includes(item.id); const requirement = itemEquipRequirement(profile, item); const fit = itemBuildFitLabel(profile, item); return <button key={item.id} className={`inventory-card ${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${factionClass(item)} ${qualityClass(item)}`} data-requirement-state={requirement.state} onClick={() => setSelectedId(item.id)}><div className="equipment-card-heading"><small>{slotLabels[item.slot]}</small><em className="rarity-pill" aria-label={rarityDefinition(item.rarity).accessibleLabel}><RarityText rarity={item.rarity} /></em>{fresh && <em className="inventory-new-pill">NEW</em>}</div><b>{item.name}</b><span className={`item-effect-preview ${item.rarity === 'Singular' ? 'singular-rule-preview' : ''}`}>{item.rarity === 'Singular' ? singularSurfaceRule(item) : shortItemEffect(item)}</span><div className="inventory-card-decision" data-requirement-state={requirement.state}><span>{requirement.state.toUpperCase()} // {requirement.label}</span><small>{fit}</small></div><small className="inventory-card-delta">{conciseItemDelta(profile, item)}</small></button>; })}{visibleInventory.length === 0 && <div className="inventory-empty"><b>{storageItemCount === 0 ? 'Ship storage is empty' : 'No matching equipment'}</b><span>{storageItemCount === 0 ? 'Equipped frames are shown in the operator kit above and return here when unequipped.' : 'Clear filters or search to show the rest of ship storage.'}</span>{storageItemCount > 0 && <button onClick={() => { setGearFilter('all'); setGearRarity('all'); setGearSort('recent'); setGearQuery(''); }}>Clear filters</button>}</div>}</div></section></div>{selected && typeof document !== 'undefined' ? createPortal(<div className="armory-item-modal" data-item-modal="true"><button type="button" className="item-inspector-backdrop" aria-label="Close item details" onClick={() => setSelectedId(null)} />{inspectorPanel}</div>, document.body) : null}</>}

    {tab === 'reconstruct' && <section className="reconstruction-panel" data-management-surface="crafting"><div className="reconstruction-top iv-panel iv-panel--glass"><div><span className="card-kicker">QUIET SIGNAL // RECONSTRUCTION BENCH</span><h2>Controlled equipment work</h2><p>Frame Quality only improves the base frame property. Augments are fixed utility/specialization hardware with bounded sockets; explicit modifier strength stays in modifier grades.</p></div><div className="resource-ribbon">{(['credits', 'alloys', 'electronics', 'components', 'rareTech'] as ResourceId[]).map(key => <span key={key}><small>{resourceLabels[key]}</small><b>{campaign.resources[key]}</b></span>)}</div></div><div className="reconstruct-layout"><aside className="reconstruct-storage iv-panel">{profile.inventory.map(item => <button key={item.id} className={`${selectedId === item.id ? 'selected' : ''} ${rarityClass(item)} ${qualityClass(item)}`} onClick={() => setSelectedId(item.id)}><small>{slotLabels[item.slot]} · <RarityText rarity={item.rarity} /></small><b>{item.name}</b><span>{frameIdentityDefinition(frameIdentity(item)).name} · Q{item.equipmentQuality ?? 0} · {(item.augments ?? []).length}/{item.augmentSlots ?? 0} AUG</span>{item.rarity === 'Singular' && item.singularEffect && <span className="singular-surface-callout" aria-label="Singular fixed rule">{singularSurfaceRule(item)}</span>}</button>)}</aside>{selected ? <ReconstructionBench item={selected} profile={profile} campaign={campaign} lockedFamily={lockedFamily} onLockFamily={setLockedFamily} pendingAction={pendingCraft} onPreview={setPendingCraft} onConfirm={runReconstruction} onCancelPreview={() => setPendingCraft(null)} onOpenGuide={openGuide} /> : <div className="empty-inspector"><b>Select equipment</b><span>Choose an item from ship storage to open the reconstruction controls.</span></div>}</div></section>}

    {tab === 'network' && <section className="network-panel" data-management-surface="progression" onKeyDown={handleNetworkNavigation}>
      <div className="section-copy iv-panel iv-panel--glass"><h2>Operator Class & Progression</h2><p>Focus a node to see its route, point cost, tradeoff, eligibility, blocker, and next requirement. Planning stays free until an eligible Allocate action is used.</p><GuideLink section="builds-progression" label="Builds & Progression" onOpenGuide={openGuide} /></div>
      <section className="network-planner iv-panel" aria-label="Operator Network planner">
        <header className="network-planner-heading">
          <div><small>P9-E // ROUTE PLANNER</small><b>Search, preview, then commit</b><span>PLAN PREVIEW // No points spent · Allocate now is the commit action.</span></div>
          <div className="network-planner-search"><input type="search" value={networkQuery} onChange={event => setNetworkQuery(event.target.value)} placeholder="Search Operator Network" aria-label="Search Operator Network" />{networkQuery && <button onClick={() => setNetworkQuery('')}>Clear</button>}</div>
          <div className="network-planner-nav" aria-label="Network navigation"><button onClick={() => focusNetworkNodeByOffset(-1)}>Previous node</button><button onClick={() => focusNetworkNodeByOffset(1)}>Next node</button></div>
        </header>
        {networkQuery && <div className="network-search-results" aria-label="Operator Network search results">{networkSearchResults.length ? networkSearchResults.map(node => <button key={node.id} className={networkFocusId === node.id ? 'selected' : ''} onClick={() => setNetworkFocusId(node.id)}><small>{node.branch} · {node.kind}</small><b>{node.name}</b><span>{node.description}</span></button>) : <span className="network-search-empty">No class-compatible Network nodes match “{networkQuery}”.</span>}</div>}
        <div className="network-planner-body">
          <article className="network-focus-card">
            {networkFocusedNode ? <>
              <small>FOCUSED NODE // {networkFocusedNode.branch.toUpperCase()}</small>
              <h3>{networkFocusedNode.name}</h3>
              <p>{networkFocusedNode.description}</p>
              <div className="network-focus-route">
                {profile.allocatedNodes.includes(networkFocusedNode.id)
                  ? <b>ALLOCATED // ACTIVE NOW</b>
                  : networkFocusedNode.milestone
                    ? <b>{operatorNetworkMilestoneActive(operatorNetwork, networkFocusedNode.id, operatorNetworkContext) ? 'MILESTONE ONLINE' : 'MILESTONE LOCKED'}</b>
                    : networkFocusedRoute
                      ? <><b>ROUTE PREVIEW // {networkFocusedRoute.pointCost} PT · {networkFocusedRoute.nodeIds.length} NODE{networkFocusedRoute.nodeIds.length === 1 ? '' : 'S'}</b><span>{networkFocusedRoute.nodeIds.map(id => progressionNodes.find(node => node.id === id)?.name ?? id).join(' → ')}</span></>
                      : <b>NO LEGAL ROUTE FROM CURRENT BUILD</b>}
              </div>
              {focusedAllocationRequirement && <ActionRequirement presentation={focusedAllocationRequirement} />}
              <div className="network-focus-actions">
                {!networkFocusedNode.milestone && !profile.allocatedNodes.includes(networkFocusedNode.id) && networkFocusedRoute && <button className={networkPlanTargets.includes(networkFocusedNode.id) ? 'active' : ''} onClick={() => toggleNetworkPlanTarget(networkFocusedNode.id)}>{networkPlanTargets.includes(networkFocusedNode.id) ? 'Remove from plan' : 'Plan this route'}</button>}
                {profile.allocatedNodes.includes(networkFocusedNode.id) && !networkFocusedNode.milestone && <button disabled={campaign.resources.credits < focusedRefundCost} onClick={() => runNetworkRefund(networkFocusedNode.id)}>Refund node · {focusedRefundCost > 0 ? `${focusedRefundCost} cr` : 'FREE'}</button>}
                <button disabled={focusedAllocationRequirement?.state !== 'ready'} onClick={() => applyResult(allocateNode(profile, networkFocusedNode.id, operatorNetworkContext))}>Allocate now</button>
              </div>
            </> : <>
              <small>FOCUSED NODE</small>
              <h3>Select a Network node</h3>
              <p>Tap a node, use search, press the arrow keys, or use a controller D-pad to inspect it without spending a point.</p>
            </>}
          </article>
          <article className="network-plan-card">
            <div className="network-plan-heading"><div><small>PLANNED BUILD</small><b>{networkPlanTargets.length ? `${networkPlanTargets.length} target${networkPlanTargets.length === 1 ? '' : 's'}` : 'No targets yet'}</b></div>{networkPlanTargets.length > 0 && <button onClick={() => setNetworkPlanTargets([])}>Clear plan</button>}</div>
            <div className="network-plan-summary"><span><small>TOTAL COST</small><b>{networkPlan.pointCost} PT</b></span><span><small>AVAILABLE NOW</small><b>{profile.progressionPoints} PT</b></span><span className={networkPlanShortfall > 0 ? 'shortfall' : 'ready'}><small>{networkPlanShortfall > 0 ? 'FUTURE POINTS NEEDED' : 'STATUS'}</small><b>{networkPlanShortfall > 0 ? networkPlanShortfall : networkPlan.pointCost > 0 ? 'AFFORDABLE' : 'READY'}</b></span><span><small>ROUTE NODES</small><b>{networkPlan.nodeIds.length}</b></span></div>
            {networkPlanTargets.length > 0 && <div className="network-plan-targets">{networkPlanTargets.map(id => { const node = progressionNodes.find(entry => entry.id === id); const unresolved = networkPlan.unresolvedTargetIds.includes(id); return <button key={id} className={unresolved ? 'unresolved' : ''} onClick={() => { setNetworkFocusId(id); toggleNetworkPlanTarget(id); }}><b>{node?.name ?? id}</b><small>{unresolved ? 'UNRESOLVED · REMOVE' : 'PLANNED · REMOVE'}</small></button>; })}</div>}
            <div className="network-route-preview"><small>AGGREGATE PATH</small><span>{networkPlanNodeNames.length ? networkPlanNodeNames.join(' → ') : 'Add a target to preview the lowest-cost legal path. Shared route nodes are counted once.'}</span></div>
          </article>
        </div>
        <ProgressiveDisclosure triggerLabel="View planned build math" eyebrow="Progression details" heading="Planned build before / after math"><div className="network-stat-preview" aria-label="Planned build before and after math"><small className="network-stat-title">BEFORE / AFTER BUILD MATH</small>{networkPlannerMetrics.map(metric => <span key={metric.label} className={metric.before !== metric.after ? 'changed' : ''}><small>{metric.label}</small><b>{metric.before} <i>→</i> {metric.after}</b></span>)}</div><p>Planner math is a preview only. Points are spent only by an eligible Allocate action.</p></ProgressiveDisclosure>
        <section className="network-recalibration" aria-label="Operator Network recalibration">
          <div><small>P9-F // RECALIBRATION</small><b>{experimentationIsFree ? 'Field trials are free through level 8' : 'High-level rebuilds consume credits'}</b><span>Current legality, exact rebuild cost, and any blocker stay beside the rebuild action.</span></div>
          <ActionRequirement presentation={networkRebuildRequirement} />
          <div className="network-recalibration-actions"><span><small>CREDITS</small><b>{campaign.resources.credits}</b></span><span><small>ALLOCATED</small><b>{operatorNetwork.allocatedNodeIds.length}</b></span><span><small>FULL REBUILD</small><b>{networkRebuildCost > 0 ? `${networkRebuildCost} cr` : 'FREE'}</b></span><button disabled={networkRebuildRequirement.state !== 'ready'} onClick={runNetworkRebuild}>Rebuild Operator Network</button></div>
        </section>
      </section>
      <section className="operator-class-panel iv-panel" aria-label="Operator classes">
        <header className="operator-class-heading"><div><small>OPERATOR CLASS // FIELD DOCTRINE</small><b>{operatorClassDefinition.name} · {operatorClassDefinition.identity}</b><span>{operatorClassDefinition.description}</span></div><div className="resonance-meter"><small>GEAR RESONANCE</small><b>{classResonance.count}/4</b><span>{classResonance.tier === 2 ? 'TIER II ACTIVE' : classResonance.tier === 1 ? 'TIER I ACTIVE' : 'BUILDING'}</span></div></header>
        <div className="operator-class-grid">{operatorClassDefinitions.map(definition => { const active = definition.id === operatorClass; const resonance = gearResonanceForProfile(profile, definition.id); const kit = classAbilityKits[definition.id]; return <button key={definition.id} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => applyResult(setOperatorClass(profile, definition.id))}><small>{definition.identity}</small><b>{definition.name}</b><span><strong>{definition.signatureName}</strong> // {definition.signatureDescription}</span><em>{definition.combatLoop}</em><strong>LV1 KIT // {kit.map(ability => ability.shortName).join(' · ')}</strong><strong>{definition.branchAffinities.join(' + ')} affinity · {resonance.count}/4 resonant frames</strong></button>; })}</div>
        <div className="class-resonance-strip"><div className={classResonance.tier >= 1 ? 'active' : ''}><small>TIER I // 2 FRAMES</small><b>{operatorClassDefinition.resonanceTier1}</b></div><div className={classResonance.tier >= 2 ? 'active' : ''}><small>TIER II // 4 FRAMES</small><b>{operatorClassDefinition.resonanceTier2}</b></div></div>
        
      </section>
      <section className={`specialization-panel iv-panel ${profile.level < 15 ? 'locked' : ''}`}>
        <header><div><small>LV15+ // {operatorClassDefinition.name.toUpperCase()} SPECIALIZATIONS</small><b>Choose a deep class path with an explicit tradeoff</b><span>Choice, tradeoff, active state, and level gate stay on each specialization below.</span></div>{profile.specialization && profile.level >= 15 && <button onClick={() => { onProfileChange(setSpecialization(profile, null)); setMessage('Specialization cleared; class, Network allocations, and equipment are unchanged.'); }}>Clear specialization</button>}</header>
        {profile.level < 15 ? <div className="specialization-lock"><ActionRequirement presentation={{ state: 'blocked', label: 'Specializations require operator level 15', reason: `Current operator is LV ${profile.level}.`, nextRequirement: 'Reach operator level 15. Your class, gear resonance, Lenses, and Network remain active while leveling.' }} /></div> : <><div className="specialization-grid">{availableSpecializations.map(definition => { const selectedSpec = profile.specialization === definition.id; const gearLink = specializationGearSynergyDefinitions.find(entry => entry.specialization === definition.id); return <article key={definition.id} className={selectedSpec ? 'selected' : ''}><button className="specialization-select" onClick={() => { onProfileChange(setSpecialization(profile, definition.id)); setMessage(`${definition.name} specialization active // ${definition.tradeoff}`); }}><small>{definition.identity}</small><b>{definition.name}</b><span>{definition.description}</span><em>TRADEOFF // {definition.tradeoff}</em></button>{selectedSpec && <div className="overclock-row"><div><b>LV16 OVERCLOCK</b><span>{profile.level >= 16 ? definition.overclock : 'Reach level 16 to unlock the optional overclock.'}</span><small>{profile.level >= 16 ? `TRADEOFF // ${definition.overclockTradeoff}` : 'LOCKED'}</small></div><button disabled={profile.level < 16} className={profile.specializationOverclock ? 'active' : ''} onClick={() => { const next = !profile.specializationOverclock; onProfileChange(setSpecializationOverclock(profile, next)); setMessage(`${definition.name} overclock ${next ? 'enabled' : 'disabled'}.`); }}>{profile.specializationOverclock ? 'Overclock on' : 'Enable overclock'}</button></div>}{selectedSpec && gearLink && <div className="overclock-row gear-link-row"><div><b>GEAR LINK // {gearLink.name}</b><span>{gearLink.description}</span><small>{activeGearSynergy?.active ? `ACTIVE // ${activeGearSynergy.matchingItemIds.length} MATCHED FRAME${activeGearSynergy.matchingItemIds.length === 1 ? '' : 'S'}` : `REQUIRES // ${gearLink.requirement}`}</small></div><strong>{activeGearSynergy?.active ? 'ONLINE' : 'BUILDING'}</strong></div>}</article>; })}</div>{profile.specialization && <div className="specialization-grid" aria-label="Specialization Operator Network route">{specializationNetworkNodes.map(node => { const milestoneActive = !!node.milestone && operatorNetworkMilestoneActive(operatorNetwork, node.id, operatorNetworkContext); const allocated = profile.allocatedNodes.includes(node.id); const route = operatorNetworkRouteToNode(operatorNetwork, node.id, operatorNetworkContext); const active = milestoneActive || allocated; const requirement = networkRequirementFor(node, route); return <article key={node.id} className={active ? 'selected' : ''}><div className="overclock-row gear-link-row"><div><b>{node.kind.replace('specialization-', '').toUpperCase()} // {node.name}</b><span>{node.description}</span><small>{node.unlockLabel ? `UNLOCK // ${node.unlockLabel}` : node.minLevel ? `MILESTONE // LV${node.minLevel} + prior Network node` : 'NETWORK ROUTE'}</small></div>{node.milestone ? <strong>{milestoneActive ? 'ONLINE' : 'CONDITION PENDING'}</strong> : <button disabled={requirement.state !== 'ready'} onClick={() => applyResult(allocateNode(profile, node.id, operatorNetworkContext))}>{allocated ? 'Allocated' : `Allocate ${node.allocationCost} pt`}</button>}</div><ActionRequirement presentation={requirement} /></article>; })}</div>}</>}
      </section>
      <div className="network-wave-summary" aria-label="Deep Operator Network core wave status"><span><small>AUTHORED NODES</small><b>{progressionNodes.length + 3}</b></span><span><small>ALLOCATED</small><b>{profile.allocatedNodes.length}</b></span><span><small>BUILD-DEFINING ONLINE</small><b>{allocatedBuildDefiningNodes}</b></span><span><small>{operatorClassDefinition.name.toUpperCase()} WEAPON SECTOR</small><b>{ownedWeaponSectorNodes} NODES</b></span></div>
      <div className="network-grid">{[...groups.entries()].map(([branch, nodes]) => <article key={branch} className={`network-branch ${classBranchAffinities.has(branch) ? 'class-affinity' : ''}`}><h3>{branch}{classBranchAffinities.has(branch) && <small>{operatorClassDefinition.name} affinity</small>}</h3>{nodes.map(node => { const allocated = profile.allocatedNodes.includes(node.id); const route = operatorNetworkRouteToNode(operatorNetwork, node.id, operatorNetworkContext); const wrongArsenal = !!node.weaponFamily && node.weaponFamily !== activeWeaponFamily; const exclusiveChoice = !!node.exclusiveGroup && progressionNodes.some(other => other.id !== node.id && other.exclusiveGroup === node.exclusiveGroup && profile.allocatedNodes.includes(other.id)); const lacksPoints = profile.progressionPoints < node.allocationCost; const focused = networkFocusId === node.id; const planned = networkPlan.nodeIds.includes(node.id); const previewed = !!networkFocusedRoute?.nodeIds.includes(node.id); return <button type="button" data-network-node="true" key={node.id} aria-pressed={focused} className={`${allocated ? 'allocated' : ''} ${focused ? 'focused' : ''} ${planned ? 'planned' : ''} ${previewed ? 'route-preview' : ''} ${node.major ? 'major' : ''} ${node.weaponFamily ? 'weapon-sector' : ''} ${node.weaponFamily === activeWeaponFamily ? 'owned-weapon-sector' : ''}`} onFocus={() => setNetworkFocusId(node.id)} onClick={() => setNetworkFocusId(node.id)}><span>{node.kind === 'standard' ? '' : `${node.kind.toUpperCase()} // `}{node.name}</span><small className="network-node-meta">{node.kind.toUpperCase()} · {node.weaponFamily ? `${slotLabels[node.weaponFamily].toUpperCase()} SECTOR` : `${node.sector.toUpperCase()} SECTOR`} · {node.allocationCost} PT</small><small>{node.description}</small>{allocated ? <em>Allocated · active now</em> : exclusiveChoice ? <em>Alternative Keystone already committed in this branch</em> : wrongArsenal ? <em>{slotLabels[node.weaponFamily!]} belongs to another class arsenal</em> : route && route.nodeIds.length > 1 ? <em>Route {route.pointCost} pts // {route.nodeIds.length} nodes away · select to plan</em> : !route ? <em>No legal route from current class origin</em> : lacksPoints ? <em>Ready route · gain another progression point</em> : <em>Ready to allocate · select for actions</em>}</button>; })}</article>)}</div>
    </section>}
    {tab === 'protocols' && <section className="protocol-panel" data-management-surface="skills">
      <div className="section-copy"><h2>Class Skills</h2><p>Choose Standard, a Lens, or a class Evolution. Tradeoff, active/ready/blocked state, level gate, and capstone warning stay beside each action.</p><GuideLink section="builds-progression" label="Builds & Progression" onOpenGuide={openGuide} /></div>
      <section className="skill-path-overview" aria-label="Class skill hierarchy">
        <article className="active"><small>1 // CLASS</small><b>{operatorClassDefinition.name}</b><span>{activeAbilityKit.map(ability => ability.shortName).join(' · ')}</span></article>
        <article className="active"><small>2 // WEAPON FAMILY</small><b>{slotLabels[activeWeaponFamily]}</b><span>{activeWeaponItem?.name ?? 'Required class armament'} · family-linked skill tuning</span></article>
        <article className={Object.values(profile.abilityMods).some(Boolean) ? 'active' : ''}><small>3 // LENS / EVOLUTION</small><b>{Object.values(profile.abilityMods).filter(Boolean).length}/3 modified</b><span>Shared Lenses or LV16 class Evolutions occupy each skill slot.</span></article>
        <article className={activeSpecializationDefinition ? 'active' : ''}><small>4 // SPECIALIZATION / CAPSTONE</small><b>{activeSpecializationDefinition?.name ?? (profile.level < 15 ? 'Locked until LV15' : 'Not selected')}</b><span>{activeCapstoneCount > 0 ? `${activeCapstoneCount} capstone link${activeCapstoneCount === 1 ? '' : 's'} online` : profile.level >= 16 ? 'Pair a class Evolution with the matching specialization for a capstone link.' : 'Capstone links unlock from LV16 class Evolutions.'}</span></article>
      </section>
      <div className="protocol-grid skill-path-grid">{(['mag', 'mark', 'arc'] as AbilityId[]).map(ability => {
        const slotIndex = abilitySlotIndex[ability];
        const kitAbility = activeAbilityKit[slotIndex];
        const compatibleMods = abilityMods.filter(mod => mod.ability === ability && (!mod.operatorClass || mod.operatorClass === operatorClass));
        const sharedMods = compatibleMods.filter(mod => !mod.evolution);
        const evolutionMods = compatibleMods.filter(mod => mod.evolution);
        const selectedModId = profile.abilityMods[ability];
        const selectedMod = compatibleMods.find(mod => mod.id === selectedModId);
        const selectedCapstone = capstoneInteractionFor(profile, selectedModId);
        const familyFrame = activeWeaponItem ? frameIdentityDefinition(frameIdentity(activeWeaponItem)).name : 'Class armament required';
        return <article key={ability} className="skill-path-card" aria-label={`Skill hierarchy for ${kitAbility.name}`}>
          <header className="skill-path-heading"><img src={classSkillIconAssets[operatorClass][slotIndex]} alt="" aria-hidden="true" /><div><small>{operatorClassDefinition.name.toUpperCase()} CLASS SKILL // SLOT {slotIndex + 1}</small><h3>{kitAbility.name} // {kitAbility.shortName}</h3><p className="protocol-skill-copy">{kitAbility.description}</p></div></header>
          <div className="skill-option-group">
            <small>STANDARD</small>
            <button data-skill-slot={ability} data-skill-mod="standard" className={!selectedModId ? 'selected' : ''} aria-pressed={!selectedModId} onClick={() => onProfileChange(setAbilityMod(profile, ability, null))}><b>{operatorClassDefinition.name} Standard</b><span>Use the native {kitAbility.name} behavior with no additional lens tradeoff.</span><small>{!selectedModId ? 'ACTIVE NOW' : 'READY NOW'}</small></button>
          </div>
          <div className="skill-option-group">
            <small>SHARED LENSES</small>
            {sharedMods.map(mod => <button key={mod.id} data-skill-slot={ability} data-skill-mod={mod.id} className={selectedModId === mod.id ? 'selected' : ''} aria-pressed={selectedModId === mod.id} onClick={() => { onProfileChange(setAbilityMod(profile, ability, mod.id)); setMessage(`${mod.name} installed on ${kitAbility.name}.`); }}><b>{mod.name}</b><span>{mod.description}</span><small>{selectedModId === mod.id ? 'ACTIVE NOW' : 'READY NOW'} · SHARED LENS // TRADEOFF // {mod.tradeoff}</small></button>)}
          </div>
          <div className="skill-option-group skill-evolution-group">
            <small>CLASS EVOLUTIONS</small>
            {evolutionMods.map(mod => {
              const requiredLevel = mod.minLevel ?? 1;
              const locked = profile.level < requiredLevel;
              const capstone = capstoneInteractionFor(profile, mod.id);
              const skillEvolutionRequirement: RequirementPresentation = selectedModId === mod.id
                ? { state: 'active', label: `${mod.name} active`, detail: `${kitAbility.name} is using this class Evolution now.` }
                : locked
                  ? {
                      state: 'blocked',
                      label: `Requires operator level ${requiredLevel}`,
                      reason: `${mod.name} requires LV ${requiredLevel}; the current operator is LV ${profile.level}.`,
                      nextRequirement: `Reach operator level ${requiredLevel} to install this Evolution.`,
                    }
                  : { state: 'ready', label: `${mod.name} ready`, detail: `Install this Evolution on ${kitAbility.name}. Its tradeoff remains visible above.` };
              return <Fragment key={mod.id}><button data-skill-slot={ability} data-skill-mod={mod.id} disabled={locked} className={selectedModId === mod.id ? 'selected' : ''} aria-pressed={selectedModId === mod.id} onClick={() => { onProfileChange(setAbilityMod(profile, ability, mod.id)); setMessage(`${mod.name} installed on ${kitAbility.name}.`); }}>
                <b>{mod.name}</b>
                <span>{mod.description}</span>
                <small>LV{requiredLevel} {operatorClassDefinition.name.toUpperCase()} EVOLUTION // TRADEOFF // {mod.tradeoff}</small>
                {capstone ? <small>CAPSTONE LINK // {capstone.name} // {capstone.description}</small> : activeSpecializationDefinition && !locked ? <small>SPECIALIZATION // {activeSpecializationDefinition.name} active · no capstone pairing on this Evolution</small> : null}
              </button><ActionRequirement presentation={skillEvolutionRequirement} /></Fragment>;
            })}
          </div>
          <ProgressiveDisclosure triggerLabel="View current skill path" eyebrow="Skill path details" heading={`${kitAbility.name} build path`}>
            <div className="skill-hierarchy-grid">
              <div className="active"><small>1 // CLASS SKILL</small><b>{kitAbility.name}</b><span>Native {operatorClassDefinition.name} behavior.</span></div>
              <div className="active skill-family-stage"><img src={weaponIconAssets[activeWeaponFamily]} alt="" aria-hidden="true" /><div><small>2 // WEAPON FAMILY</small><b>{slotLabels[activeWeaponFamily]}</b><span>{familyFrame} · {activeSkillBuild.sources.length} family build source{activeSkillBuild.sources.length === 1 ? '' : 's'} active</span></div></div>
              <div className={selectedMod ? 'active' : ''}><small>3 // LENS / EVOLUTION</small><b>{selectedMod ? `${selectedMod.evolution ? 'Evolution' : 'Lens'} · ${selectedMod.name}` : `${operatorClassDefinition.name} Standard`}</b><span>{selectedMod ? selectedMod.tradeoff : 'No additional lens tradeoff.'}</span></div>
              <div className={selectedCapstone ? 'active capstone-stage' : activeSpecializationDefinition ? 'specialization-stage' : ''}><small>4 // SPECIALIZATION / CAPSTONE</small><b>{selectedCapstone ? selectedCapstone.name : activeSpecializationDefinition?.name ?? (profile.level < 15 ? 'Locked until LV15' : 'No specialization selected')}</b><span>{selectedCapstone ? selectedCapstone.description : activeSpecializationDefinition ? 'Specialization active. This skill selection does not form its capstone pairing.' : 'Choose a LV15 specialization; matching LV16 Evolutions can form capstone links.'}</span></div>
            </div>
          </ProgressiveDisclosure>
        </article>;
      })}</div>
    </section>}
    {tab === 'settings' && <section className="settings-panel">
      <div className="section-copy"><h2>Graphics, Accessibility, Controls & Feedback</h2><p>Graphics quality, accessibility, combat assistance, touch layout, audio, and feedback preferences save with the local operator profile. Each control keeps its immediate effect below.</p><GuideLink section="accessibility-settings" label="Accessibility / Settings" onOpenGuide={openGuide} /></div>
      <label><span><b>Graphics quality</b><small>Adaptive balances presentation against live frame pressure. Flagship starts with full shadows, reflections, VFX and texture sampling; Performance starts at the lowest-cost presentation tier. Combat mechanics and critical tells stay unchanged.</small></span><select aria-label="Graphics quality" value={profile.settings.graphicsQuality} onChange={event => onProfileChange(setProfileSettings(profile, { graphicsQuality: event.target.value as PlayerProfile['settings']['graphicsQuality'] }))}><option value="adaptive">Adaptive</option><option value="flagship">Flagship</option><option value="performance">Performance</option></select></label>
      <label><span><b>Interface size</b><small>Compact fits more management UI on screen. Large increases shared menu, panel, spacing, icon, and informational HUD scale. Combat controls keep their dedicated Combat layout size and hit regions.</small></span><select aria-label="Interface size" value={profile.settings.interfaceSize} onChange={event => onProfileChange(setProfileSettings(profile, { interfaceSize: event.target.value as PlayerProfile['settings']['interfaceSize'] }))}><option value="compact">Compact</option><option value="default">Default</option><option value="large">Large</option></select></label>
      <label><span><b>Interface text size</b><small>Large scales the interface typography for easier reading while preserving responsive layouts.</small></span><select aria-label="Interface text size" value={profile.settings.textScale} onChange={event => onProfileChange(setProfileSettings(profile, { textScale: event.target.value as PlayerProfile['settings']['textScale'] }))}><option value="default">Default</option><option value="large">Large</option></select></label>
      <label><span><b>High contrast</b><small>Strengthens text, borders, surfaces, and focus cues without removing rarity shape coding.</small></span><input aria-label="High contrast" type="checkbox" checked={profile.settings.contrast === 'high'} onChange={event => onProfileChange(setProfileSettings(profile, { contrast: event.target.checked ? 'high' : 'standard' }))} /></label>
      <label><span><b>Reduce motion</b><small>Disables interface transitions and combat camera shake while leaving gameplay timing unchanged.</small></span><input aria-label="Reduce motion" type="checkbox" checked={profile.settings.reducedMotion} onChange={event => onProfileChange(setProfileSettings(profile, { reducedMotion: event.target.checked }))} /></label>
      <label><span><b>Combat layout preset</b><small>Standard keeps movement left and actions right. Large grows both control clusters. Left-Handed swaps their sides without moving mission-critical HUD information.</small></span><select aria-label="Combat layout preset" value={profile.settings.hudLayoutPreset} onChange={event => onProfileChange(setProfileSettings(profile, hudLayoutPresetPatch(event.target.value as PlayerProfile['settings']['hudLayoutPreset']))) }><option value="standard">Standard</option><option value="large">Large</option><option value="left-handed">Left-Handed</option></select></label>
      <label><span><b>Movement cluster inset</b><small>Moves the movement cluster inward in landscape while preserving the safe edge and portrait separation.</small></span><input aria-label="Movement cluster inset" type="range" min="0" max="1" step="0.05" value={profile.settings.movementClusterInset} onChange={event => onProfileChange(setProfileSettings(profile, { movementClusterInset: Number(event.target.value) }))} /></label>
      <label><span><b>Movement cluster height</b><small>Lifts the movement controls above the bottom safe area.</small></span><input aria-label="Movement cluster height" type="range" min="0" max="1" step="0.05" value={profile.settings.movementClusterLift} onChange={event => onProfileChange(setProfileSettings(profile, { movementClusterLift: Number(event.target.value) }))} /></label>
      <label><span><b>Movement cluster size</b><small>Scales the visible movement cluster and its touch hit region together.</small></span><input aria-label="Movement cluster size" type="range" min="0.9" max="1.08" step="0.01" value={profile.settings.movementClusterScale} onChange={event => onProfileChange(setProfileSettings(profile, { movementClusterScale: Number(event.target.value) }))} /></label>
      <label><span><b>Action cluster inset</b><small>Moves FIRE, DODGE, skills, and contextual ACT inward in landscape while preserving safe-area bounds.</small></span><input aria-label="Action cluster inset" type="range" min="0" max="1" step="0.05" value={profile.settings.actionClusterInset} onChange={event => onProfileChange(setProfileSettings(profile, { actionClusterInset: Number(event.target.value) }))} /></label>
      <label><span><b>Action cluster height</b><small>Lifts the combat/action cluster above the bottom safe area.</small></span><input aria-label="Action cluster height" type="range" min="0" max="1" step="0.05" value={profile.settings.actionClusterLift} onChange={event => onProfileChange(setProfileSettings(profile, { actionClusterLift: Number(event.target.value) }))} /></label>
      <label><span><b>Action cluster size</b><small>Scales the visible action cluster and all of its touch hit regions together.</small></span><input aria-label="Action cluster size" type="range" min="0.9" max="1.08" step="0.01" value={profile.settings.actionClusterScale} onChange={event => onProfileChange(setProfileSettings(profile, { actionClusterScale: Number(event.target.value) }))} /></label>
      <label><span><b>Reset touch layout</b><small>Reapplies the selected preset and clears its movement/action offsets.</small></span><button type="button" data-hud-layout-reset onClick={() => { onProfileChange(setProfileSettings(profile, hudLayoutPresetPatch(profile.settings.hudLayoutPreset))); setMessage('Touch combat layout reset to the selected preset.'); }}>Reset current preset</button></label>
      <label><span><b>Touch aim assistance</b><small>Sets how readily assisted FIRE acquires a nearby visible threat.</small></span><select aria-label="Touch aim assistance" value={profile.settings.aimAssist} onChange={event => onProfileChange(setProfileSettings(profile, { aimAssist: event.target.value as PlayerProfile['settings']['aimAssist'] }))}><option value="light">Light</option><option value="balanced">Balanced</option></select></label>
      <label><span><b>Assisted fire tracking</b><small>When on, holding FIRE tracks a nearby threat. Turn it off for fully manual touch aiming.</small></span><input aria-label="Assisted fire tracking" type="checkbox" checked={profile.settings.rightStickFire} onChange={event => onProfileChange(setProfileSettings(profile, { rightStickFire: event.target.checked }))} /></label>
      <label><span><b>Screen shake</b><small>Enables recoil, impact and damage camera response on the combat canvas; the HUD never moves.</small></span><input aria-label="Screen shake" type="checkbox" checked={profile.settings.screenShake} onChange={event => onProfileChange(setProfileSettings(profile, { screenShake: event.target.checked }))} /></label>
      <label><span><b>Effect intensity</b><small>Reduced lowers secondary VFX and scales combat camera/haptic intensity without changing simulation rules.</small></span><select aria-label="Effect intensity" value={profile.settings.effectIntensity} onChange={event => onProfileChange(setProfileSettings(profile, { effectIntensity: event.target.value as PlayerProfile['settings']['effectIntensity'] }))}><option value="full">Full</option><option value="reduced">Reduced</option></select></label>
      <label><span><b>Combat effects volume</b><small>Weapons, impacts, breaches, abilities and enemy cues.</small></span><input aria-label="Combat effects volume" type="range" min="0" max="1" step="0.05" value={profile.settings.effectsVolume} onChange={event => onProfileChange(setProfileSettings(profile, { effectsVolume: Number(event.target.value) }))} /></label>
      <label><span><b>Interface volume</b><small>Ship controls and recovery confirmation.</small></span><input aria-label="Interface volume" type="range" min="0" max="1" step="0.05" value={profile.settings.uiVolume} onChange={event => onProfileChange(setProfileSettings(profile, { uiVolume: Number(event.target.value) }))} /></label>
      <label><span><b>Mobile haptics</b><small>Synchronized vibration for weapon recoil, impacts, damage, dodges and breaches when supported.</small></span><input aria-label="Mobile haptics" type="checkbox" checked={profile.settings.haptics} onChange={event => onProfileChange(setProfileSettings(profile, { haptics: event.target.checked }))} /></label>
      <label><span><b>Share anonymous run telemetry</b><small>Uploads anonymous balance telemetry and one-second position checkpoints after extractions or failed attempts. No account or device identifier is stored with a run.</small></span><input aria-label="Share anonymous run telemetry" type="checkbox" checked={profile.settings.telemetrySharing} onChange={event => onProfileChange(setProfileSettings(profile, { telemetrySharing: event.target.checked }))} /></label>
      <div className="control-reference"><div><b>Control reference</b><span>Desktop, mobile, controller, targeting, touch-layout presets, and combat-reading guidance live in Intel → Guide. Replay remains local because it changes the next deployment.</span></div><GuideLink section="combat-controls" label="Combat & Controls" onOpenGuide={openGuide} /><button onClick={() => { onProfileChange(setProfileSettings(profile, { tutorialComplete: false })); setMessage('Field tutorial will replay on the next deployment.'); }}>Replay field tutorial</button></div>
    </section>}
  </main>;
}
