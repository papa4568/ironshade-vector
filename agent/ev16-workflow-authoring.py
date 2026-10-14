import base64
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    p.write_text(text.replace(old, new, 1))


replace_once(
    '.github/workflows/ev15-impact-calibration.yml',
    "    timeout-minutes: 30\n    steps:",
    "    timeout-minutes: 30\n    env:\n      IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0'\n    steps:",
)

replace_once(
    '.github/workflows/agent-orchestration.yml',
    "      - name: Run affected-verification regressions\n        run: node agent/tests/affected-verification.mjs\n\n      - name: Run candidate evidence regressions",
    "      - name: Run affected-verification regressions\n        run: node agent/tests/affected-verification.mjs\n\n      - name: Run promoted impact-widening regressions\n        run: node agent/tests/impact-widening-promotion.mjs\n\n      - name: Enforce EV-16 impact-widening scope and rollback contract\n        env:\n          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n        run: |\n          mkdir -p .agent-impact-widening\n          node agent/tools/impact-widening-promotion.mjs \\\n            --candidate-sha \"$CANDIDATE_SHA\" \\\n            --output .agent-impact-widening/promotion.json\n\n      - name: Upload exact-SHA EV-16 impact-widening evidence\n        uses: actions/upload-artifact@v7\n        with:\n          name: impact-widening-ev16-${{ github.event_name == 'pull_request' && github.event.pull_request.number || 'push' }}-${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}\n          path: .agent-impact-widening/promotion.json\n          if-no-files-found: error\n          include-hidden-files: true\n          retention-days: 30\n\n      - name: Run candidate evidence regressions",
)

workflow = r'''name: EV-16 Impact Widening Promotion

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main
    paths:
      - 'agent/impact-map.json'
      - 'agent/impact-map.schema.json'
      - 'agent/impact-calibration-corpus.json'
      - 'agent/tools/select-affected-verification.mjs'
      - 'agent/tools/impact-widening-promotion.mjs'
      - 'agent/tests/affected-verification.mjs'
      - 'agent/tests/impact-widening-promotion.mjs'
      - '.github/workflows/ev15-impact-calibration.yml'
      - '.github/workflows/ev16-impact-widening.yml'
      - 'AGENTS.md'
      - 'docs/experimental-verification-roadmap.md'
      - 'docs/experimental-verification-archive.md'

permissions:
  contents: read

jobs:
  promotion-gate:
    name: Exact Candidate Impact Widening
    runs-on: ubuntu-24.04
    timeout-minutes: 8
    steps:
      - name: Check out exact candidate revision
        uses: actions/checkout@v7
        with:
          ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
          fetch-depth: 0
          persist-credentials: false

      - uses: actions/setup-node@v7
        with:
          node-version: '22.23.2'

      - name: Run EV-16 promotion regressions
        run: |
          node agent/tests/affected-verification.mjs
          node agent/tests/impact-widening-promotion.mjs

      - name: Generate exact-SHA EV-16 promotion evidence
        env:
          CANDIDATE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
          mkdir -p .agent-impact-widening-ev16
          node agent/tools/impact-widening-promotion.mjs \
            --candidate-sha "$CANDIDATE_SHA" \
            --output .agent-impact-widening-ev16/promotion.json
          node --input-type=module <<'NODE'
          import { readFileSync } from 'node:fs';
          const report = JSON.parse(readFileSync('.agent-impact-widening-ev16/promotion.json', 'utf8'));
          const fail = message => { throw new Error(`EV16_EXACT_EVIDENCE_FAIL ${message}`); };
          if (report.taskId !== 'EV-16' || report.candidateSha !== process.env.CANDIDATE_SHA) fail('task/candidate binding mismatch');
          if (report.selectedRuleId !== 'ui-and-design-system' || report.resultingVerification !== 'verify-full') fail('promoted scope drifted');
          if (report.calibration.measuredErrors.falsePositives !== 0 || report.calibration.measuredErrors.falseNegatives !== 0) fail('promotion error budget exceeded');
          if (report.rollback.restoresPreviousStaticBehavior !== true) fail('rollback no longer restores the prior selector behavior');
          if (report.acceptedForEnforcement !== true || report.blocking !== true || report.candidatePassGranted !== false) fail('promotion enforcement semantics drifted');
          console.log(`EV16_EXACT_EVIDENCE_PASS candidate=${report.candidateSha} rule=${report.selectedRuleId} falsePositives=0 falseNegatives=0 rollback=verified`);
          NODE

      - name: Upload exact-SHA EV-16 promotion evidence
        uses: actions/upload-artifact@v7
        with:
          name: impact-widening-ev16-${{ github.event_name == 'pull_request' && github.event.pull_request.number || 'push' }}-${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}
          path: .agent-impact-widening-ev16/promotion.json
          if-no-files-found: error
          include-hidden-files: true
          retention-days: 30
'''
Path('.github/workflows/ev16-impact-widening.yml').write_text(workflow)

repo = os.environ['GITHUB_REPOSITORY']
token = os.environ['GITHUB_TOKEN']
for path in [
    '.github/workflows/agent-orchestration.yml',
    '.github/workflows/ev15-impact-calibration.yml',
    '.github/workflows/ev16-impact-widening.yml',
]:
    encoded = base64.b64encode(Path(path).read_bytes()).decode('ascii')
    payload = json.dumps({'content': encoded, 'encoding': 'base64'}).encode('utf-8')
    request = Request(
        f'https://api.github.com/repos/{repo}/git/blobs',
        data=payload,
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
    )
    with urlopen(request) as response:
        result = json.load(response)
    print(f"EV16_WORKFLOW_BLOB path={path} sha={result['sha']}")
