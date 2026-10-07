const originalMatch = String.prototype.match;
String.prototype.match = function match(search) {
  if (typeof search === 'string') return this.includes(search) ? [search] : null;
  return originalMatch.call(this, search);
};

await import('./apply-p28-c8-refinery-world-patch.mjs');
