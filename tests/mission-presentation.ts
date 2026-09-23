import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const app = read('src/App.tsx');
const combat = read('src/components/GameCanvas.tsx');
const css = read('src/missionPresentation.css');
const main = read('src/main.tsx');
const browserSmoke = read('scripts/browser-runtime-smoke.mjs');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(
  main.includes("import './missionPresentation.css';")
    && css.includes('P15-C // Mission deployment, boss transitions, and debrief highlights'),
  'P15-C presentation layer must be loaded by the client root.',
);

assert(
  combat.includes('data-mission-presentation="non-blocking-cues"')
    && combat.includes('data-presentation="deployment"')
    && combat.includes('role="status" aria-live="polite" aria-atomic="true"')
    && css.includes('pointer-events: none;'),
  'Deployment presentation must be announced but never intercept movement, aim, fire, or touch input.',
);

assert(
  combat.includes("kicker: phaseShift ? 'COMMAND TARGET // PHASE SHIFT' : 'COMMAND TARGET // CONTACT'")
    && combat.includes('hud.bossPhase > previous.phase')
    && combat.includes('data-presentation="boss-transition"')
    && combat.includes('control remains live.'),
  'Boss contact and phase shifts must use concise in-engine callouts tied to existing HUD phase state.',
);

assert(
  css.includes('.mission-cinematic.reduced-motion')
    && css.includes('@media (prefers-reduced-motion: reduce)')
    && css.includes('env(safe-area-inset-top)')
    && css.includes('@media (pointer: coarse), (max-width: 900px)'),
  'Mission callouts must respect reduced motion, safe areas, and coarse-pointer layouts.',
);

assert(
  app.includes('debrief-shell iv-view')
    && app.includes('debrief-card iv-panel iv-panel--glass')
    && app.includes('data-presentation="debrief-highlights"')
    && app.includes('data-highlight="loot"')
    && app.includes('data-highlight="progression"')
    && app.includes('data-highlight="unlock"')
    && app.includes('featuredRecovery')
    && app.includes('unlockHighlight'),
  'Debrief must lead with loot, progression, and next-unlock highlights before the detailed after-action log.',
);

assert(
  css.includes('.debrief-highlight-grid')
    && css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))')
    && css.includes('@media (max-width: 640px)'),
  'Debrief highlights must retain a responsive layout on phone-sized viewports.',
);

assert(
  browserSmoke.includes('BROWSER_P15_MISSION_PRESENTATION_PASS')
    && browserSmoke.includes("style?.pointerEvents ?? ''")
    && androidSmoke.includes('ANDROID_P15_MISSION_PRESENTATION_PASS')
    && androidSmoke.includes("style?.pointerEvents ?? ''"),
  'Browser and Android smoke must verify the live deployment cue remains non-blocking and onscreen.',
);

assert(pkg.scripts?.['test:mission-presentation']?.includes('tests/mission-presentation.ts'), 'P15-C mission-presentation test script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:mission-presentation'), 'Full production build must gate on the P15-C mission-presentation regression.');

console.log('MISSION_PRESENTATION_PASS deployment=non-blocking boss=contact+phase debrief=loot+progression+unlock motion=reduced-safe mobile=safe-area');
