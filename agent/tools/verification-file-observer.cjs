const fs = require('node:fs');
const path = require('node:path');
const { syncBuiltinESMExports } = require('node:module');

const target = process.env.IRONSHADE_OBSERVED_FILE ? path.resolve(process.env.IRONSHADE_OBSERVED_FILE) : null;
const logPath = process.env.IRONSHADE_OBSERVATION_LOG ? path.resolve(process.env.IRONSHADE_OBSERVATION_LOG) : null;
const seen = new Set();

function asPath(value) {
  if (typeof value === 'string' || Buffer.isBuffer(value) || value instanceof URL) {
    try {
      return path.resolve(String(value instanceof URL ? value.pathname : value));
    } catch {
      return null;
    }
  }
  return null;
}

function note(value) {
  if (!target || !logPath) return;
  const candidate = asPath(value);
  if (candidate !== target) return;
  const key = `${process.pid}:${candidate}`;
  if (seen.has(key)) return;
  seen.add(key);
  fs.appendFileSync(logPath, `${candidate}\n`, 'utf8');
}

const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function observedReadFileSync(file, ...args) {
  note(file);
  return originalReadFileSync.call(this, file, ...args);
};

const originalReadFile = fs.readFile;
fs.readFile = function observedReadFile(file, ...args) {
  note(file);
  return originalReadFile.call(this, file, ...args);
};

const originalOpenSync = fs.openSync;
fs.openSync = function observedOpenSync(file, ...args) {
  note(file);
  return originalOpenSync.call(this, file, ...args);
};

const originalOpen = fs.open;
fs.open = function observedOpen(file, ...args) {
  note(file);
  return originalOpen.call(this, file, ...args);
};

const originalPromiseReadFile = fs.promises.readFile.bind(fs.promises);
fs.promises.readFile = async function observedPromiseReadFile(file, ...args) {
  note(file);
  return originalPromiseReadFile(file, ...args);
};

const originalPromiseOpen = fs.promises.open.bind(fs.promises);
fs.promises.open = async function observedPromiseOpen(file, ...args) {
  note(file);
  return originalPromiseOpen(file, ...args);
};

syncBuiltinESMExports();
