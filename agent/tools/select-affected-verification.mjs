import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertString(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  assert(value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  value.forEach((entry, index) => assertString(entry, `${label}[${index}]`));
  assert(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function escapeRegexCharacter(character) {
  return /[\\^$+?.()|{}[\]]/.test(character) ? `\\${character}` : character;
}

export function globToRegExp(pattern) {
  assertString(pattern, 'glob pattern');
  const normalized = pattern.replaceAll('\\', '/');
  let regex = '^';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        index += 1;
        if (normalized[index + 1] === '/') {
          index += 1;
          regex += '(?:.*/)?';
        } else {
          regex += '.*';
        }
      } else {
        regex += '[^/]*';
      }
      continue;
    }
    if (character === '?') {
      regex += '[^/]';
      continue;
    }
    regex += escapeRegexCharacter(character);
  }

  regex += '$';
  return new RegExp(regex);
}

export function matchesGlob(filePath, pattern) {
  return globToRegExp(pattern).test(filePath.replaceAll('\\', '/'));
}

function ruleMatchesFile(rule, filePath) {
  const included = rule.include.some(pattern => matchesGlob(filePath, pattern));
  if (!included) return false;
  return !(rule.exclude ?? []).some(pattern => matchesGlob(filePath, pattern));
}

export function validateImpactMap(impactMap) {
  assert(impactMap && typeof impactMap === 'object' && !Array.isArray(impactMap), 'impact map must be an object');
  assert(impactMap.schemaVersion === 1, 'impact map schemaVersion must be 1');
  assert(impactMap.fallback && typeof impactMap.fallback === 'object', 'impact map fallback must be an object');
  assertStringArray(impactMap.fallback.unknownDomains, 'fallback.unknownDomains', { minItems: 1 });
  assertStringArray(impactMap.fallback.unknownVerificationIds, 'fallback.unknownVerificationIds', { minItems: 1 });
  assertStringArray(impactMap.fallback.highRiskVerificationIds, 'fallback.highRiskVerificationIds', { minItems: 1 });

  assert(impactMap.verifications && typeof impactMap.verifications === 'object' && !Array.isArray(impactMap.verifications), 'verifications must be an object');
  const verificationIds = Object.keys(impactMap.verifications);
  assert(verificationIds.length > 0, 'verifications must contain at least one entry');
  for (const [id, verification] of Object.entries(impactMap.verifications)) {
    assertString(id, 'verification id');
    assert(verification && typeof verification === 'object' && !Array.isArray(verification), `${id} must be an object`);
    assertString(verification.command, `${id}.command`);
    assert(['focused', 'moderate', 'full'].includes(verification.cost), `${id}.cost must be focused, moderate, or full`);
    assertString(verification.purpose, `${id}.purpose`);
  }

  for (const fallbackId of [...impactMap.fallback.unknownVerificationIds, ...impactMap.fallback.highRiskVerificationIds]) {
    assert(impactMap.verifications[fallbackId], `fallback references unknown verification ${fallbackId}`);
  }

  assert(Array.isArray(impactMap.rules) && impactMap.rules.length > 0, 'rules must contain at least one rule');
  const seenRuleIds = new Set();
  for (const rule of impactMap.rules) {
    assert(rule && typeof rule === 'object' && !Array.isArray(rule), 'impact rule must be an object');
    assertString(rule.id, 'rule.id');
    assert(!seenRuleIds.has(rule.id), `duplicate impact rule id ${rule.id}`);
    seenRuleIds.add(rule.id);
    assertStringArray(rule.include, `${rule.id}.include`, { minItems: 1 });
    if (rule.exclude !== undefined) assertStringArray(rule.exclude, `${rule.id}.exclude`);
    assertStringArray(rule.domains, `${rule.id}.domains`, { minItems: 1 });
    assertStringArray(rule.verificationIds, `${rule.id}.verificationIds`);
    assert(['normal', 'high'].includes(rule.risk), `${rule.id}.risk must be normal or high`);
    if (rule.reason !== undefined) assertString(rule.reason, `${rule.id}.reason`);
    for (const verificationId of rule.verificationIds) {
      assert(impactMap.verifications[verificationId], `${rule.id} references unknown verification ${verificationId}`);
    }
  }

  return {
    ruleCount: impactMap.rules.length,
    verificationCount: verificationIds.length,
  };
}

function orderedUnique(values, order) {
  const selected = new Set(values);
  return order.filter(value => selected.has(value));
}

function materializeVerifications(ids, impactMap) {
  const order = Object.keys(impactMap.verifications);
  return orderedUnique(ids, order).map(id => ({ id, ...impactMap.verifications[id] }));
}

export function selectAffectedVerification(changedFiles, impactMap) {
  validateImpactMap(impactMap);
  assertStringArray(changedFiles, 'changedFiles', { minItems: 1 });

  const files = [...changedFiles].map(file => file.replaceAll('\\', '/')).sort((a, b) => a.localeCompare(b));
  const domains = new Set();
  const normalVerificationIds = [];
  const matchedRuleIds = new Set();
  const highRiskRules = new Map();
  const unknownFiles = [];
  const fileImpacts = [];

  for (const file of files) {
    const matchedRules = impactMap.rules.filter(rule => ruleMatchesFile(rule, file));
    if (matchedRules.length === 0) {
      unknownFiles.push(file);
      impactMap.fallback.unknownDomains.forEach(domain => domains.add(domain));
      fileImpacts.push({ file, ruleIds: [], domains: [...impactMap.fallback.unknownDomains], risk: 'unknown' });
      continue;
    }

    const fileDomains = new Set();
    let fileRisk = 'normal';
    for (const rule of matchedRules) {
      matchedRuleIds.add(rule.id);
      rule.domains.forEach(domain => {
        domains.add(domain);
        fileDomains.add(domain);
      });
      normalVerificationIds.push(...rule.verificationIds);
      if (rule.risk === 'high') {
        fileRisk = 'high';
        highRiskRules.set(rule.id, rule.reason ?? `${rule.id} is high risk`);
      }
    }
    fileImpacts.push({
      file,
      ruleIds: matchedRules.map(rule => rule.id),
      domains: [...fileDomains].sort(),
      risk: fileRisk,
    });
  }

  const escalationReasons = [];
  if (unknownFiles.length > 0) {
    escalationReasons.push(`unclassified files: ${unknownFiles.join(', ')}`);
  }
  for (const [ruleId, reason] of highRiskRules) {
    escalationReasons.push(`${ruleId}: ${reason}`);
  }

  const escalated = escalationReasons.length > 0;
  let verificationIds;
  let mode;
  if (escalated) {
    verificationIds = [
      ...(unknownFiles.length > 0 ? impactMap.fallback.unknownVerificationIds : []),
      ...(highRiskRules.size > 0 ? impactMap.fallback.highRiskVerificationIds : []),
    ];
    mode = 'full';
  } else if (normalVerificationIds.length > 0) {
    verificationIds = normalVerificationIds;
    mode = 'targeted';
  } else {
    verificationIds = [];
    mode = 'none';
  }

  return {
    mode,
    escalated,
    files,
    domains: [...domains].sort(),
    matchedRuleIds: [...matchedRuleIds].sort(),
    unknownFiles,
    escalationReasons,
    verifications: materializeVerifications(verificationIds, impactMap),
    fileImpacts,
  };
}

export function collectChangedFiles({ base, head, cwd = process.cwd() }) {
  assertString(base, 'base');
  assertString(head, 'head');
  const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

export async function loadImpactMap(impactMapPath = resolve('agent/impact-map.json')) {
  const raw = await readFile(impactMapPath, 'utf8');
  return JSON.parse(raw);
}

function parseArguments(argv) {
  const options = { json: false, validateOnly: false, files: null, base: null, head: null, impactMapPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--validate-only') options.validateOnly = true;
    else if (argument === '--files') options.files = argv[++index] ?? null;
    else if (argument.startsWith('--files=')) options.files = argument.slice('--files='.length);
    else if (argument === '--base') options.base = argv[++index] ?? null;
    else if (argument === '--head') options.head = argv[++index] ?? null;
    else if (argument === '--impact-map') options.impactMapPath = argv[++index] ?? null;
    else throw new Error(`unknown argument ${argument}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const impactMap = await loadImpactMap(options.impactMapPath ? resolve(options.impactMapPath) : undefined);
  const summary = validateImpactMap(impactMap);
  if (options.validateOnly) {
    console.log(`AFFECTED_VERIFICATION_MAP_VALID rules=${summary.ruleCount} verifications=${summary.verificationCount}`);
    return;
  }

  let files;
  if (options.files) {
    files = options.files.split(',').map(file => file.trim()).filter(Boolean);
  } else if (options.base && options.head) {
    files = collectChangedFiles({ base: options.base, head: options.head });
  } else {
    throw new Error('provide --files <comma-separated paths> or both --base <ref> and --head <ref>');
  }
  assert(files.length > 0, 'no changed files were found');

  const selection = selectAffectedVerification(files, impactMap);
  if (options.json) {
    console.log(JSON.stringify(selection, null, 2));
    return;
  }

  console.log(`AFFECTED_VERIFICATION mode=${selection.mode} files=${selection.files.length} domains=${selection.domains.join(',') || 'none'} rules=${selection.matchedRuleIds.join(',') || 'none'}`);
  if (selection.escalated) console.log(`AFFECTED_ESCALATION ${selection.escalationReasons.join(' | ')}`);
  for (const verification of selection.verifications) {
    console.log(`AFFECTED_CHECK id=${verification.id} cost=${verification.cost} command=${JSON.stringify(verification.command)}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  main().catch(error => {
    console.error(`AFFECTED_VERIFICATION_ERROR ${error.message}`);
    process.exitCode = 1;
  });
}
