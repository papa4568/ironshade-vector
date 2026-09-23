import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function hexChannel(value: string) {
  const normalized = value.length === 1 ? value + value : value;
  return Number.parseInt(normalized, 16) / 255;
}
function luminance(hex: string) {
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map(channel => channel + channel).join('') : raw;
  const channels = [expanded.slice(0, 2), expanded.slice(2, 4), expanded.slice(4, 6)].map(channel => {
    const value = hexChannel(channel);
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrastRatio(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}
function token(block: string, name: string) {
  return block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`))?.[1] ?? '';
}

const meta = read('src/game/meta.ts');
const app = read('src/App.tsx');
const armory = read('src/components/Armory.tsx');
const combat = read('src/components/GameCanvas.tsx');
const feedback = read('src/game/feedback.ts');
const design = read('src/designSystem.css');
const browserSmoke = read('scripts/browser-runtime-smoke.mjs');
const androidSmoke = read('scripts/android-runtime-smoke.mjs');
const browserWorkflow = read('.github/workflows/browser-e2e.yml');
const androidWorkflow = read('.github/workflows/android-apk.yml');
const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };

assert(meta.includes("export type TextScale = 'default' | 'large'") && meta.includes("export type ContrastMode = 'standard' | 'high'"), 'P15-E must type persisted text-scale and contrast preferences.');
assert(meta.includes('reducedMotion: boolean') && meta.includes("textScale: 'default'") && meta.includes("contrast: 'standard'") && meta.includes('reducedMotion: false'), 'P15-E accessibility preferences need save-safe defaults.');
assert(meta.includes('settings: { ...defaults.settings, ...parsed.settings }'), 'P15-E settings must normalize old saves without a profile-version reset.');

for (const control of ['Interface text size', 'High contrast', 'Reduce motion', 'Touch aim assistance', 'Assisted fire tracking', 'Effect intensity', 'Combat effects volume', 'Interface volume', 'Mobile haptics']) {
  assert(armory.includes(control), `Build settings are missing the ${control} accessibility/feedback control.`);
}
assert(app.includes('root.dataset.textScale = profile.settings.textScale') && app.includes('root.dataset.contrast = profile.settings.contrast') && app.includes("root.dataset.reducedMotion = profile.settings.reducedMotion ? 'true' : 'false'"), 'Persisted accessibility settings must drive the global presentation root.');
assert(feedback.includes('settings.effectsVolume') && feedback.includes('settings.uiVolume') && feedback.includes('this.settings?.haptics'), 'Audio and haptic controls must continue to affect the feedback buses.');
assert(combat.includes('profileSettings.aimAssist') && combat.includes('profileSettings.rightStickFire'), 'Assist settings must continue to affect touch/controller targeting.');
assert(combat.includes('profileSettingsRef.current.screenShake && !profileSettingsRef.current.reducedMotion') && combat.includes("canvas.dataset.reducedMotion = profileSettingsRef.current.reducedMotion ? 'true' : 'false'"), 'Reduced motion must suppress combat camera shake and expose runtime QA state.');

assert(design.includes(":root[data-text-scale='large']") && design.includes('font-size: 112.5%'), 'Large interface text must scale rem-based presentation globally.');
const contrastBlock = design.match(/:root\[data-contrast='high'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
assert(contrastBlock, 'High-contrast token override is missing.');
const primary = token(contrastBlock, 'iv-text-primary');
const secondary = token(contrastBlock, 'iv-text-secondary');
const raised = token(contrastBlock, 'iv-surface-raised');
assert(primary && secondary && raised, 'High-contrast mode must define readable text and raised-surface tokens.');
assert(contrastRatio(primary, raised) >= 7 && contrastRatio(secondary, raised) >= 7, 'High-contrast primary and secondary text must meet a 7:1 contrast target on raised surfaces.');
assert(design.includes(":root[data-reduced-motion='true'] *") && design.includes('animation: none !important') && design.includes('transition: none !important') && design.includes('@media (prefers-reduced-motion: reduce)'), 'Reduced motion must work both as a saved preference and an OS/browser preference.');

for (const inset of ['safe-area-inset-top', 'safe-area-inset-right', 'safe-area-inset-bottom', 'safe-area-inset-left']) {
  assert(design.includes(`env(${inset})`), `P15-E design system is missing ${inset} coverage.`);
}
assert(browserWorkflow.includes('- desktop') && browserWorkflow.includes('- mobile-landscape') && browserWorkflow.includes('browser-accessibility-${{ matrix.viewport }}.png'), 'Browser presentation QA must retain desktop/mobile-landscape coverage and dedicated accessibility screenshots.');
assert(browserSmoke.includes('BROWSER_P15_ACCESSIBILITY_PASS') && browserSmoke.includes("localStorage.getItem('ironshade-vector-state-v1')") && browserSmoke.includes("accessibilityAudit('settings-accessibility')") && browserSmoke.includes('captureScreenshot(accessibilityScreenshotPath)'), 'Browser QA must verify persisted settings, accessibility/readability, and screenshot capture through the live UI.');
assert(androidWorkflow.includes('android:screenOrientation="sensorLandscape"') && androidWorkflow.includes('ReactiveCircus/android-emulator-runner') && androidWorkflow.includes('android-runtime-smoke.png'), 'Android QA must enforce the target sensor-landscape orientation and retain emulator screenshot evidence.');
assert(androidSmoke.includes('ANDROID_MOBILE_LAYOUT_PASS') && androidSmoke.includes('ANDROID_LIFECYCLE_RESUME_PASS'), 'Android runtime QA must retain mobile-layout and lifecycle gates.');

assert(pkg.scripts?.['test:accessibility-mobile']?.includes('tests/accessibility-mobile-gate.ts'), 'P15-E regression test script is missing.');
assert(pkg.scripts?.build?.includes('npm run test:accessibility-mobile'), 'Full production build must gate on P15-E accessibility/mobile verification.');

console.log('ACCESSIBILITY_MOBILE_GATE_PASS text=large contrast=wcag-aaa motion=saved+system effects=controlled audio=controlled assist=controlled safe-area=4-sided orientation=desktop+mobile-landscape+sensor-landscape screenshots=retained');
