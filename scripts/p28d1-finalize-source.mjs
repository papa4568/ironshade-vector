import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceOnce(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  writeFileSync(path, source.replace(oldText, newText));
}

replaceOnce(
  'src/game/graphicsAssetManifest.ts',
  `  stormBusIsolator: {
    id: 'jovian-harvester-storm-bus-isolator',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod2', 'interactable', '/assets/models/interactables/spin-habitat-spin-bus-isolator-lod2.glb', 2),
    },
  },`,
  `  stormBusIsolator: {
    id: 'jovian-harvester-storm-bus-isolator',
    lods: {
      1: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod1', 'interactable', '/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod1.glb', 1),
      2: createGraphicsAssetSpec('jovian-harvester-storm-bus-isolator-lod2', 'interactable', '/assets/models/interactables/jovian-harvester-storm-bus-isolator-lod2.glb', 2),
    },
  },`,
);
replaceOnce(
  'src/game/graphicsAssetManifest.ts',
  '// Hero-quality LOD0 will be added after the animation and socket contract is proven.\n',
  '// The generic field suit remains LOD1/LOD2; class families may add proven hero LOD0 assets.\n',
);

replaceOnce('scripts/prepare-vanguard-operator-lod0.mjs', "import { deflateSync } from 'node:zlib';\n", '');
replaceOnce(
  'scripts/prepare-vanguard-operator-lod0.mjs',
  `function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
`,
  `function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(buffer) {
  let a = 1;
  let b = 0;
  for (const value of buffer) {
    a = (a + value) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function encodeStoredZlib(buffer) {
  if (buffer.length > 0xffff) throw new Error(\`Stored zlib payload is too large: \${buffer.length}\`);
  const blockHeader = Buffer.alloc(5);
  blockHeader[0] = 0x01;
  blockHeader.writeUInt16LE(buffer.length, 1);
  blockHeader.writeUInt16LE((~buffer.length) & 0xffff, 3);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(adler32(buffer), 0);
  return Buffer.concat([Buffer.from([0x78, 0x01]), blockHeader, buffer, checksum]);
}
`,
);
replaceOnce(
  'scripts/prepare-vanguard-operator-lod0.mjs',
  "pngChunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),",
  "pngChunk('IDAT', encodeStoredZlib(Buffer.concat(rows))),",
);

const browser = 'scripts/browser-runtime-smoke.mjs';
replaceOnce(browser, "/^authored-[12]-babylon$/.test(canvas?.dataset.operatorVisual ?? '')", "/^authored-[012]-babylon$/.test(canvas?.dataset.operatorVisual ?? '')");
replaceOnce(
  browser,
  `  const expectedPlayerLod = state.renderTier === 'performance' ? 2 : 1;
  const expectedOperatorAsset = state.operatorClass && state.operatorClass !== 'generic'
    ? \`operator-\${state.operatorClass}-lod\${expectedPlayerLod}\`
    : \`operator-field-suit-lod\${expectedPlayerLod}\`;`,
  `  const expectedSharedLod = state.renderTier === 'performance' ? 2 : 1;
  const expectedOperatorLod = state.operatorClass === 'vanguard' && state.renderTier === 'high' ? 0 : expectedSharedLod;
  const expectedOperatorAsset = state.operatorClass && state.operatorClass !== 'generic'
    ? \`operator-\${state.operatorClass}-lod\${expectedOperatorLod}\`
    : \`operator-field-suit-lod\${expectedSharedLod}\`;`,
);
replaceOnce(browser, 'state.operatorVisual !== `authored-${expectedPlayerLod}-babylon`', 'state.operatorVisual !== `authored-${expectedOperatorLod}-babylon`');
replaceOnce(browser, 'state.weaponAsset !== `weapon-${state.weaponActive}-lod${expectedPlayerLod}`', 'state.weaponAsset !== `weapon-${state.weaponActive}-lod${expectedSharedLod}`');
replaceOnce(browser, 'const expectedEnemyAssets = expectedEnemyRoles.map(role => `enemy-${role}-lod${expectedPlayerLod}`);', 'const expectedEnemyAssets = expectedEnemyRoles.map(role => `enemy-${role}-lod${expectedSharedLod}`);');
replaceOnce(browser, 'state.enemyCatalogLod !== String(expectedPlayerLod)', 'state.enemyCatalogLod !== String(expectedSharedLod)');
replaceOnce(
  browser,
  `  const expectedCombatLod = coarseCombatSurface ? '2' : '1';
  await waitFor(\`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.operatorClassAsset === 'vanguard'
      && canvas?.dataset.operatorVisual === 'authored-\${expectedCombatLod}'
      && (canvas?.dataset.operatorAsset ?? '').includes('operator-vanguard-lod\${expectedCombatLod}')
      && (canvas?.dataset.weaponAsset ?? '').includes('weapon-breacher-lod\${expectedCombatLod}');
  })()\`, 'Vanguard authored mobile combat assets', 20_000);
  console.log(\`BROWSER_MOBILE_ASSET_PASS viewport=\${viewportMode} icons=loaded operatorLod=\${expectedCombatLod} weaponLod=\${expectedCombatLod}\`);`,
  `  const expectedOperatorLod = coarseCombatSurface ? '2' : '0';
  const expectedWeaponLod = coarseCombatSurface ? '2' : '1';
  await waitFor(\`(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.dataset.operatorClassAsset === 'vanguard'
      && canvas?.dataset.operatorVisual === 'authored-\${expectedOperatorLod}'
      && (canvas?.dataset.operatorAsset ?? '').includes('operator-vanguard-lod\${expectedOperatorLod}')
      && (canvas?.dataset.weaponAsset ?? '').includes('weapon-breacher-lod\${expectedWeaponLod}');
  })()\`, 'Vanguard authored mobile combat assets', 20_000);
  console.log(\`BROWSER_MOBILE_ASSET_PASS viewport=\${viewportMode} icons=loaded operatorLod=\${expectedOperatorLod} weaponLod=\${expectedWeaponLod}\`);`,
);

const capture = 'scripts/p28a5-image-grade-capture.mjs';
replaceOnce(
  capture,
  "// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'; visualDetail: 'p28-c8-refinery-world-authored-mappings'; visualDetail: 'p28-c9-refinery-geometry-reuse'",
  "// Historical proof markers retained for completed candidates: visualDetail: 'p28-c5-refinery-processor-lod0'; visualDetail: 'p28-c6-refinery-terminal-lod0'; visualDetail: 'p28-c7-refinery-crate-lod0'; visualDetail: 'p28-c8-refinery-world-authored-mappings'; visualDetail: 'p28-c9-refinery-geometry-reuse'; visualDetail: 'p28-d0-premium-character-source'",
);
replaceOnce(capture, "    refineryWorldFallbackCount: Number(canvas.dataset.refineryWorldFallbackCount ?? 0),\n    assetRuntime: canvas.dataset.babylonWorldRuntime ?? '',", "    refineryWorldFallbackCount: Number(canvas.dataset.refineryWorldFallbackCount ?? 0),\n    operatorVisual: canvas.dataset.operatorVisual ?? '',\n    operatorAsset: canvas.dataset.operatorAsset ?? '',\n    operatorClassAsset: canvas.dataset.operatorClassAsset ?? '',\n    operatorRig: canvas.dataset.operatorRig ?? '',\n    operatorSocket: canvas.dataset.operatorSocket ?? '',\n    assetRuntime: canvas.dataset.babylonWorldRuntime ?? '',");
replaceOnce(capture, "      && canvas?.dataset.environmentImageGradeMode === 'normal';", "      && canvas?.dataset.environmentImageGradeMode === 'normal'\n      && canvas?.dataset.operatorVisual === 'authored-0-babylon'\n      && canvas?.dataset.operatorAsset === 'operator-vanguard-lod0';");
replaceOnce(capture, "    || normal.refineryWorldFallbackCount !== 0\n    || !normal.assetRuntime.includes('cached:')", "    || normal.refineryWorldFallbackCount !== 0\n    || normal.operatorVisual !== 'authored-0-babylon'\n    || normal.operatorAsset !== 'operator-vanguard-lod0'\n    || normal.operatorClassAsset !== 'vanguard'\n    || normal.operatorRig !== 'articulated'\n    || normal.operatorSocket !== 'weapon-socket'\n    || !normal.assetRuntime.includes('cached:')");
replaceOnce(capture, "    || lowVisibility.mode !== 'low-visibility'\n    || !/^aces-exposure-\\d+\\.\\d{2}\\+contrast-\\d+\\.\\d{2}$/.test(lowVisibility.tone)", "    || lowVisibility.mode !== 'low-visibility'\n    || lowVisibility.operatorVisual !== 'authored-0-babylon'\n    || lowVisibility.operatorAsset !== 'operator-vanguard-lod0'\n    || !/^aces-exposure-\\d+\\.\\d{2}\\+contrast-\\d+\\.\\d{2}$/.test(lowVisibility.tone)");
replaceOnce(capture, "    visualDetail: 'p28-d0-premium-character-source',", "    visualDetail: 'p28-d1-vanguard-operator-lod0',");
replaceOnce(capture, 'detail=p28-d0-premium-character-source', 'detail=p28-d1-vanguard-operator-lod0');

execFileSync(process.execPath, ['--check', 'scripts/prepare-vanguard-operator-lod0.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', 'scripts/browser-runtime-smoke.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', 'scripts/p28a5-image-grade-capture.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/prepare-vanguard-operator-lod0.mjs'], { stdio: 'inherit' });
