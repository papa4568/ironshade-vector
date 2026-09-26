import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const css = read('src/designSystem.css');
const main = read('src/main.tsx');
const rootCss = read('src/index.css');
const rarity = read('src/game/rarity.ts');
const primitives = read('src/components/UiPrimitives.tsx');
const armory = read('src/components/Armory.tsx');
const app = read('src/App.tsx');
const meta = read('src/game/meta.ts');
const guide = read('src/game/guideContent.ts');
const combatHud = read('src/combatHudGlance.css');
const combatLayout = read('src/combatHudLayout.css');
const menuCss = read('src/menuOverhaul.css');
const armoryCss = read('src/part3.css');
const classBuildCss = read('src/classBuilds.css');
const browserSmoke = read('scripts/browser-runtime-smoke.mjs');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

for (const token of [
  '--iv-font-body',
  '--iv-font-display',
  '--iv-type-body',
  '--iv-type-display',
  '--iv-leading-body',
  '--iv-space-1',
  '--iv-space-4',
  '--iv-space-8',
  '--iv-space-16',
  '--iv-icon-sm',
  '--iv-icon-md',
  '--iv-icon-xl',
  '--iv-focus',
  '--iv-surface-raised',
  '--iv-border-subtle',
  '--iv-safe-left',
  '--iv-safe-right',
]) {
  assert(css.includes(token), `P15-A design-system token missing: ${token}`);
}

assert(css.includes(':focus-visible') && css.includes('outline-offset: 3px') && css.includes('--iv-focus-shadow'), 'P15-A must provide one shared, visible keyboard/gamepad focus language.');
assert(css.includes('.iv-panel') && css.includes('.iv-panel--glass') && css.includes('.iv-tooltip'), 'P15-A must provide shared panel and tooltip primitives.');
assert(css.includes('.iv-icon') && css.includes('--iv-icon-stroke'), 'P15-A must normalize icon sizing/stroke weight.');
assert(css.includes('@media (pointer: coarse), (max-width: 900px)') && css.includes('@media (max-width: 620px)') && css.includes('env(safe-area-inset-left)'), 'P15-A must define coarse-pointer/mobile responsive and safe-area rules.');

const rarityPairs = [
  ['field', '#c3d0ca'],
  ['refined', '#69aee8'],
  ['prototype', '#c47ce8'],
  ['singular', '#f0a45b'],
] as const;

for (const [token, hex] of rarityPairs) {
  assert(rarity.toLowerCase().includes(`token: '${token}'`) && rarity.toLowerCase().includes(`colorhex: '${hex}'`), `Canonical rarity contract missing ${token} / ${hex}`);
  assert(css.includes(`--iv-rarity-${token}: ${hex};`) && css.includes(`[data-rarity='${token}']`), `P15-A rarity token drift for ${token}`);
}

assert(main.includes("import './designSystem.css';"), 'P15-A design-system stylesheet must be loaded by the client entrypoint.');
assert(rootCss.includes('font-family: var(--iv-font-body);') && rootCss.includes('color: var(--iv-text-primary);') && rootCss.includes('background: var(--iv-surface-void);'), 'P15-A root shell must consume the shared typography/text/surface tokens.');
assert(pkg.scripts?.['test:design-system']?.includes('tests/design-system.ts'), 'P15-A regression test script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:design-system'), 'Full production build must gate on the P15-A design-system regression.');

assert(meta.includes("export type InterfaceSize = 'compact' | 'default' | 'large'") && meta.includes("interfaceSize: 'default'") && meta.includes('normalizeInterfaceSize'), 'P20-A profile settings must persist and normalize Compact/Default/Large Interface Size.');
assert(app.includes('root.dataset.interfaceSize = profile.settings.interfaceSize') && app.includes('profile.settings.interfaceSize'), 'P20-A must apply the saved Interface Size at the shared document root.');
assert(armory.includes('aria-label="Interface size"') && armory.includes('<option value="compact">Compact</option>') && armory.includes('<option value="large">Large</option>'), 'P20-A Settings must expose Compact/Default/Large Interface Size.');
for (const selector of ["data-interface-size='compact'", "data-interface-size='default'", "data-interface-size='large'", "data-interface-size='compact'][data-text-scale='large'", "data-interface-size='large'][data-text-scale='large'"]) {
  assert(css.includes(selector), `P20-A shared interface-size selector missing: ${selector}`);
}
assert(css.includes('--iv-interface-scale') && css.includes('font-size: 72%') && css.includes('font-size: 81%') && css.includes('font-size: 125%') && css.includes('font-size: 140.625%'), 'P20-A shared root scale must keep Compact drastically smaller, Default baseline, Large larger, and compose Interface Text Size.');
assert(!css.includes('.touch-ui') && !css.includes('.combat-dock') && !css.includes('.fire-button') && !css.includes('.move-stick'), 'P20-A general interface scaling must not add combat-control selectors to the shared design system.');

for (const [source, marker, expectations] of [
  [menuCss, 'P20-A // Shared menu/Command geometry', ['.build-tabs', '.command-card.primary-card', 'rem']],
  [armoryCss, 'P20-A // Effective interface-size geometry', ['.inventory-card', '.settings-panel label', '.network-planner', 'rem']],
  [classBuildCss, 'P20-A // Scale representative Progression, Skills, and Crafting geometry', ['.skill-path-overview', '.crafting-rules-contract', 'rem']],
] as const) {
  assert(source.includes(marker) && expectations.every(expectation => source.includes(expectation)), `P20-A scale-aware surface contract missing: ${marker}`);
}
const p20HudBlock = combatHud.split('/* P20-A // Interface Size owns informational combat HUD chrome only.')[1] ?? '';
assert(p20HudBlock.includes('.game-root .vitals') && p20HudBlock.includes('.game-root .mission-card') && p20HudBlock.includes('rem'), 'P20-A informational HUD must route real chrome dimensions through root-scaled units.');
for (const controlSelector of ['.move-stick', '.combat-dock', '.touch-button', '.fire-button', '.dodge-button', '.interact-button']) {
  assert(!p20HudBlock.includes(controlSelector), `P20-A informational HUD block must not resize combat control geometry: ${controlSelector}`);
}
assert(!combatLayout.match(/\d+(?:\.\d+)?rem\b/), 'P20-A combat-control layout geometry must remain fixed-pixel and independent of root rem scaling.');
assert(guide.includes('Interface Size scales shared non-combat menu') && guide.includes('Combat movement, FIRE, DODGE, class-skill, ACT'), 'P20-A Guide must explain non-combat scaling and combat-control ownership.');
assert(browserSmoke.includes('BROWSER_P20_COMMAND_SCALE_PASS') && browserSmoke.includes('* 0.82') && browserSmoke.includes('* 0.8') && browserSmoke.includes('BROWSER_P20_BUILD_SCALE_PASS') && browserSmoke.includes('BROWSER_P20_HUD_SCALE_PASS') && browserSmoke.includes('BROWSER_P20_COMBAT_CONTROL_INVARIANT_PASS'), 'P20-A Browser E2E must require a material Compact density delta across Command/Build while retaining informational-HUD scaling and isolated combat controls.');
assert(androidSmoke.includes('ANDROID_P20_COMMAND_DENSITY_PASS') && androidSmoke.includes('ANDROID_P20_INTERFACE_SIZE_PASS') && androidSmoke.includes('rowPadding') && androidSmoke.includes('ANDROID_P20_HUD_SCALE_PASS') && androidSmoke.includes('ANDROID_P20_COMBAT_CONTROL_INVARIANT_PASS'), 'P20-A Android smoke must verify material Compact Command density, persisted rendered scaling, informational HUD scaling, and combat-control geometry invariance.');

assert(primitives.includes("export function ProgressiveDisclosure") && primitives.includes('createPortal') && primitives.includes('role="dialog"') && primitives.includes('aria-modal="true"') && primitives.includes('aria-haspopup="dialog"'), 'P18-D must provide one reusable, portal-backed progressive-disclosure dialog pattern.');
assert(primitives.includes("event.key === 'Escape'") && primitives.includes("event.key !== 'Tab'") && primitives.includes("window.history.pushState") && primitives.includes("window.addEventListener('popstate'") && primitives.includes('focusTarget?.focus()'), 'P18-D disclosure must trap focus, support Escape/back dismissal, and restore the trigger focus.');
assert(primitives.includes("export type RequirementPresentation") && primitives.includes("state: 'ready'") && primitives.includes("state: 'active'") && primitives.includes("state: 'blocked'") && primitives.includes('Why blocked:') && primitives.includes('Next:'), 'P18-D requirement state must expose ready/active/blocked semantics with blocker reason and next requirement.');
assert(css.includes('.iv-disclosure-backdrop') && css.includes('.iv-disclosure-sheet') && css.includes('.iv-requirement--blocked') && css.includes('var(--iv-safe-top)') && css.includes('max-height: min(88dvh') && css.includes('@media (max-width: 620px)'), 'P18-D shared clarity primitives must use design-system tokens, safe areas, and a mobile sheet layout.');
assert(armory.includes('<ProgressiveDisclosure triggerLabel="How equipment discovery works"') && armory.includes('<ActionRequirement presentation={focusedAllocationRequirement} />') && armory.includes("focusedAllocationRequirement?.state !== 'ready'"), 'P18-D Build proving ground must reuse the shared disclosure and eligibility primitives instead of a bespoke details shell or disabled-only allocation cue.');
assert(androidSmoke.includes('ANDROID_P18_DISCLOSURE_LANDSCAPE_PASS') && androidSmoke.includes('ANDROID_P18_DISCLOSURE_PORTRAIT_PASS') && androidSmoke.includes('ANDROID_P18_DISCLOSURE_BACK_PASS') && androidSmoke.includes('Emulation.setDeviceMetricsOverride') && androidSmoke.includes('history.back()'), 'P18-D Android smoke must cover landscape/portrait touch layout and browser-history back dismissal.');

assert(
  armory.includes('craftingAccessRequirement')
    && armory.includes('Missing salvage')
    && armory.includes('GuideLink section="crafting"')
    && armory.includes('networkRequirementFor')
    && armory.includes('Exclusive Keystone choice already active')
    && armory.includes('View planned build math')
    && armory.includes('GuideLink section="builds-progression"')
    && armory.includes('View current skill path')
    && armory.includes('skillEvolutionRequirement')
    && !armory.includes('How Reconstruction rules work')
    && !armory.includes('How Skills progression works'),
  'P18-F/P19-E must preserve shared requirement states across Crafting, Progression, and Skills while routing durable teaching to Guide and decision-specific previews to shared Details.',
);
assert(
  androidSmoke.includes('ANDROID_P18F_CRAFTING_REQUIREMENT_PASS')
    && androidSmoke.includes('ANDROID_P18F_PROGRESSION_REQUIREMENT_PASS')
    && androidSmoke.includes('ANDROID_P18F_SKILLS_REQUIREMENT_PASS'),
  'P18-F Android smoke must verify Crafting, Progression, and Skills requirement states on-device.',
);

console.log('DESIGN_SYSTEM_PASS typography=shared spacing=4px iconography=normalized focus=visible rarity=canonical panel=shared tooltip=shared disclosure=accessible requirement=explicit responsive=coarse+safe-area interfaceSize=rendered+ordered combatHud=scaled combatControls=isolated');
