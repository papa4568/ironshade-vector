import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`P28-A5 atomic state fix missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`P28-A5 atomic state fix found duplicate ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const path = 'scripts/p28a5-image-grade-capture.mjs';
let source = await readFile(path, 'utf8');
source = replaceOnce(
  source,
  `  while (Date.now() < deadline) {\n    if (await evaluate(expression)) return;\n    await sleep(100);\n  }\n`,
  `  while (Date.now() < deadline) {\n    const value = await evaluate(expression);\n    if (value) return value;\n    await sleep(100);\n  }\n`,
  'waitFor return value',
);
source = replaceOnce(
  source,
  `  await waitFor(\`(() => {\n    const canvas = [...document.querySelectorAll('canvas')].find(candidate => candidate.dataset.environmentVisual === 'authored-refinery-babylon');\n    return canvas?.dataset.environmentImageGradeMode === 'low-visibility'\n      && canvas?.dataset.environmentAtmosphere?.includes('near-14.0:far-32.0')\n      && canvas?.dataset.environmentAtmosphere?.includes('exposure-1.080:contrast-0.965:grade-p28-a5-dark-separation-v1');\n  })()\`, 'low-visibility Flagship refinery grade');\n  await sleep(300);\n\n  const lowVisibility = await evaluate(readGradeStateExpression);\n`,
  `  const lowVisibility = await waitFor(\`(() => {\n    const state = ${'${'}readGradeStateExpression};\n    return state?.mode === 'low-visibility'\n      && state.atmosphere.includes('near-14.0:far-32.0')\n      && state.atmosphere.includes('exposure-1.080:contrast-0.965:grade-p28-a5-dark-separation-v1')\n      ? state\n      : false;\n  })()\`, 'low-visibility Flagship refinery grade');\n`,
  'atomic low-visibility state capture',
);
await writeFile(path, source);
console.log('P28_A5_ATOMIC_GRADE_STATE_FIX_PASS waitFor=returns-value lowVisibility=atomic-state');
