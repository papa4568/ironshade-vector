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

console.log('DESIGN_SYSTEM_PASS typography=shared spacing=4px iconography=normalized focus=visible rarity=canonical panel=shared tooltip=shared responsive=coarse+safe-area');
