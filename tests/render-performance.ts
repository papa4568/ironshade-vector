import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AdaptiveRenderBudget } from '../src/game/renderQuality';
import { spinHabitatArchitectureState, spinHabitatRenderProfile, spinHabitatSpindownState } from '../src/game/spinHabitatArchitecture';
import { jovianHarvesterRenderProfile, jovianHarvesterStormState } from '../src/game/jovianHarvesterVisualLanguage';
import { solarYardRenderProfile } from '../src/game/solarYardVisualProfile';
import { perseidRenderProfile } from '../src/game/perseidCapstone';
import { k91RenderProfile } from '../src/game/k91Capstone';
import { orphelineRenderProfile } from '../src/game/orphelineCapstone';
import { hecateRenderProfile } from '../src/game/hecateCapstone';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const gameCanvasSource = readFileSync(resolve(process.cwd(), 'src/components/GameCanvas.tsx'), 'utf8');
assert(!gameCanvasSource.includes('useRef<SimState>(createMissionState(firstMission))'), 'GameCanvas must not construct a new simulation on every React render');
assert(gameCanvasSource.includes('useState(() => createMissionState(firstMission))'), 'GameCanvas initial simulation should use a lazy one-time initializer');
assert(gameCanvasSource.includes('profileSettingsRef.current.effectIntensity') && gameCanvasSource.includes('profileSettingsRef.current.screenShake'), 'combat render loop must read live profile settings');

const rendererSource = readFileSync(resolve(process.cwd(), 'src/game/threeCombatRenderer.ts'), 'utf8');
const graphicsAssetsSource = readFileSync(resolve(process.cwd(), 'src/game/graphicsAssets.ts'), 'utf8');
const bossSyncStart = rendererSource.indexOf('private syncBossSignature');
const enemySyncStart = rendererSource.indexOf('private syncEnemies');
assert(bossSyncStart > 0 && enemySyncStart > bossSyncStart, 'boss signature sync path must exist before enemy iteration');
const bossSyncSource = rendererSource.slice(bossSyncStart, enemySyncStart);
assert(!bossSyncSource.includes('new THREE.Mesh(') && !bossSyncSource.includes('new THREE.' + 'Geometry'), 'boss hot path must update pooled visuals instead of allocating geometry per frame');
assert(rendererSource.includes("this.playerReadabilityLight.distance = reducedEffects ? 5.8 : 7.5"), 'reduced-effects mode must retain combat readability lighting');
assert(rendererSource.includes("telegraph.visible = enemy.telegraph > 0"), 'boss telegraph geometry must remain available independent of particle density');
assert(rendererSource.includes('private readonly damageNumberPool: DamageNumberVisual[] = []'), 'Three.js damage numbers must use a reusable visual pool');
assert(rendererSource.includes("sprite.name = 'enemy-damage-number'") && rendererSource.includes('private syncDamageNumbers(state: SimState)'), 'Three.js combat renderer is missing floating enemy damage numbers');
assert(rendererSource.includes("dataset.damageNumbers = count > 0 ? 'active' : 'idle'"), 'runtime QA must expose floating damage-number activity');
assert(gameCanvasSource.includes('for (const popup of state.damageNumbers)') && gameCanvasSource.includes("popup.kind === 'armor' ? '#8ee8ff'"), 'Canvas fallback is missing readable floating damage numbers');

const desktop = new AdaptiveRenderBudget(false);
let snapshot = desktop.sample(16.7, 1);
assert(snapshot.tier === 0, 'desktop should start at full quality');
assert(snapshot.tierName === 'high', 'desktop full quality should expose the high tier name');
assert(snapshot.shadows, 'desktop full quality should keep shadows');
assert(snapshot.shadowMapSize === 1024, 'high tier should use the 1024 shadow budget');
assert(snapshot.vfxDensity === 1, 'high tier should keep full VFX density');
assert(snapshot.transparencyScale === 1, 'high tier should keep full transparency budget');
assert(snapshot.reflectionScale === 1 && snapshot.secondaryEffectScale === 1, 'high tier should keep full reflection and secondary presentation');
assert(snapshot.gameplayCueScale === 1, 'gameplay-critical cues must stay full strength at every render tier');
assert(snapshot.textureAnisotropy === 4 && snapshot.assetCacheCompressedByteBudget === 64 * 1024 * 1024, 'high tier should keep the flagship texture/cache budget');
assert(Math.abs(snapshot.targetFrameMs - 1000 / 60) < 0.01, 'render profiling should target a 60 fps frame budget');
assert(snapshot.framePressure === 'healthy', 'a 16.7 ms frame should report healthy frame pressure');

for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier >= 1, 'sustained slow frames should lower render quality');
for (let index = 0; index < 90; index += 1) snapshot = desktop.sample(30, 1);
assert(snapshot.tier === 2, 'continued slow frames should reach performance tier');
assert(snapshot.tierName === 'performance', 'slow-frame adaptation should expose the performance tier name');
assert(!snapshot.shadows, 'performance tier should disable dynamic shadows');
assert(snapshot.shadowMapSize === 256, 'performance tier should cap shadow-map allocation at 256');
assert(snapshot.pixelRatioScale < 0.75, 'performance tier should reduce pixel density');
assert(snapshot.vfxDensity === 0.45, 'performance tier should reduce secondary VFX density');
assert(snapshot.transparencyScale === 0.4, 'performance tier should reduce transparency-heavy effects');
assert(snapshot.reflectionScale === 0.38 && snapshot.secondaryEffectScale === 0.42, 'performance tier should shed reflections and secondary effects before critical cues');
assert(snapshot.gameplayCueScale === 1, 'performance tier must not scale gameplay-critical cue strength');
assert(snapshot.textureAnisotropy === 1 && snapshot.assetCacheCompressedByteBudget === 24 * 1024 * 1024, 'performance tier should enforce the minimum texture/cache budget');
assert(snapshot.framePressure === 'over' && snapshot.frameHeadroomMs < 0, 'sustained 30 ms frames must expose over-budget pressure and negative headroom');

for (let index = 0; index < 700; index += 1) snapshot = desktop.sample(16.4, 1);
assert(snapshot.tier === 0, 'sustained healthy frames should recover desktop quality');

const coarse = new AdaptiveRenderBudget(true);
snapshot = coarse.sample(16.7, 1);
assert(snapshot.tier === 1, 'coarse pointers should start at balanced tier');
assert(snapshot.tierName === 'balanced', 'coarse/mobile should expose balanced tier at startup');
assert(snapshot.shadowMapSize === 512, 'balanced tier should cap shadows at 512');
assert(snapshot.vfxDensity === 0.72, 'balanced tier should reduce secondary VFX density');
assert(snapshot.transparencyScale === 0.68, 'balanced tier should reduce transparency cost');

const reducedEffects = new AdaptiveRenderBudget(false);
snapshot = reducedEffects.sample(16.7, 0.45);
assert(snapshot.tier === 2, 'reduced effect intensity should enforce performance visual tier');
assert(!snapshot.shadows, 'reduced effect intensity should disable dynamic shadows');
assert(snapshot.vfxDensity === 0.45 && snapshot.transparencyScale === 0.4, 'reduced effects should enforce the low-cost VFX/transparency budgets');

assert(rendererSource.includes('budget.shadowMapSize'), 'renderer must apply the tier shadow-map budget');
assert(rendererSource.includes('budget.vfxDensity'), 'renderer must apply the tier VFX density budget');
assert(rendererSource.includes('budget.transparencyScale'), 'renderer must apply the tier transparency budget');
assert(rendererSource.includes('configureGraphicsAssetRuntimeBudget({'), 'renderer must apply the tier texture/material cache budget');
assert(rendererSource.includes('budget.reflectionScale') && rendererSource.includes('budget.secondaryEffectScale'), 'renderer must apply reflection and secondary-effect priority budgets');
assert(rendererSource.includes("dataset.effectPriority = `critical:hazards+telegraphs+class-cues@1.00"), 'runtime QA must expose preserved critical cues ahead of secondary effects');
assert(graphicsAssetsSource.includes('enforceGraphicsAssetCacheBudget') && graphicsAssetsSource.includes('entry.activeInstances === 0'), 'graphics runtime must evict only idle cached assets under memory pressure');
assert(graphicsAssetsSource.includes('materials.forEach(material => collectMaterialTextures(material, textures))') && graphicsAssetsSource.includes('materials.forEach(material => material.dispose())'), 'graphics cache eviction must reclaim shared material/texture resources');
assert(rendererSource.includes('dataset.renderTier = budget.tierName'), 'runtime QA must expose the active render tier');
assert(rendererSource.includes('dataset.renderFrameMs = budget.smoothedFrameMs.toFixed(2)'), 'runtime QA must expose smoothed frame cost');
assert(rendererSource.includes('dataset.renderFrameBudget'), 'runtime QA must expose 60 fps frame-budget headroom/pressure');
assert(rendererSource.includes('tier-${budget.tier}'), 'environment signature must react to render-tier transitions so authored LOD can change');
assert(rendererSource.includes('loadAuthoredRefineryEnvironment(state, world.w, world.h, budget.detailScale)'), 'refinery authored LOD selection must follow the active detail tier');

const fullSpinProfile = spinHabitatRenderProfile(1, false);
assert(fullSpinProfile.name === 'full' && fullSpinProfile.assetDetailScale >= 0.9, 'desktop Spin Habitat should keep the full authored environment profile');
assert(fullSpinProfile.ringInstances === 6 && fullSpinProfile.serviceInstances === 4 && fullSpinProfile.movingShadows, 'full Spin Habitat profile should preserve all authored placements and rotor shadows');

const mobileSpinProfile = spinHabitatRenderProfile(0.78, true);
assert(mobileSpinProfile.name === 'mobile' && mobileSpinProfile.assetDetailScale < 0.62, 'coarse/mobile Spin Habitat should force the LOD2 asset threshold');
assert(mobileSpinProfile.ringInstances === 4 && mobileSpinProfile.spokeInstances === 4 && mobileSpinProfile.serviceInstances === 2, 'mobile Spin Habitat should trim non-critical environment instances while preserving the four-spoke silhouette');
assert(!mobileSpinProfile.movingShadows && mobileSpinProfile.proceduralRingSegments === 40, 'mobile Spin Habitat should disable rotating shadow casters and reduce procedural ring tessellation');

const balancedSpinProfile = spinHabitatRenderProfile(0.78, false);
assert(balancedSpinProfile.name === 'balanced' && balancedSpinProfile.assetDetailScale === 0.78, 'desktop Balanced Spin Habitat should retain LOD1 assets while trimming scene cost');
assert(!balancedSpinProfile.movingShadows && balancedSpinProfile.ringInstances === 4 && balancedSpinProfile.serviceInstances === 2, 'desktop Balanced Spin Habitat should use the reduced rotating layout');

const performanceSpinProfile = spinHabitatRenderProfile(0.5, true);
assert(performanceSpinProfile.name === 'performance' && performanceSpinProfile.assetDetailScale === 0.5, 'Spin Habitat performance tier should remain on LOD2');
assert(!performanceSpinProfile.movingShadows && performanceSpinProfile.proceduralRingSegments === 32, 'Spin Habitat performance tier should use the lowest rotating geometry/shadow budget');

assert(rendererSource.includes('const profile = spinHabitatRenderProfile(detailScale, this.coarse)'), 'Spin Habitat authored environment must derive a dedicated mobile/performance profile');
assert(rendererSource.includes('selectGraphicsAssetSpec(SPIN_HABITAT_ASSET_FAMILIES[key], profile.assetDetailScale)'), 'Spin Habitat mobile profile must drive authored environment LOD selection');
assert(rendererSource.includes("dataset.environmentShadowCasters = profile.movingShadows ? 'rotor+axis' : 'axis-only'"), 'Spin Habitat runtime QA must expose the moving-shadow budget');
assert(rendererSource.includes('dataset.environmentInstanceBudget'), 'Spin Habitat runtime QA must expose its environment instance budget');
assert(rendererSource.includes('this.addLocationScenery(mission.location, world.w, world.h, palette, budget.detailScale)'), 'Spin Habitat procedural fallback must follow the adaptive detail tier');

const nominalSpin = spinHabitatArchitectureState(1);
const overspeedSpin = spinHabitatArchitectureState(1.2);
const reducedSpin = spinHabitatArchitectureState(0.42);
assert(nominalSpin.mode === 'nominal', 'Spin Habitat nominal gravity must report nominal rotation');
assert(overspeedSpin.mode === 'overspeed' && overspeedSpin.angularSpeed > nominalSpin.angularSpeed, 'Spin Habitat overspeed gravity must accelerate architecture rotation');
assert(reducedSpin.mode === 'reduced' && reducedSpin.angularSpeed < nominalSpin.angularSpeed, 'Spin Habitat reduced gravity must slow architecture rotation');
assert(rendererSource.includes('private syncSpinHabitatArchitecture(state: SimState, mission: Contract, budget: RenderBudgetSnapshot)'), 'Spin Habitat architecture must have a per-frame rotation/VFX sync');
assert(rendererSource.includes("dataset.environmentMotion = 'gravity-coupled-rigid-rotation'"), 'Spin Habitat runtime QA must expose its gravity-coupled rotation mode');

const nominalSpindown = spinHabitatSpindownState(0.42);
const emergencySpindown = spinHabitatSpindownState(0.05);
assert(!nominalSpindown.active && nominalSpindown.intensity === 0, 'Spin Habitat nominal transfer gravity must keep emergency spindown VFX idle');
assert(emergencySpindown.active && emergencySpindown.intensity > 0.95, 'Spin Habitat 0.05G emergency spindown must drive full visual intensity');
assert(rendererSource.includes("dataset.environmentSpindownSource = 'sector-B-transfer-gravity'"), 'Spin Habitat spindown VFX must derive from the actual transfer-gravity gameplay control');
assert(rendererSource.includes("dataset.environmentVfx = 'spindown-brake-arcs+axis-warning-pulse'"), 'Spin Habitat must expose its authored spindown VFX language for runtime QA');
assert(rendererSource.includes('const reducedSpindownDetail = this.coarse || budget.vfxDensity < 0.55'), 'Spin Habitat spindown VFX must reduce secondary arcs on mobile and under the performance VFX budget');

const nominalJovianStorm = jovianHarvesterStormState(
  [1, 0.88, 1],
  ['normal', 'normal', 'normal'],
  false,
  false,
  false,
);
const ventingJovianStorm = jovianHarvesterStormState(
  [1, 0.42, 0.91],
  ['normal', 'decompressing', 'leaking'],
  true,
  true,
  true,
);
assert(nominalJovianStorm.mode === 'charged', 'Jovian unequal-pressure decks must expose a visible charged baseline storm state');
assert(nominalJovianStorm.pressureSpread > 0.1 && nominalJovianStorm.pressureShear > 0, 'Jovian baseline pressure inequality must drive pressure-shear readability');
assert(ventingJovianStorm.mode === 'venting' && ventingJovianStorm.activeBreach, 'Jovian service-breach activation must switch the storm language into venting mode');
assert(ventingJovianStorm.intensity > nominalJovianStorm.intensity && ventingJovianStorm.pressureShear > nominalJovianStorm.pressureShear, 'Jovian venting must intensify both storm charge and pressure shear');
assert(rendererSource.includes('private syncJovianHarvesterVisualLanguage(state: SimState, mission: Contract, budget: RenderBudgetSnapshot)'), 'Jovian P2.12 must have a per-frame gameplay-driven storm/pressure visual sync');
assert(rendererSource.includes("dataset.environmentStormSource = 'live-sector-pressure+service-breach+contract-conditions'"), 'Jovian P2.12 runtime visual language must derive from live gameplay pressure and breach state');
assert(rendererSource.includes("dataset.environmentStormDetail = reducedStormDetail ? '2-sweeps+2-bands+relief-pulse' : '4-sweeps+3-bands+relief-pulse'"), 'Jovian P2.12 must reduce secondary storm/pressure geometry for coarse pointers and the performance VFX budget');
assert(rendererSource.includes("const atmosphereDensity = this.coarse || budget.vfxDensity < 0.55"), 'Jovian P2.15 atmosphere must enter its reduced profile on coarse/mobile rendering or the Performance VFX tier');
assert(rendererSource.includes("dataset.environmentAmbientMotion = 'crosswind-drift+pressure-breath+charged-drift'"), 'Jovian P2.15 atmosphere must keep a persistent low-frequency motion language distinct from reactive storm VFX');
assert(rendererSource.includes("dataset.environmentAmbientDetail = `${visibleClouds}-clouds+${visibleMotes}-motes+spine-haze`"), 'Jovian P2.15 runtime QA must expose adaptive cloud and particulate density');

const fullJovianProfile = jovianHarvesterRenderProfile(1, false);
assert(fullJovianProfile.name === 'full' && fullJovianProfile.assetDetailScale >= 0.9, 'desktop Jovian Harvester should keep the full authored environment profile');
assert(fullJovianProfile.deckInstances === 6 && fullJovianProfile.towerInstances === 5 && fullJovianProfile.bridgeInstances === 4 && fullJovianProfile.ballastInstances === 4, 'full Jovian profile should preserve all 19 authored structural placements');
assert(fullJovianProfile.structureShadows, 'full Jovian profile should preserve structural shadow casters');

const mobileJovianProfile = jovianHarvesterRenderProfile(0.78, true);
assert(mobileJovianProfile.name === 'mobile' && mobileJovianProfile.assetDetailScale < 0.62, 'coarse/mobile Jovian Harvester should force the LOD2 asset threshold');
assert(mobileJovianProfile.deckInstances === 4 && mobileJovianProfile.towerInstances === 5 && mobileJovianProfile.bridgeInstances === 2 && mobileJovianProfile.ballastInstances === 2, 'mobile Jovian profile should trim to 13 structural placements while preserving the five-tower landmark');
assert(!mobileJovianProfile.structureShadows, 'mobile Jovian profile should disable structural shadow casters');

const balancedJovianProfile = jovianHarvesterRenderProfile(0.78, false);
assert(balancedJovianProfile.name === 'balanced' && balancedJovianProfile.assetDetailScale === 0.78, 'desktop Balanced Jovian Harvester should retain LOD1 assets');
assert(balancedJovianProfile.deckInstances === 4 && balancedJovianProfile.bridgeInstances === 2 && balancedJovianProfile.ballastInstances === 2, 'desktop Balanced Jovian Harvester should trim non-landmark structures');
assert(!balancedJovianProfile.structureShadows, 'desktop Balanced Jovian Harvester should drop structural shadows');

const performanceJovianProfile = jovianHarvesterRenderProfile(0.5, true);
assert(performanceJovianProfile.name === 'performance' && performanceJovianProfile.assetDetailScale === 0.5, 'Jovian Harvester performance tier should remain on LOD2');
assert(!performanceJovianProfile.structureShadows && performanceJovianProfile.towerInstances === 5, 'Jovian performance tier should preserve the landmark spine while removing structural shadows');

assert(rendererSource.includes('const profile = jovianHarvesterRenderProfile(detailScale, this.coarse)'), 'Jovian authored environment must derive a dedicated mobile/performance profile');
assert(rendererSource.includes('selectGraphicsAssetSpec(JOVIAN_HARVESTER_ASSET_FAMILIES[key], profile.assetDetailScale)'), 'Jovian mobile profile must drive authored environment LOD selection');
assert(rendererSource.includes("dataset.environmentInstanceBudget = `deck:${deckPlacements.length}+tower:${towerPlacements.length}+bridge:${bridgePlacements.length}+ballast:${ballastPlacements.length}`"), 'Jovian runtime QA must expose its authored instance budget');
assert(rendererSource.includes("dataset.environmentShadowCasters = profile.structureShadows ? 'jovian-structures' : 'off'"), 'Jovian runtime QA must expose its structural shadow budget');
assert(rendererSource.includes('tower.castShadow = jovianProfile.structureShadows') && rendererSource.includes('guide.castShadow = jovianProfile.structureShadows'), 'Jovian procedural fallback must follow the dedicated mobile shadow budget');

const fullSolarProfile = solarYardRenderProfile(1, false);
assert(fullSolarProfile.name === 'full' && fullSolarProfile.assetDetailScale >= 0.9, 'desktop Solar Yard should keep the full authored environment profile');
assert(fullSolarProfile.ceramicDeckInstances === 6 && fullSolarProfile.trussFrameInstances === 5 && fullSolarProfile.radiatorTowerInstances === 4, 'full Solar Yard profile should preserve structural placement density');
assert(fullSolarProfile.sinterForgeInstances === 2 && fullSolarProfile.printerSpindleInstances === 3 && fullSolarProfile.feedstockPressInstances === 2, 'full Solar Yard profile should preserve fabrication machinery density');
assert(fullSolarProfile.transferRailInstances === 3 && fullSolarProfile.gantryCraneInstances === 2 && fullSolarProfile.environmentShadows, 'full Solar Yard profile should preserve transport motion and structural shadows');

const mobileSolarProfile = solarYardRenderProfile(0.78, true);
assert(mobileSolarProfile.name === 'mobile' && mobileSolarProfile.assetDetailScale < 0.62, 'coarse/mobile Solar Yard should force the LOD2 asset threshold');
assert(mobileSolarProfile.ceramicDeckInstances === 4 && mobileSolarProfile.trussFrameInstances === 3 && mobileSolarProfile.radiatorTowerInstances === 2, 'mobile Solar Yard should trim secondary structural instances');
assert(mobileSolarProfile.reflectorPylonInstances === 3, 'mobile Solar Yard must preserve the three-pylon gold landmark row');
assert(mobileSolarProfile.sinterForgeInstances === 1 && mobileSolarProfile.printerSpindleInstances === 2 && mobileSolarProfile.feedstockPressInstances === 1, 'mobile Solar Yard should reduce fabrication machinery while preserving all machine families');
assert(mobileSolarProfile.transferRailInstances === 2 && mobileSolarProfile.gantryCraneInstances === 2, 'mobile Solar Yard should reduce rail density while preserving paired moving gantries');
assert(mobileSolarProfile.sunPatchInstances === 2 && mobileSolarProfile.shadePatchInstances === 2 && !mobileSolarProfile.environmentShadows, 'mobile Solar Yard should reduce overlay density and disable structural shadow casters');

const balancedSolarProfile = solarYardRenderProfile(0.78, false);
assert(balancedSolarProfile.name === 'balanced' && balancedSolarProfile.assetDetailScale === 0.78, 'desktop Balanced Solar Yard should retain LOD1 while trimming scene cost');
assert(!balancedSolarProfile.environmentShadows && balancedSolarProfile.transferRailInstances === 2, 'desktop Balanced Solar Yard should drop structural shadows and one secondary rail');

const performanceSolarProfile = solarYardRenderProfile(0.5, true);
assert(performanceSolarProfile.name === 'performance' && performanceSolarProfile.assetDetailScale === 0.5, 'Solar Yard performance tier should remain on LOD2');
assert(performanceSolarProfile.gantryCraneInstances === 1 && performanceSolarProfile.sunPatchInstances === 1 && performanceSolarProfile.shadePatchInstances === 1, 'Solar Yard performance tier should collapse secondary motion and overlay density');
assert(performanceSolarProfile.fallbackPanelInstances === 3 && !performanceSolarProfile.environmentShadows, 'Solar Yard performance fallback should use the smallest panel/shadow budget');

assert(rendererSource.includes('const profile = solarYardRenderProfile(detailScale, this.coarse)'), 'Solar Yard authored environment must derive a dedicated adaptive profile');
assert(rendererSource.includes('selectGraphicsAssetSpec(SOLAR_YARD_ASSET_FAMILIES[key], assetDetailScale)'), 'Solar Yard adaptive profile must drive authored environment LOD selection');
assert(rendererSource.includes("dataset.environmentShadowCasters = profile.environmentShadows ? 'solar-yard-structures+gameplay-actors' : 'gameplay-actors-only'"), 'Solar Yard runtime QA must expose structural shadow trimming');
assert(rendererSource.includes('dataset.environmentInstanceBudget = `deck:${ceramicDeckPlacements.length}+truss:${trussFramePlacements.length}+radiator:${radiatorTowerPlacements.length}'), 'Solar Yard runtime QA must expose the authored instance budget');
assert(rendererSource.includes('shadePlacements.slice(0, solarYardProfile.shadePatchInstances)') && rendererSource.includes('sunPlacements.slice(0, solarYardProfile.sunPatchInstances)'), 'Solar Yard procedural fallback must follow the adaptive overlay density');
const fullPerseidProfile = perseidRenderProfile(1, false);
assert(fullPerseidProfile.name === 'full' && fullPerseidProfile.ribPairs === 7 && fullPerseidProfile.guideLights === 10, 'desktop Perseid must preserve the complete generation-ship continuity frame.');
assert(fullPerseidProfile.stageProps === 7 && fullPerseidProfile.castStructuralShadows, 'desktop Perseid must keep full stage dressing and structural shadows.');

const mobilePerseidProfile = perseidRenderProfile(0.72, true);
assert(mobilePerseidProfile.name === 'mobile' && mobilePerseidProfile.ribPairs === 4 && mobilePerseidProfile.guideLights === 6, 'mobile Perseid must trim repeated ship ribs and guide lights.');
assert(mobilePerseidProfile.stageProps === 4 && !mobilePerseidProfile.castStructuralShadows, 'mobile Perseid must preserve stage identity while removing structural shadow cost.');

const performancePerseidProfile = perseidRenderProfile(0.5, true);
assert(performancePerseidProfile.name === 'performance' && performancePerseidProfile.ribPairs === 3 && performancePerseidProfile.stageProps === 3, 'Perseid Performance mode must retain the minimum recognizable ship silhouette.');
assert(!performancePerseidProfile.castStructuralShadows, 'Perseid Performance mode must not restore structural shadows.');
assert(rendererSource.includes('this.addPerseidCapstoneScenery(mission, world.w, world.h, budget.detailScale)'), 'Perseid continuity scenery must layer over every reused stage biome.');
assert(rendererSource.includes("dataset.megastructureIdentity = 'generation-ship:perseid'"), 'Perseid runtime QA must expose the megastructure identity.');
assert(rendererSource.includes("dataset.megastructureContinuity = 'keel-spine+pressure-ribs+green-transit-datum'"), 'Perseid runtime QA must expose its cross-stage continuity language.');
assert(rendererSource.includes('dataset.megastructureStageKit = stage.kit.join'), 'Perseid runtime QA must expose the active stage-specific visual kit.');
assert(rendererSource.includes('dataset.megastructurePerformanceProfile'), 'Perseid runtime QA must expose its adaptive mobile performance profile.');

const fullK91Profile = k91RenderProfile(1, false);
assert(fullK91Profile.name === 'full' && fullK91Profile.railPairs === 6 && fullK91Profile.datumLights === 10, 'desktop K-91 must preserve the complete counterweight load frame.');
assert(fullK91Profile.stageProps === 8 && fullK91Profile.castStructuralShadows, 'desktop K-91 must keep full stage dressing and structural shadows.');

const mobileK91Profile = k91RenderProfile(0.72, true);
assert(mobileK91Profile.name === 'mobile' && mobileK91Profile.railPairs === 4 && mobileK91Profile.datumLights === 6, 'mobile K-91 must trim repeated mass rails and inertial datum lights.');
assert(mobileK91Profile.stageProps === 5 && !mobileK91Profile.castStructuralShadows, 'mobile K-91 must preserve stage identity while removing structural shadow cost.');

const performanceK91Profile = k91RenderProfile(0.5, true);
assert(performanceK91Profile.name === 'performance' && performanceK91Profile.railPairs === 3 && performanceK91Profile.stageProps === 3, 'K-91 Performance mode must retain the minimum recognizable counterweight silhouette.');
assert(!performanceK91Profile.castStructuralShadows, 'K-91 Performance mode must not restore structural shadows.');
assert(rendererSource.includes('this.addK91CapstoneScenery(mission, world.w, world.h, budget.detailScale)'), 'K-91 continuity scenery must layer over every reused stage biome.');
assert(rendererSource.includes("dataset.megastructureIdentity = 'counterweight:k-91'"), 'K-91 runtime QA must expose the megastructure identity.');
assert(rendererSource.includes("dataset.megastructureContinuity = 'load-spine+countermass-rails+amber-inertial-datum'"), 'K-91 runtime QA must expose its cross-stage continuity language.');
assert(rendererSource.includes('dataset.megastructureStageKit = stage.kit.join'), 'K-91 runtime QA must expose the active stage-specific visual kit.');
assert(rendererSource.includes('rails-${profile.railPairs}:guides-${profile.datumLights}'), 'K-91 runtime QA must expose its adaptive mobile performance profile.');

const fullOrphelineProfile = orphelineRenderProfile(1, false);
assert(fullOrphelineProfile.name === 'full' && fullOrphelineProfile.rockRibs === 7 && fullOrphelineProfile.utilityLights === 10, 'desktop Orpheline must preserve the complete hidden-habitat continuity frame.');
assert(fullOrphelineProfile.stageProps === 8 && fullOrphelineProfile.castStructuralShadows, 'desktop Orpheline must keep full improvised habitat dressing and structural shadows.');

const mobileOrphelineProfile = orphelineRenderProfile(0.72, true);
assert(mobileOrphelineProfile.name === 'mobile' && mobileOrphelineProfile.rockRibs === 4 && mobileOrphelineProfile.utilityLights === 6, 'mobile Orpheline must trim repeated rock ribs and utility markers.');
assert(mobileOrphelineProfile.stageProps === 5 && !mobileOrphelineProfile.castStructuralShadows, 'mobile Orpheline must preserve stage identity while removing structural shadow cost.');

const performanceOrphelineProfile = orphelineRenderProfile(0.5, true);
assert(performanceOrphelineProfile.name === 'performance' && performanceOrphelineProfile.rockRibs === 3 && performanceOrphelineProfile.stageProps === 3, 'Orpheline Performance mode must retain the minimum recognizable hidden-habitat silhouette.');
assert(!performanceOrphelineProfile.castStructuralShadows, 'Orpheline Performance mode must not restore structural shadows.');
assert(rendererSource.includes('this.addOrphelineCapstoneScenery(mission, world.w, world.h, budget.detailScale)'), 'Orpheline continuity scenery must layer over every reused stage biome.');
assert(rendererSource.includes("dataset.megastructureIdentity = 'hidden-habitat:orpheline'"), 'Orpheline runtime QA must expose the megastructure identity.');
assert(rendererSource.includes("dataset.megastructureContinuity = 'rock-cut-spine+violet-utility-trunk+white-occupancy-marks'"), 'Orpheline runtime QA must expose its cross-stage continuity language.');
assert(rendererSource.includes('ribs-${profile.rockRibs}:guides-${profile.utilityLights}'), 'Orpheline runtime QA must expose its adaptive mobile performance profile.');

const fullHecateProfile = hecateRenderProfile(1, false);
assert(fullHecateProfile.name === 'full' && fullHecateProfile.trussPairs === 7 && fullHecateProfile.cutterDatums === 10, 'desktop Hecate must preserve the complete shipbreaking-yard continuity frame.');
assert(fullHecateProfile.stageProps === 8 && fullHecateProfile.castStructuralShadows, 'desktop Hecate must keep full clamp/cutter dressing and structural shadows.');

const mobileHecateProfile = hecateRenderProfile(0.72, true);
assert(mobileHecateProfile.name === 'mobile' && mobileHecateProfile.trussPairs === 4 && mobileHecateProfile.cutterDatums === 6, 'mobile Hecate must trim repeated salvage trusses and cutter datum markers.');
assert(mobileHecateProfile.stageProps === 5 && !mobileHecateProfile.castStructuralShadows, 'mobile Hecate must preserve stage identity while removing structural shadow cost.');

const performanceHecateProfile = hecateRenderProfile(0.5, true);
assert(performanceHecateProfile.name === 'performance' && performanceHecateProfile.trussPairs === 3 && performanceHecateProfile.stageProps === 3, 'Hecate Performance mode must retain the minimum recognizable shipbreaking-yard silhouette.');
assert(!performanceHecateProfile.castStructuralShadows, 'Hecate Performance mode must not restore structural shadows.');
assert(rendererSource.includes('this.addHecateCapstoneScenery(mission, world.w, world.h, budget.detailScale)'), 'Hecate continuity scenery must layer over every reused stage biome.');
assert(rendererSource.includes("dataset.megastructureIdentity = 'shipbreaking-yard:hecate'"), 'Hecate runtime QA must expose the megastructure identity.');
assert(rendererSource.includes("dataset.megastructureContinuity = 'salvage-truss-spine+red-clamp-arms+yellow-cutter-datum'"), 'Hecate runtime QA must expose its cross-stage continuity language.');
assert(rendererSource.includes('trusses-${profile.trussPairs}:guides-${profile.cutterDatums}'), 'Hecate runtime QA must expose its adaptive mobile performance profile.');

const megastructureBatchLabels = [
  'perseid-ribs',
  'perseid-guides',
  'k91-rails',
  'k91-datum',
  'orpheline-rock-ribs',
  'orpheline-patched-ribs',
  'orpheline-occupancy',
  'orpheline-utility',
  'hecate-trusses',
  'hecate-hulls',
  'hecate-clamps',
  'hecate-clamp-datum',
  'hecate-cutter-datum',
];
assert(rendererSource.includes('private addMegastructureInstanceBatch('), 'P4.18 must share one instanced continuity batching path across all four megastructures.');
assert(rendererSource.includes('new THREE.InstancedMesh(geometry, material, placements.length)'), 'P4.18 continuity batching must reduce repeated capstone meshes to instanced draw calls.');
assert(megastructureBatchLabels.every(label => rendererSource.includes(`'${label}'`)), 'P4.18 must batch every repeated Perseid, K-91, Orpheline, and Hecate continuity motif.');
assert(rendererSource.includes('mesh.receiveShadow = castShadow'), 'P4.18 batched capstone scenery must drop shadow-receiver cost when the mobile/performance profile disables structural shadows.');
assert((rendererSource.match(/dataset\.megastructureBatching = 'instanced-continuity'/g) ?? []).length === 4, 'all four megastructures must expose instanced-continuity runtime telemetry.');
assert((rendererSource.match(/dataset\.megastructureContinuityDrawCalls/g) ?? []).length === 4, 'all four megastructures must expose their continuity draw-call budget.');
assert(rendererSource.includes("dataset.megastructureContinuityDrawCalls = '2'") && rendererSource.includes("dataset.megastructureContinuityDrawCalls = '4'") && rendererSource.includes("dataset.megastructureContinuityDrawCalls = '5'"), 'P4.18 draw-call telemetry must preserve the 2/4/5 batch ceilings used by the capstone families.');

const mobilePerseidContinuityInstances = mobilePerseidProfile.ribPairs * 2 + mobilePerseidProfile.guideLights;
const mobileK91ContinuityInstances = mobileK91Profile.railPairs * 2 + mobileK91Profile.datumLights;
const mobileOrphelineContinuityInstances = mobileOrphelineProfile.rockRibs * 2 + mobileOrphelineProfile.utilityLights;
const mobileHecateContinuityInstances = mobileHecateProfile.trussPairs * 2 + Math.ceil(mobileHecateProfile.trussPairs / 2) * 2 + mobileHecateProfile.cutterDatums;
assert(mobilePerseidContinuityInstances === 14 && mobileK91ContinuityInstances === 14, 'mobile Perseid and K-91 continuity silhouettes must retain fourteen visible repeated instances while batching them into two draws.');
assert(mobileOrphelineContinuityInstances === 14 && mobileHecateContinuityInstances === 18, 'mobile Orpheline and Hecate must retain recognizable continuity density while batching repeated geometry.');

const sustainedMobile = new AdaptiveRenderBudget(true);
let sustainedSnapshot = sustainedMobile.sample(16.7, 1);
for (let index = 0; index < 60 * 10; index += 1) sustainedSnapshot = sustainedMobile.sample(18.2, 1);
assert(sustainedSnapshot.tier === 1, 'ten simulated minutes of stable mobile frame pacing should remain Balanced without quality thrash');
for (let index = 0; index < 120; index += 1) sustainedSnapshot = sustainedMobile.sample(29, 1);
assert(sustainedSnapshot.tier === 2, 'sustained thermal-like slow frames should degrade mobile rendering to Performance');
for (let index = 0; index < 320; index += 1) sustainedSnapshot = sustainedMobile.sample(16.4, 1);
assert(sustainedSnapshot.tier === 1, 'recovered mobile frame pacing should climb only to the coarse-pointer Balanced baseline');

const worstCase = new AdaptiveRenderBudget(true);
let worstSnapshot = worstCase.sample(16.7, 1);
for (let index = 0; index < 180; index += 1) worstSnapshot = worstCase.sample(45, 1);
assert(worstSnapshot.tier === 2, 'worst-case rendering pressure must settle on the Performance tier');
assert(worstSnapshot.pixelRatioScale <= 0.68 && worstSnapshot.detailScale <= 0.5, 'worst-case rendering must reduce raster and authored detail cost together');
assert(worstSnapshot.assetCacheCompressedByteBudget <= 24 * 1024 * 1024 && worstSnapshot.textureAnisotropy === 1, 'worst-case rendering must clamp texture/material residency and sampling cost');
assert(!worstSnapshot.shadows && worstSnapshot.reflectionScale < 0.5 && worstSnapshot.secondaryEffectScale < 0.5, 'worst-case rendering must shed shadows, reflections, and secondary effects');
assert(worstSnapshot.gameplayCueScale === 1, 'worst-case rendering must preserve gameplay-critical information');
assert(rendererSource.includes("telegraph.visible = enemy.telegraph > 0") && rendererSource.includes("dataset.hazardReadability = 'shape-coded+floor-bound+quality-safe'"), 'critical enemy telegraphs and hazard readability must remain independent of secondary render scaling');

console.log('RENDER_PERFORMANCE_PASS sustained=stable+degrade+recover worst-case=p16-b');
