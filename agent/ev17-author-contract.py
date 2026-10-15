from pathlib import Path

agents_path = Path('AGENTS.md')
workflow_path = Path('.github/workflows/ev17-contract-authoring.yml')
script_path = Path('agent/ev17-author-contract.py')

text = agents_path.read_text()
source = "- `agent/proof-cache.json`, `agent/proof-cache-history.json`, `agent/proof-cache.schema.json`, and `agent/tools/causal-proof-cache.mjs` — advisory EV-6 causal proof-cache shadow system. It hashes exact repository inputs plus execution context for selected expensive proofs, validates retained observations against their exact Git SHAs, predicts reuse before the real proof reruns, and disables reuse on same-closure disagreement.\n"
addition = source + "- `agent/proof-cache-calibration-corpus.json`, `agent/tools/proof-cache-calibration-evidence.mjs`, `agent/tests/proof-cache-calibration-evidence.mjs`, and `.github/workflows/ev17-proof-cache-calibration.yml` — EV-17 exact-SHA advisory proof-cache calibration contract. It reruns each measured proof across an exact-candidate baseline, an excluded-input same-closure control covering every EV-6 repository exclusion category, a benign included-input invalidation, and a representative failing invalidation; measures false hits, false misses, and same-closure disagreement; audits retained same-closure history plus runner/image/toolchain/environment closure; proves each captured runtime dimension invalidates the closure digest; restores the exact candidate after every disposable mutation; and may name only proof classes that satisfy the reviewed EV-18 eligibility boundary.\n"
if text.count(source) != 1:
    raise SystemExit(f'expected one EV-6 source-of-truth line, found {text.count(source)}')
if 'agent/proof-cache-calibration-corpus.json' not in text:
    text = text.replace(source, addition, 1)

rule = "- EV-6 proof-cache predictions remain advisory unless a future promoted repository rule explicitly enables reuse. A matching causal-closure digest may only predict what a real rerun should do in shadow mode; every current proof still reruns, any same-closure outcome disagreement disables reuse for that proof class, and no prediction may waive, replace, or synthesize an existing exact-SHA proof gate.\n"
rule_addition = rule + "- EV-17 remains calibration-only. Its exact-SHA evidence must rerun the real proof, measure false hits, false misses, and same-closure disagreement with zero false-hit and zero same-closure-disagreement budgets, include at least two successful runs for the measured same closure, exercise every excluded repository-input category in one same-closure control, prove an included benign change invalidates conservatively, prove a representative included defect invalidates and fails the real proof, authenticate retained EV-6 history against Git, and restore the exact candidate after every disposable probe. Runtime closure for `full-repository-build` is complete only when the pinned runner label plus `ImageOS`, `ImageVersion`, Node, npm, platform, architecture, and `VITE_API_BASE_URL` presence/value fingerprint are represented and every captured dimension changes the closure digest when varied. Any unresolved closure gap or retained/new same-closure disagreement blocks EV-18 eligibility. A benign false miss is reported as conservative lost reuse opportunity, not as permission to weaken a gate. EV-17 never enables reuse, grants candidate acceptance, or edits EV-6 policy/history to manufacture eligibility.\n"
if text.count(rule) != 1:
    raise SystemExit(f'expected one EV-6 execution rule, found {text.count(rule)}')
if '- EV-17 remains calibration-only.' not in text:
    text = text.replace(rule, rule_addition, 1)

agents_path.write_text(text)
script_path.unlink()
workflow_path.unlink()
