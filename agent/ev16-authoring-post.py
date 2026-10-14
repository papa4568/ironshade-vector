from pathlib import Path
import subprocess


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one replacement target, found {count}')
    p.write_text(text.replace(old, new, 1))


# Existing workflows are not changed by the Actions-authored commit because the
# workflow token cannot update workflow files. The permanent EV-16 workflow is
# added separately through the trusted GitHub repository connection.
subprocess.run([
    'git', 'restore', '--source=HEAD', '--',
    '.github/workflows/agent-orchestration.yml',
    '.github/workflows/ev15-impact-calibration.yml',
    '.github/workflows/ev16-authoring.yml',
], check=True)
Path('.github/workflows/ev16-impact-widening.yml').unlink(missing_ok=True)

# EV-15 remains reproducible after EV-16 by explicitly selecting the promoted
# rule's rollback semantics inside the archived calibration path rather than by
# changing the EV-15 workflow itself.
replace_once(
    'agent/tools/impact-calibration-evidence.mjs',
    '  const selection = selectAffectedVerification(probe.changedFiles, impactMap);',
    "  const selection = selectAffectedVerification(probe.changedFiles, impactMap, { env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' } });",
)
replace_once(
    'agent/tests/impact-calibration-evidence.mjs',
    "assert.equal(process.env.IRONSHADE_IMPACT_WIDENING_ENFORCEMENT, '0', 'EV-15 post-promotion reproduction must run with EV-16 rollback enabled');\n",
    '',
)
replace_once(
    'agent/tests/impact-calibration-evidence.mjs',
    '  const selection = selectAffectedVerification(probe.changedFiles, impactMap);',
    "  const selection = selectAffectedVerification(probe.changedFiles, impactMap, { env: { IRONSHADE_IMPACT_WIDENING_ENFORCEMENT: '0' } });",
)

Path('agent/ev16-authoring-post.py').unlink()
