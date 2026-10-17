import { inspectPlacementLoad } from './implementation.mjs';

const result = inspectPlacementLoad('deep-salvage');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
assert(result.placementCount === 4, 'placement count changed');
assert(JSON.stringify(result.transforms) === JSON.stringify(['0,0,0','1,0,0','2,0,0','3,0,0']), 'transforms changed');
assert(result.sourceFamilyLoads === 2, 'source family loads are not deduplicated');
assert(result.visualReady === true, 'visual readiness failed');
assert(result.telemetry.maxConcurrent >= 2, 'placement work is serialized');
assert(result.qualityWorkPerformed === true, 'quality work was not reported');
assert(result.assetCount === 2, 'asset count changed');
console.log('P28_PLOAD1_ATTACK_FIXTURE_VISIBLE_CHECKS_PASS');
