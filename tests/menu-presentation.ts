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

assert(
  shipHub.includes('ref={commandNavRef}')
    && shipHub.includes('data-primary-area={id}')
    && shipHub.includes('onKeyDown={handlePrimaryNavigation}')
    && shipHub.includes('navigator.getGamepads()')
    && shipHub.includes('focusPrimaryAreaByOffset')
    && shipHub.includes('openPrimaryArea(id)'),
  'P19-B must keep one shared five-destination navigation model with keyboard/gamepad focus and the existing routing path.',
);

assert(
  menuCss.includes('P19-B // Adaptive five-item Command dock')
    && menuCss.includes('(max-width: 900px) and (max-height: 650px)')
    && menuCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))')
    && menuCss.includes('min-height: 54px')
    && menuCss.includes('font-size: 10px')
    && menuCss.includes('env(safe-area-inset-left)')
    && menuCss.includes('env(safe-area-inset-right)')
    && menuCss.includes('env(safe-area-inset-bottom)'),
  'P19-B compact Command navigation must become a safe-area-aware five-item dock with readable 48px-class targets.',
);

assert(
  browserSmoke.includes('BROWSER_P19B_COMMAND_NAV_PASS')
    && browserSmoke.includes('BROWSER_P19B_ROUTE_PASS')
    && androidSmoke.includes('ANDROID_P19B_DOCK_PASS')
    && androidSmoke.includes('ANDROID_P19B_TOUCH_PASS')
    && androidSmoke.includes('ANDROID_P19B_CONTROLLER_PASS')
    && androidSmoke.includes('ANDROID_P19B_BREAKPOINT_PASS'),
  'P19-B browser/Android QA must cover dock/rail geometry plus shared keyboard, touch, controller, rotation, and breakpoint behavior.',
);

assert(pkg.scripts?.['test:menu-presentation']?.includes('tests/menu-presentation.ts'), 'P15-B menu-presentation test script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:menu-presentation'), 'Full production build must gate on the P15-B menu-presentation regression.');

console.log('MENU_PRESENTATION_PASS class=shared crafting=shared progression=shared ship=shared navigation=keyboard+controller+touch transition=reduced-motion-safe gear-inspector=dom');
