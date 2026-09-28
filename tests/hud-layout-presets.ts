import { readFileSync } from 'node:fs';
import {
  createDefaultProfile,
  hudLayoutPresetPatch,
  normalizeStoredProfile,
  setProfileSettings,
  type HudLayoutPreset,
} from '../src/game/meta';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function close(actual: number, expected: number, tolerance = 1e-6) {
  return Math.abs(actual - expected) <= tolerance;
}
function read(path: string) { return readFileSync(path, 'utf8'); }

const defaults = createDefaultProfile();
assert(defaults.settings.hudLayoutPreset === 'standard', 'P19-F default profile must use the Standard HUD layout.');
assert(defaults.settings.movementClusterInset === 0 && defaults.settings.movementClusterLift === 0 && defaults.settings.movementClusterScale === 1, 'P19-F Standard movement defaults drifted.');
assert(defaults.settings.actionClusterInset === 0 && defaults.settings.actionClusterLift === 0 && defaults.settings.actionClusterScale === 1, 'P19-F Standard action defaults drifted.');

const presets: Array<[HudLayoutPreset, number]> = [['standard', 1], ['large', 1.08], ['left-handed', 1]];
for (const [preset, expectedScale] of presets) {
  const patch = hudLayoutPresetPatch(preset);
  assert(patch.hudLayoutPreset === preset, `P19-F ${preset} preset id drifted.`);
  assert(close(patch.movementClusterScale, expectedScale) && close(patch.actionClusterScale, expectedScale), `P19-F ${preset} preset scale drifted.`);
  assert(patch.movementClusterInset === 0 && patch.movementClusterLift === 0 && patch.actionClusterInset === 0 && patch.actionClusterLift === 0, `P19-F ${preset} preset must reset cluster offsets.`);
}

const legacy: any = JSON.parse(JSON.stringify(defaults));
for (const key of ['hudLayoutPreset', 'movementClusterInset', 'movementClusterLift', 'movementClusterScale', 'actionClusterInset', 'actionClusterLift', 'actionClusterScale']) delete legacy.settings[key];
const normalizedLegacy = normalizeStoredProfile(legacy);
assert(normalizedLegacy.settings.hudLayoutPreset === 'standard', 'P19-F legacy profile did not normalize to Standard.');
assert(close(normalizedLegacy.settings.movementClusterScale, 1) && close(normalizedLegacy.settings.actionClusterScale, 1), 'P19-F legacy profile did not restore safe scale defaults.');

const malformed: any = JSON.parse(JSON.stringify(defaults));
malformed.settings = {
  ...malformed.settings,
  hudLayoutPreset: 'oversized',
  movementClusterInset: -5,
  movementClusterLift: 4,
  movementClusterScale: 8,
  actionClusterInset: 10,
  actionClusterLift: -2,
  actionClusterScale: 0.1,
};
const normalizedMalformed = normalizeStoredProfile(malformed);
assert(normalizedMalformed.settings.hudLayoutPreset === 'standard', 'P19-F invalid preset must fall back to Standard.');
assert(normalizedMalformed.settings.movementClusterInset === 0 && normalizedMalformed.settings.movementClusterLift === 1 && close(normalizedMalformed.settings.movementClusterScale, 1.08), 'P19-F movement layout bounds are not enforced.');
assert(normalizedMalformed.settings.actionClusterInset === 1 && normalizedMalformed.settings.actionClusterLift === 0 && close(normalizedMalformed.settings.actionClusterScale, 0.9), 'P19-F action layout bounds are not enforced.');

const customized = setProfileSettings(defaults, {
  ...hudLayoutPresetPatch('left-handed'),
  movementClusterInset: 0.35,
  movementClusterLift: 0.4,
  movementClusterScale: 1.04,
  actionClusterInset: 0.3,
  actionClusterLift: 0.25,
  actionClusterScale: 0.96,
});
assert(customized.settings.hudLayoutPreset === 'left-handed', 'P19-F customized layout must preserve its base preset.');
assert(close(customized.settings.movementClusterInset, 0.35) && close(customized.settings.movementClusterLift, 0.4) && close(customized.settings.movementClusterScale, 1.04), 'P19-F movement customization failed.');
assert(close(customized.settings.actionClusterInset, 0.3) && close(customized.settings.actionClusterLift, 0.25) && close(customized.settings.actionClusterScale, 0.96), 'P19-F action customization failed.');

const reset = setProfileSettings(customized, hudLayoutPresetPatch('left-handed'));
assert(reset.settings.hudLayoutPreset === 'left-handed' && reset.settings.movementClusterInset === 0 && reset.settings.actionClusterInset === 0 && reset.settings.movementClusterScale === 1 && reset.settings.actionClusterScale === 1, 'P19-F preset reset must clear custom offsets/scales.');

const interfaceLarge = setProfileSettings(customized, { interfaceSize: 'large' });
assert(interfaceLarge.settings.interfaceSize === 'large', 'P20-A Interface Size did not persist through profile settings.');
assert(interfaceLarge.settings.hudLayoutPreset === customized.settings.hudLayoutPreset
  && close(interfaceLarge.settings.movementClusterInset, customized.settings.movementClusterInset)
  && close(interfaceLarge.settings.movementClusterLift, customized.settings.movementClusterLift)
  && close(interfaceLarge.settings.movementClusterScale, customized.settings.movementClusterScale)
  && close(interfaceLarge.settings.actionClusterInset, customized.settings.actionClusterInset)
  && close(interfaceLarge.settings.actionClusterLift, customized.settings.actionClusterLift)
  && close(interfaceLarge.settings.actionClusterScale, customized.settings.actionClusterScale),
'P20-A Interface Size must not mutate combat layout geometry settings.');

const legacyInterface: any = JSON.parse(JSON.stringify(defaults));
delete legacyInterface.settings.interfaceSize;
assert(normalizeStoredProfile(legacyInterface).settings.interfaceSize === 'default', 'P20-A legacy profiles must restore Default Interface Size.');

const malformedInterface: any = JSON.parse(JSON.stringify(defaults));
malformedInterface.settings.interfaceSize = 'giant';
assert(normalizeStoredProfile(malformedInterface).settings.interfaceSize === 'default', 'P20-A invalid Interface Size must normalize to Default.');

const combat = read('src/components/GameCanvas.tsx');
const layoutCss = read('src/combatHudLayout.css');
const combatGlanceCss = read('src/combatHudGlance.css');
const browserSmoke = read('scripts/browser-runtime-smoke.mjs');
const armory = read('src/components/Armory.tsx');
const guide = read('src/game/guideContent.ts');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

const p22VisualScaleMatch = layoutCss.match(/--iv-combat-control-visual-scale:\s*([0-9.]+)/);
const p22ActiveScaleMatch = layoutCss.match(/--iv-combat-control-active-scale:\s*([0-9.]+)/);
const p22HitInsetMatch = layoutCss.match(/--iv-combat-control-hit-inset:\s*(-?[0-9.]+)%/);
assert(p22VisualScaleMatch && p22ActiveScaleMatch && p22HitInsetMatch, 'P22-B1 combat-control geometry tokens are missing.');
const p22VisualScale = Number(p22VisualScaleMatch[1]);
const p22ActiveScale = Number(p22ActiveScaleMatch[1]);
const p22HitInset = Math.abs(Number(p22HitInsetMatch[1])) / 100;
assert(close(p22VisualScale, 0.7), 'P22-B1 visible combat-control baseline must be exactly 70% of the prior geometry.');
assert(close(p22ActiveScale, 0.651), 'P22-B1 active feedback must preserve the existing 0.93 press response on the 70% visual baseline.');
assert(close(p22VisualScale * (1 + p22HitInset * 2), 1, 1e-5), 'P22-B1 transparent hit extension must restore the pre-reduction acquisition footprint.');
assert(layoutCss.includes('.movement-control-cluster .move-stick,\n  .action-control-cluster .touch-button'), 'P22-B1 must reduce only the movement joystick and action-cluster controls.');
assert(layoutCss.includes('.movement-control-cluster .move-stick::before,\n  .action-control-cluster .touch-button::before'), 'P22-B1 must preserve touch acquisition through invisible extended hit regions.');
assert(layoutCss.includes('transform: scale(var(--iv-combat-control-visual-scale))') && layoutCss.includes('transform-origin: center'), 'P22-B1 visible reduction must keep authored control centers stationary.');
const p22LandscapeBaseline = {
  joystick: [150, 150],
  fire: [104, 104],
  dodge: [82, 66],
  ability: [58, 58],
  act: [82, 48],
} as const;
for (const [name, [width, height]] of Object.entries(p22LandscapeBaseline)) {
  const visibleWidth = width * p22VisualScale;
  const visibleHeight = height * p22VisualScale;
  assert(close(visibleWidth / width, 0.7) && close(visibleHeight / height, 0.7), `P22-B1 ${name} visible geometry did not resolve to the 70% baseline.`);
}
assert(androidSmoke.includes('ANDROID_P22B1_CONTROL_GEOMETRY_PASS'), 'P22-B1 Android fast smoke must verify reduced visible geometry plus preserved hit acquisition.');

const p22b2Block = combatGlanceCss.split('/* P22-B2 //')[1]?.split('/* P22-B2 END */')[0] ?? '';
const p22b2ScaleMatch = p22b2Block.match(/--iv-combat-hud-visual-scale:\s*([0-9.]+)/);
assert(p22b2ScaleMatch && close(Number(p22b2ScaleMatch[1]), 0.7), 'P22-B2 informational HUD scale token must be exactly 70% of the prior baseline.');
const p22b2LinearMeasurements: Array<[string, RegExp, number]> = [
  ['vitals', /--iv-combat-hud-vitals-width:\s*([0-9.]+)rem/, 16.875],
  ['mission', /--iv-combat-hud-mission-width:\s*([0-9.]+)rem/, 22.5],
  ['target', /--iv-combat-hud-target-width:\s*([0-9.]+)rem/, 18.75],
  ['loot', /--iv-combat-hud-loot-width:\s*([0-9.]+)rem/, 17.8125],
  ['mega objective', /--iv-combat-hud-mega-width:\s*([0-9.]+)rem/, 22.5],
  ['post-clear objective', /--iv-combat-hud-post-clear-width:\s*([0-9.]+)rem/, 24.375],
  ['boss', /--iv-combat-hud-boss-width:\s*([0-9.]+)rem/, 26.875],
  ['class mechanic', /--iv-combat-hud-class-width:\s*([0-9.]+)rem/, 14.375],
  ['transient status', /--iv-combat-hud-transient-width:\s*([0-9.]+)rem/, 22.5],
  ['landscape vitals', /--iv-combat-hud-landscape-vitals-width:\s*([0-9.]+)rem/, 15.625],
  ['landscape mission', /--iv-combat-hud-landscape-mission-width:\s*([0-9.]+)rem/, 20.625],
  ['landscape target', /--iv-combat-hud-landscape-target-width:\s*([0-9.]+)rem/, 17.8125],
  ['landscape loot', /--iv-combat-hud-landscape-loot-width:\s*([0-9.]+)rem/, 16.875],
  ['landscape boss', /--iv-combat-hud-landscape-boss-width:\s*([0-9.]+)rem/, 24.375],
  ['landscape transient', /--iv-combat-hud-landscape-transient-width:\s*([0-9.]+)rem/, 20.625],
];
for (const [label, pattern, baseline] of p22b2LinearMeasurements) {
  const match = p22b2Block.match(pattern);
  assert(match, `P22-B2 missing deterministic ${label} footprint measurement.`);
  assert(close(Number(match[1]) / baseline, 0.7, 0.002), `P22-B2 ${label} footprint did not resolve to approximately 70% of its prior linear baseline.`);
}
for (const controlSelector of ['.move-stick', '.combat-dock', '.touch-button', '.fire-button', '.dodge-button', '.ability-button', '.interact-button']) {
  assert(!p22b2Block.includes(controlSelector), `P22-B2 informational HUD block must not alter combat-control geometry: ${controlSelector}`);
}
assert(combatGlanceCss.includes('font-size: max(12px') || combatGlanceCss.includes('font-size: 12px'), 'P22-B2 must retain the compact-phone secondary type floor.');
assert(androidSmoke.includes('ANDROID_P22B2_HUD_FOOTPRINT_PASS') && androidSmoke.includes('ANDROID_P22B2_OBJECTIVE_FLOW_PASS'), 'P22-B2 Android fast smoke must measure reduced live HUD geometry and the objective interaction flow.');
assert(browserSmoke.includes('BROWSER_P22B2_HUD_FOOTPRINT_PASS') && browserSmoke.includes('BROWSER_P22B2_TARGET_FLOW_PASS'), 'P22-B2 Browser E2E must measure reduced mobile HUD geometry and target-context presentation.');

for (const label of ['Combat layout preset', 'Movement cluster inset', 'Movement cluster height', 'Movement cluster size', 'Action cluster inset', 'Action cluster height', 'Action cluster size', 'Reset current preset']) {
  assert(armory.includes(label), `P19-F Settings is missing ${label}.`);
}
for (const option of ['Standard', 'Large', 'Left-Handed']) assert(armory.includes(option), `P19-F Settings is missing the ${option} preset.`);
assert(armory.includes('hudLayoutPresetPatch') && armory.includes('data-hud-layout-reset'), 'P19-F Settings must apply and reset canonical preset patches.');

assert(combat.includes('data-layout-preset={profileSettings.hudLayoutPreset}') && combat.includes('data-control-cluster="movement"') && combat.includes('data-control-cluster="action"'), 'P19-F touch controls must expose separate persisted movement/action clusters.');
assert(combat.includes("manualTargeting ? 'manual' : 'acquire'") && combat.includes('updateAssistedTarget(stateRef.current, profileSettings.aimAssist)'), 'P19-F must preserve manual aim and assisted-targeting semantics.');
assert(combat.includes("onPointerDown={event => beginStick('move', event)}") && combat.includes('className="touch-button fire-button"'), 'P19-F must keep pointer input on the visible transformed controls.');

assert(layoutCss.includes("env(safe-area-inset-left)") && layoutCss.includes("env(safe-area-inset-right)") && layoutCss.includes("env(safe-area-inset-bottom)"), 'P19-F clusters must remain anchored to safe areas.');
assert(layoutCss.includes(".touch-ui[data-layout-preset='left-handed'] .movement-control-cluster") && layoutCss.includes(".touch-ui[data-layout-preset='left-handed'] .action-control-cluster"), 'P19-F Left-Handed layout must swap both cluster anchors.');
assert(layoutCss.includes('@media (pointer: coarse) and (orientation: portrait)') && layoutCss.includes('translate3d(0, var(--iv-cluster-y'), 'P19-F portrait must suspend horizontal inset to preserve non-overlap.');
for (const fixedSelector of ['.hud-top', '.mission-card', '.transient-alert-lane', '.target-readout', '.boss-hud']) {
  assert(!layoutCss.includes(fixedSelector), `P19-F movable-layout CSS must not reposition fixed mission-critical selector ${fixedSelector}.`);
}

assert(guide.includes('Standard keeps movement on the left and combat actions on the right') && guide.includes('Large enlarges both clusters') && guide.includes('Left-Handed swaps those sides'), 'P19-F Guide must describe the actual touch-layout presets.');
assert(guide.includes('Mission-critical vitals, objectives, alerts') && guide.includes('Portrait temporarily suspends horizontal inset'), 'P19-F Guide must explain fixed HUD and portrait bounds.');
assert(guide.includes('Large text, High Contrast, and Reduce Motion'), 'P19-F Guide must document accessibility compatibility.');

assert(androidSmoke.includes('ANDROID_P19_HUD_LAYOUT_SETTINGS_PASS') && androidSmoke.includes('ANDROID_P19_HUD_LAYOUT_PASS') && androidSmoke.includes('ANDROID_P19_HUD_LAYOUT_RESUME_PASS') && androidSmoke.includes('ANDROID_P19_HUD_LAYOUT_RELAUNCH_PASS'), 'P19-F Android smoke must cover presets/customization, rotation, resume, and relaunch.');
assert(pkg.scripts?.['test:hud-layout']?.includes('tests/hud-layout-presets.ts'), 'P19-F focused HUD layout regression script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:hud-layout'), 'Full production build must gate on P19-F HUD layout regressions.');

console.log('HUD_LAYOUT_PRESETS_PASS presets=standard+large+left-handed persistence=legacy+bounded controls=movement+action input=manual+assisted safe=portrait+landscape guide=canonical accessibility=compatible interfaceSize=isolated android=launch+resume+rotation+relaunch');
