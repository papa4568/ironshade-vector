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


assert(primitives.includes("export function ProgressiveDisclosure") && primitives.includes('createPortal') && primitives.includes('role="dialog"') && primitives.includes('aria-modal="true"') && primitives.includes('aria-haspopup="dialog"'), 'P18-D must provide one reusable, portal-backed progressive-disclosure dialog pattern.');
assert(primitives.includes("event.key === 'Escape'") && primitives.includes("event.key !== 'Tab'") && primitives.includes("window.history.pushState") && primitives.includes("window.addEventListener('popstate'") && primitives.includes('focusTarget?.focus()'), 'P18-D disclosure must trap focus, support Escape/back dismissal, and restore the trigger focus.');
assert(primitives.includes("export type RequirementPresentation") && primitives.includes("state: 'ready'") && primitives.includes("state: 'active'") && primitives.includes("state: 'blocked'") && primitives.includes('Why blocked:') && primitives.includes('Next:'), 'P18-D requirement state must expose ready/active/blocked semantics with blocker reason and next requirement.');
assert(css.includes('.iv-disclosure-backdrop') && css.includes('.iv-disclosure-sheet') && css.includes('.iv-requirement--blocked') && css.includes('var(--iv-safe-top)') && css.includes('max-height: min(88dvh') && css.includes('@media (max-width: 620px)'), 'P18-D shared clarity primitives must use design-system tokens, safe areas, and a mobile sheet layout.');
assert(armory.includes('<ProgressiveDisclosure triggerLabel="How equipment discovery works"') && armory.includes('<ActionRequirement presentation={focusedAllocationRequirement} />') && armory.includes("focusedAllocationRequirement?.state !== 'ready'"), 'P18-D Build proving ground must reuse the shared disclosure and eligibility primitives instead of a bespoke details shell or disabled-only allocation cue.');
assert(androidSmoke.includes('ANDROID_P18_DISCLOSURE_LANDSCAPE_PASS') && androidSmoke.includes('ANDROID_P18_DISCLOSURE_PORTRAIT_PASS') && androidSmoke.includes('ANDROID_P18_DISCLOSURE_BACK_PASS') && androidSmoke.includes('Emulation.setDeviceMetricsOverride') && androidSmoke.includes('history.back()'), 'P18-D Android smoke must cover landscape/portrait touch layout and browser-history back dismissal.');

assert(
  armory.includes('craftingAccessRequirement')
    && armory.includes('Missing salvage')
    && armory.includes('How Reconstruction rules work')
    && armory.includes('networkRequirementFor')
    && armory.includes('Exclusive Keystone choice already active')
    && armory.includes('View planned build math')
    && armory.includes('How Skills progression works')
    && armory.includes('skillEvolutionRequirement'),
  'P18-F must apply shared requirement/disclosure primitives across Crafting, Progression, and Skills blockers.',
);
assert(
  androidSmoke.includes('ANDROID_P18F_CRAFTING_REQUIREMENT_PASS')
    && androidSmoke.includes('ANDROID_P18F_PROGRESSION_REQUIREMENT_PASS')
    && androidSmoke.includes('ANDROID_P18F_SKILLS_REQUIREMENT_PASS'),
  'P18-F Android smoke must verify Crafting, Progression, and Skills requirement states on-device.',
);

console.log('DESIGN_SYSTEM_PASS typography=shared spacing=4px iconography=normalized focus=visible rarity=canonical panel=shared tooltip=shared disclosure=accessible requirement=explicit responsive=coarse+safe-area');
