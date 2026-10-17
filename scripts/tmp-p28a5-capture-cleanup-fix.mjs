import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/p28a5-image-grade-capture.mjs';
let source = await readFile(path, 'utf8');

const before = `  const restored = await evaluate(\`(() => {\n    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n    if (!(canvas instanceof HTMLCanvasElement)) return false;\n    delete canvas.dataset.refineryImageGradeQa;\n    return true;\n  })()\`);\n  if (!restored) throw new Error('Could not clear the P28-A5 low-visibility QA grade.');\n  await waitFor(\`(() => {\n    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n    return canvas?.dataset.environmentImageGradeMode === 'normal'\n      && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1');\n  })()\`, 'restored normal Flagship refinery grade');`;

const after = `  const restoreState = await evaluate(\`(() => {\n    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n    if (!(canvas instanceof HTMLCanvasElement)) return 'not-mounted';\n    delete canvas.dataset.refineryImageGradeQa;\n    return 'cleared';\n  })()\`);\n  if (restoreState === 'cleared') {\n    await waitFor(\`(() => {\n      const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n      return canvas?.dataset.environmentImageGradeMode === 'normal'\n        && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.055:contrast-0.985:grade-p28-a5-dark-separation-v1');\n    })()\`, 'restored normal Flagship refinery grade');\n  } else if (restoreState !== 'not-mounted') {\n    throw new Error(\`Could not clear the P28-A5 low-visibility QA grade: \${String(restoreState)}\`);\n  }`;

const first = source.indexOf(before);
if (first < 0) throw new Error('P28-A5 cleanup block was not found exactly once.');
if (source.indexOf(before, first + before.length) >= 0) throw new Error('P28-A5 cleanup block appeared more than once.');
source = source.slice(0, first) + after + source.slice(first + before.length);
await writeFile(path, source);
console.log('P28_A5_CAPTURE_CLEANUP_FIX_PASS live=restore-and-verify unmounted=already-clean');
