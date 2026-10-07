import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertRoadmapMetadataInSync,
  parseRoadmap,
  synchronizeRoadmapMetadata,
  validateRoadmapMetadata,
} from './roadmap-adapter.mjs';

async function main() {
  const metadataPath = resolve('agent/roadmap-metadata.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  validateRoadmapMetadata(metadata);
  const roadmap = await readFile(resolve(metadata.roadmap), 'utf8');
  const tasks = parseRoadmap(roadmap);

  if (process.argv.includes('--write')) {
    const synchronized = synchronizeRoadmapMetadata(metadata, tasks);
    await writeFile(metadataPath, `${JSON.stringify(synchronized, null, 2)}\n`, 'utf8');
    console.log(`ROADMAP_METADATA_SYNCED tasks=${tasks.length} first=${tasks[0]?.id ?? 'none'} path=${metadataPath}`);
    return;
  }

  assertRoadmapMetadataInSync(tasks, metadata);
  console.log(`ROADMAP_METADATA_IN_SYNC tasks=${tasks.length} first=${tasks[0]?.id ?? 'none'}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`ROADMAP_METADATA_DRIFT ${error.message}`);
    process.exitCode = 1;
  });
}
