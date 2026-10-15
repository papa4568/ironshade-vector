from pathlib import Path

corpus_path = Path('agent/proof-cache-calibration-corpus.json')
tool_path = Path('agent/tools/proof-cache-calibration-evidence.mjs')
script_path = Path('agent/ev17-fix-excluded-prefix-probe.py')
workflow_path = Path('.github/workflows/ev17-excluded-prefix-probe-fix.yml')

corpus = corpus_path.read_text()
old_android = '''            {
              "targetPath": "android/gradle.properties",
              "mutationSuffix": "\\n# EV-17 disposable excluded android control\\n"
            },'''
new_android = '''            {
              "targetPath": "android/.ev17-excluded-control",
              "createContent": "EV-17 disposable excluded android control\\n"
            },'''
if corpus.count(old_android) != 1:
    raise SystemExit(f'expected one android mutation anchor, found {corpus.count(old_android)}')
corpus = corpus.replace(old_android, new_android, 1)
corpus_path.write_text(corpus)

tool = tool_path.read_text()
old_validation = '''      for (const mutation of probe.mutations) {
        assertString(mutation.targetPath, `${probe.id}.mutations.targetPath`);
        assertString(mutation.mutationSuffix, `${probe.id}.mutations.mutationSuffix`);
        assert(!targets.has(mutation.targetPath), `${probe.id} repeats target ${mutation.targetPath}`);
        targets.add(mutation.targetPath);
      }
'''
new_validation = '''      for (const mutation of probe.mutations) {
        assertString(mutation.targetPath, `${probe.id}.mutations.targetPath`);
        const hasSuffix = typeof mutation.mutationSuffix === 'string' && mutation.mutationSuffix.length > 0;
        const hasCreate = typeof mutation.createContent === 'string' && mutation.createContent.length > 0;
        assert(hasSuffix !== hasCreate, `${probe.id}.${mutation.targetPath} must define exactly one of mutationSuffix or createContent`);
        assert(!targets.has(mutation.targetPath), `${probe.id} repeats target ${mutation.targetPath}`);
        targets.add(mutation.targetPath);
      }
'''
if tool.count(old_validation) != 1:
    raise SystemExit(f'expected one mutation validation anchor, found {tool.count(old_validation)}')
tool = tool.replace(old_validation, new_validation, 1)

old_apply = '''    for (const mutation of probe.mutations) {
      const path = resolve(mutation.targetPath);
      const content = await readFile(path, 'utf8');
      originals.push({ targetPath: mutation.targetPath, path, content, digest: sha256(content) });
      await writeFile(path, `${content}${mutation.mutationSuffix}`, 'utf8');
    }
'''
new_apply = '''    for (const mutation of probe.mutations) {
      const path = resolve(mutation.targetPath);
      if (typeof mutation.createContent === 'string') {
        let existed = true;
        try {
          await readFile(path, 'utf8');
        } catch (error) {
          if (error?.code === 'ENOENT') existed = false;
          else throw error;
        }
        assert(!existed, `${probe.id} create-only target already exists: ${mutation.targetPath}`);
        originals.push({ targetPath: mutation.targetPath, path, existed: false });
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, mutation.createContent, 'utf8');
      } else {
        const content = await readFile(path, 'utf8');
        originals.push({ targetPath: mutation.targetPath, path, existed: true, digest: sha256(content) });
        await writeFile(path, `${content}${mutation.mutationSuffix}`, 'utf8');
      }
    }
'''
if tool.count(old_apply) != 1:
    raise SystemExit(f'expected one mutation apply anchor, found {tool.count(old_apply)}')
tool = tool.replace(old_apply, new_apply, 1)

old_restore = '''  for (const original of originals) {
    const restored = await readFile(original.path, 'utf8');
    assert(sha256(restored) === original.digest, `${probe.id} did not restore ${original.targetPath}`);
  }
'''
new_restore = '''  for (const original of originals) {
    if (original.existed) {
      const restored = await readFile(original.path, 'utf8');
      assert(sha256(restored) === original.digest, `${probe.id} did not restore ${original.targetPath}`);
    } else {
      let absent = false;
      try {
        await readFile(original.path, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT') absent = true;
        else throw error;
      }
      assert(absent, `${probe.id} did not remove created target ${original.targetPath}`);
    }
  }
'''
if tool.count(old_restore) != 1:
    raise SystemExit(f'expected one mutation restore anchor, found {tool.count(old_restore)}')
tool = tool.replace(old_restore, new_restore, 1)
tool_path.write_text(tool)

script_path.unlink()
workflow_path.unlink()
