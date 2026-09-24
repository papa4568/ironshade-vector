import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const designSystem = read('src/designSystem.css');
const classSelect = read('src/components/ClassSelectScreen.tsx');
const armory = read('src/components/Armory.tsx');
const shipHub = read('src/components/ShipHub.tsx');
const menuCss = read('src/menuOverhaul.css');
const browserSmoke = read('scripts/browser-runtime-smoke.mjs');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  designSystem.includes('@keyframes iv-view-enter')
    && designSystem.includes('.iv-view')
    && designSystem.includes('@media (prefers-reduced-motion: reduce)')
    && designSystem.includes('animation: none'),
  'P15-B menu transitions must use one shared reduced-motion-safe view primitive.',
);

assert(
  classSelect.includes('class-intake iv-view')
    && classSelect.includes('class-intake-header iv-panel iv-panel--glass')
    && classSelect.includes('class-choice-section iv-panel')
    && classSelect.includes('class-choice-card iv-panel')
    && classSelect.includes('class-selected-panel iv-panel'),
  'P15-B class intake must compose the P15-A view/panel primitives.',
);

assert(
  armory.includes('build-bay iv-view')
    && armory.includes('build-header iv-panel iv-panel--glass')
    && armory.includes('reconstruction-top iv-panel iv-panel--glass')
    && armory.includes('reconstruct-storage iv-panel')
    && armory.includes('section-copy iv-panel iv-panel--glass')
    && armory.includes('network-planner iv-panel')
    && armory.includes('operator-class-panel iv-panel')
    && armory.includes('specialization-panel iv-panel'),
  'P15-B Build, Crafting, and Progression surfaces must compose the P15-A panel language.',
);

assert(
  shipHub.includes('ship-hub area-${primaryArea} iv-view')
    && shipHub.includes('tactical-header iv-panel iv-panel--glass')
    && shipHub.includes('ship-systems-intro iv-panel iv-panel--glass')
    && shipHub.includes('ship-hardware-bay iv-panel')
    && shipHub.includes('upgrade-card iv-panel'),
  'P15-B Ship Systems must compose the P15-A view/panel primitives.',
);

assert(
  armory.includes("aria-current={tab === value ? 'page' : undefined}")
    && armory.includes('onKeyDown={handleNetworkNavigation}')
    && armory.includes('navigator.getGamepads()')
    && classSelect.includes('aria-pressed={active}')
    && shipHub.includes("aria-current={primaryArea === id ? 'page' : undefined}"),
  'P15-B navigation semantics must preserve keyboard/controller/touch discoverability.',
);

assert(
  menuCss.includes('P15-B // Build/menu surfaces compose the P15-A primitives')
    && menuCss.includes('var(--iv-border-subtle)')
    && menuCss.includes('var(--iv-radius-lg)')
    && menuCss.includes('@media (pointer: coarse), (max-width: 900px)')
    && menuCss.includes('min-height: 44px'),
  'P15-B feature styling must consume shared design tokens and keep coarse-pointer menu targets usable.',
);

assert(
  armory.includes('aria-label="Item comparison"')
    && armory.includes('className="inspector-scroll" tabIndex={0}')
    && armory.includes('PRIMARY EFFECT')
    && armory.includes('KEY LOADOUT CHANGES')
    && armory.includes('<ActionRequirement presentation={equipRequirement} />')
    && armory.includes('<ProgressiveDisclosure triggerLabel="Details"'),
  'P15-B/P18-E gear inspection must retain a readable decision-first DOM hierarchy with shared deep details on mobile.',
);


assert(
  shipHub.includes('const commandNavRef = useRef<HTMLElement>(null)')
    && shipHub.includes('onKeyDown={handlePrimaryNavigationKeyDown}')
    && shipHub.includes('data-primary-area={id}')
    && shipHub.includes('navigator.getGamepads()')
    && shipHub.includes("pad?.buttons[0]?.pressed")
    && shipHub.includes("pad?.buttons[1]?.pressed"),
  'P19-B primary Command navigation must preserve one destination model across keyboard/controller/touch input.',
);

assert(
  menuCss.includes('P19-B // Compact phones use a five-item bottom Command dock')
    && menuCss.includes('(orientation: landscape) and (max-width: 1000px) and (max-height: 500px)')
    && menuCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))')
    && menuCss.includes('min-height: 52px')
    && menuCss.includes('font-size: 12px')
    && menuCss.includes('var(--command-safe-right)')
    && menuCss.includes('var(--command-safe-bottom)'),
  'P19-B compact phones must use a safe-area-aware five-item bottom dock with readable 48px-class targets.',
);

assert(
  browserSmoke.includes('BROWSER_P19_COMMAND_NAV_PASS')
    && browserSmoke.includes('BROWSER_P19_COMMAND_INPUT_PASS')
    && browserSmoke.includes('__p19CommandGamepad'),
  'P19-B browser QA must verify dock/rail breakpoint layout plus keyboard/controller navigation.',
);

assert(
  androidSmoke.includes('ANDROID_P19_COMMAND_NAV_PASS')
    && androidSmoke.includes('__p19CommandGamepad')
    && androidSmoke.includes('Emulation.setDeviceMetricsOverride')
    && androidSmoke.includes('Emulation.clearDeviceMetricsOverride'),
  'P19-B Android QA must verify touch/controller/back/rotation and dock/rail breakpoint behavior.',
);

assert(
  browserSmoke.includes('BROWSER_P15_MENU_PRESENTATION_PASS')
    && browserSmoke.includes("keyboardActivateButton('Crafting')")
    && browserSmoke.includes("keyboardActivateButton('Progression')")
    && browserSmoke.includes("keyboardActivateButton('Ship')"),
  'P15-B browser QA must navigate Crafting, Progression, and Ship Systems by keyboard.',
);

assert(
  androidSmoke.includes('ANDROID_P15_MENU_PRESENTATION_PASS')
    && androidSmoke.includes("tapButton('Crafting'")
    && androidSmoke.includes("tapButton('Progression'")
    && androidSmoke.includes("tapButton('Ship'"),
  'P15-B Android QA must navigate Crafting, Progression, and Ship Systems by touch.',
);

assert(pkg.scripts?.['test:menu-presentation']?.includes('tests/menu-presentation.ts'), 'P15-B menu-presentation test script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:menu-presentation'), 'Full production build must gate on the P15-B menu-presentation regression.');

console.log('MENU_PRESENTATION_PASS class=shared crafting=shared progression=shared ship=shared navigation=keyboard+controller+touch transition=reduced-motion-safe gear-inspector=dom');
