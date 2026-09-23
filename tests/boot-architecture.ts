import { BOOT_DIAGNOSTICS_VERSION, createBootDiagnostics } from '../src/game/bootDiagnostics';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let now = 100;
const diagnostics = createBootDiagnostics(() => now);

now = 101;
diagnostics.mark('entry');
now = 109;
diagnostics.mark('recovery-module-ready');
now = 137;
diagnostics.mark('recovery-complete');
now = 151;
diagnostics.mark('app-module-ready');
now = 156;
diagnostics.mark('app-render-requested');
now = 164;
const report = diagnostics.mark('first-frame');

assert(report.version === BOOT_DIAGNOSTICS_VERSION, 'Boot diagnostics version drifted.');
assert(report.totalMs === 64, `Expected 64ms total staged boot timing, received ${report.totalMs}.`);
assert(report.stages.map(stage => stage.stage).join(',') === 'entry,recovery-module-ready,recovery-complete,app-module-ready,app-render-requested,first-frame', 'Boot stage ordering drifted.');
assert(report.stages[1]?.durationMs === 8, 'Recovery module load duration is not tracked independently.');
assert(report.stages[2]?.durationMs === 28, 'Save recovery duration is not tracked independently.');
assert(report.stages[3]?.durationMs === 14, 'App module load duration is not tracked independently.');
assert(report.stages[5]?.durationMs === 8, 'First-frame scheduling duration is not tracked independently.');

const snapshot = diagnostics.report();
snapshot.stages[0]!.durationMs = 999;
assert(diagnostics.report().stages[0]?.durationMs === 1, 'Diagnostic reports must not expose mutable internal timing state.');

console.log(
  'BOOT_ARCHITECTURE_PASS ' +
  `version=${report.version} totalMs=${report.totalMs} stages=${report.stages.length}`,
);
