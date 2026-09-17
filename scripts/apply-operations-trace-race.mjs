import { readFileSync, writeFileSync } from 'node:fs';

const hubPath = 'src/components/ShipHub.tsx';
const testPath = 'tests/ui-readability.ts';

let hub = readFileSync(hubPath, 'utf8');
let tests = readFileSync(testPath, 'utf8');

const oldRef = "  const hubRef = useRef<HTMLElement>(null);\n";
const newRef = "  const hubRef = useRef<HTMLElement>(null);\n  const traceRequestIdRef = useRef(0);\n";
if (!hub.includes(oldRef)) throw new Error('ShipHub hubRef anchor not found');
if (!hub.includes('traceRequestIdRef')) hub = hub.replace(oldRef, newRef);

const oldInspect = `  const inspectTrace = async (id: string) => {\n    setTraceMessage('Loading anonymous run trace…');\n    try {\n      const trace = await loadRunTrace(id);\n      setTraceRecord(trace);\n      setTraceMessage('');\n    } catch {\n      setTraceRecord(null);\n      setTraceMessage('Run trace unavailable. The rest of the Operations Board remains usable.');\n    }\n  };`;
const newInspect = `  const inspectTrace = async (id: string) => {\n    const requestId = ++traceRequestIdRef.current;\n    setTraceRecord(null);\n    setTraceMessage('Loading anonymous run trace…');\n    try {\n      const trace = await loadRunTrace(id);\n      if (traceRequestIdRef.current !== requestId) return;\n      setTraceRecord(trace);\n      setTraceMessage('');\n    } catch {\n      if (traceRequestIdRef.current !== requestId) return;\n      setTraceRecord(null);\n      setTraceMessage('Run trace unavailable. The rest of the Operations Board remains usable.');\n    }\n  };`;
if (!hub.includes(oldInspect) && !hub.includes(newInspect)) throw new Error('ShipHub inspectTrace anchor not found');
if (!hub.includes(newInspect)) hub = hub.replace(oldInspect, newInspect);

const testAnchor = "assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveGameState(profile, campaign)') && app.includes(\"current === persistenceWarning ? '' : current\") && shipHub.includes(\"const displayedStatusMessage = statusMessage ||\") && shipHub.includes(\"role={statusMessage ? 'alert' : 'status'}\"), 'Local persistence failures are not surfaced reliably to an already-mounted ShipHub.');\n";
const raceAssertion = "assert(shipHub.includes('traceRequestIdRef') && shipHub.includes('const requestId = ++traceRequestIdRef.current') && shipHub.includes('traceRequestIdRef.current !== requestId'), 'Operations trace loading can still let an older request overwrite a newer selection.');\n";
if (!tests.includes(testAnchor)) throw new Error('UI test anchor not found');
if (!tests.includes(raceAssertion)) tests = tests.replace(testAnchor, testAnchor + raceAssertion);

writeFileSync(hubPath, hub);
writeFileSync(testPath, tests);
