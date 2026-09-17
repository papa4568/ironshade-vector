import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Unable to locate ${label}`);
  return source.replace(needle, replacement);
}

const appPath = 'src/App.tsx';
let app = readFileSync(appPath, 'utf8');
app = replaceOnce(
  app,
  "  useEffect(() => { if (!saveGameState(profile, campaign)) setStatusMessage(persistenceWarning); }, [profile, campaign]);",
  "  useEffect(() => {\n    if (!saveGameState(profile, campaign)) setStatusMessage(persistenceWarning);\n    else setStatusMessage(current => current === persistenceWarning ? '' : current);\n  }, [profile, campaign]);",
  'transactional persistence warning effect',
);
writeFileSync(appPath, app);

const shipHubPath = 'src/components/ShipHub.tsx';
let shipHub = readFileSync(shipHubPath, 'utf8');
shipHub = replaceOnce(
  shipHub,
  "  const [message, setMessage] = useState(statusMessage || campaign.lastOutcome);",
  "  const [message, setMessage] = useState(campaign.lastOutcome);",
  'ShipHub local message initialization',
);
shipHub = replaceOnce(
  shipHub,
  "  const showStatusMessage = Boolean(message && message !== campaign.lastOutcome);",
  "  const displayedStatusMessage = statusMessage || (message && message !== campaign.lastOutcome ? message : '');",
  'ShipHub displayed status selection',
);
shipHub = replaceOnce(
  shipHub,
  "    {showStatusMessage && <div className=\"ship-status\" role=\"status\">{message}</div>}",
  "    {displayedStatusMessage && <div className=\"ship-status\" role={statusMessage ? 'alert' : 'status'} aria-live={statusMessage ? 'assertive' : 'polite'}>{displayedStatusMessage}</div>}",
  'ShipHub status rendering',
);
writeFileSync(shipHubPath, shipHub);

const uiTestPath = 'tests/ui-readability.ts';
let uiTest = readFileSync(uiTestPath, 'utf8');
const oldAssertion = "assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveGameState(profile, campaign)'), 'Local persistence failures are not surfaced to the player.');";
const newAssertion = "assert(app.includes('LOCAL SAVE FAILED') && app.includes('!saveGameState(profile, campaign)') && app.includes(\"current === persistenceWarning ? '' : current\") && shipHub.includes(\"const displayedStatusMessage = statusMessage ||\") && shipHub.includes(\"role={statusMessage ? 'alert' : 'status'}\"), 'Local persistence failures are not surfaced reliably to an already-mounted ShipHub.');";
uiTest = replaceOnce(uiTest, oldAssertion, newAssertion, 'persistence warning UI regression');
writeFileSync(uiTestPath, uiTest);

const workflowPath = '.github/workflows/fix-save-warning-visibility.yml';
const scriptPath = 'scripts/apply-save-warning-visibility.mjs';
if (existsSync(workflowPath)) unlinkSync(workflowPath);
if (existsSync(scriptPath)) unlinkSync(scriptPath);

console.log('SAVE_WARNING_VISIBILITY_PATCHED');
