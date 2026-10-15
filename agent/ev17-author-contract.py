from pathlib import Path

agents_path = Path('AGENTS.md')
workflow_path = Path('.github/workflows/ev17-contract-authoring.yml')
script_path = Path('agent/ev17-author-contract.py')

text = agents_path.read_text()
source = "- `agent/proof-cache.json`, `agent/proof-cache-history.json`, `agent/proof-cache.schema.json`, and `agent/tools/causal-proof-cache.mjs` — advisory EV-6 causal proof-cache shadow system. It hashes exact repository inputs plus execution context for selected expensive proofs, validates retained observations against their exact Git SHAs, predicts reuse before the real proof reruns, and disables reuse on same-closure disagreement.\n"
addition = source + "- `agent/proof-cache-calibration-corpus.json`, `agent/tools/proof-cache-calibration-evidence.mjs`, `agent/tests/proof-cache-calibration-evidence.mjs`, and `.github/workflows/ev17-proof-cache-calibration.yml` — EV-17 exact-SHA advisory proof-cache calibration contract. It reruns each measured proof across an exact-candidate baseline, an excluded-input same-closure control, a benign included-input invalidation, and a representative failing invalidation; measures false hits, false misses, and same-closure disagreement; restores the exact candidate after every disposable mutation; audits required repository/runtime closure; and may name an EV-18 reuse candidate only when the zero false-hit/disagreement budget and complete immutable environment closure both hold.\n"
if text.count(source) != 1:
    raise SystemExit(f'expected one EV-6 source-of-truth line, found {text.count(source)}')
if 'agent/proof-cache-calibration-corpus.json' not in text:
    text = text.replace(source, addition, 1)

rule = "- EV-6 proof-cache predictions remain advisory unless a future promoted repository rule explicitly enables reuse. A matching causal-closure digest may only predict what a real rerun should do in shadow mode; every current proof still reruns, any same-closure outcome disagreement disables reuse for that proof class, and no prediction may waive, replace, or synthesize an existing exact-SHA proof gate.\n"
rule_addition = rule + "- EV-17 remains calibration-only. Its evidence must rerun the real proof, measure false hits, false misses, and same-closure disagreement against a zero false-hit/disagreement budget, document every repository/runtime input required for causal closure, and restore the exact candidate after disposable probes. A mutable runner alias such as `ubuntu-latest` is not an immutable runner-image identity; any required environment input that is not causally bound blocks that proof class from EV-18 eligibility even when observed reruns agree. EV-17 never enables reuse, grants candidate acceptance, or edits `agent/proof-cache.json`/history to manufacture eligibility.\n"
if text.count(rule) != 1:
    raise SystemExit(f'expected one EV-6 execution rule, found {text.count(rule)}')
if '- EV-17 remains calibration-only.' not in text:
    text = text.replace(rule, rule_addition, 1)

agents_path.write_text(text)
script_path.unlink()
workflow_path.unlink()
